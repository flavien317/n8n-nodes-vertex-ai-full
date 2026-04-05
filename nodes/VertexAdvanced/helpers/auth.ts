import { createSign } from 'node:crypto';

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_EXPIRY_SECONDS = 3600;

interface ServiceAccountCredentials {
  email: string;
  privateKey: string;
}

interface JwtHeader {
  alg: string;
  typ: string;
}

interface JwtClaim {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}

function formatPrivateKey(key: string): string {
  let formatted = key.replace(/\\n/g, '\n');
  if (!formatted.includes('-----BEGIN PRIVATE KEY-----')) {
    formatted = `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
  }
  return formatted;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createJwt(credentials: ServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000);

  const header: JwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claim: JwtClaim = {
    iss: credentials.email,
    scope: GOOGLE_SCOPES,
    aud: GOOGLE_TOKEN_URI,
    exp: now + TOKEN_EXPIRY_SECONDS,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signingInput = `${encodedHeader}.${encodedClaim}`;

  const formattedKey = formatPrivateKey(credentials.privateKey);
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(formattedKey, 'base64');

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function getVertexAccessToken(
  credentials: ServiceAccountCredentials,
): Promise<string> {
  const jwt = createJwt(credentials);

  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to obtain Vertex AI access token: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
