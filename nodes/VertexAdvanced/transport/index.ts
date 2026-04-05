import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  ILoadOptionsFunctions,
} from 'n8n-workflow';

import { getVertexAccessToken } from '../helpers/auth';

type RequestParameters = {
  headers?: IDataObject;
  body?: IDataObject | string;
  qs?: IDataObject;
  option?: IDataObject;
};

type GoogleApiCredentials = {
  email: string;
  privateKey: string;
  region?: string;
};

const BASE_URL = 'https://aiplatform.googleapis.com';

function buildVertexUrl(
  endpoint: string,
  projectId: string,
  region: string,
): string {
  const prefix = `/v1beta1/projects/${projectId}/locations/${region}/publishers/google`;

  let transformed: string;
  if (endpoint.startsWith('/v1beta/')) {
    transformed = endpoint.replace(/^\/v1beta\//, `${prefix}/`);
  } else if (endpoint.startsWith('/upload/v1beta/')) {
    transformed = endpoint.replace(
      /^\/upload\/v1beta\//,
      `/v1beta1/projects/${projectId}/locations/${region}/`,
    );
  } else if (endpoint.startsWith('/projects/')) {
    // Full resource path from model list dropdown
    transformed = `/v1beta1${endpoint}`;
  } else if (endpoint.startsWith('/models/')) {
    // Already has models/ prefix
    transformed = `${prefix}${endpoint}`;
  } else if (endpoint.startsWith('/models:')) {
    // Model method without model name
    transformed = `${prefix}${endpoint}`;
  } else if (endpoint.startsWith('/v1beta1/')) {
    // Already fully formed
    transformed = endpoint;
  } else {
    // Bare model name like /gemini-2.5-flash:generateContent
    // Inject /models/ between publishers/google and the model name
    const bareName = endpoint.replace(/^\//, '');
    transformed = `${prefix}/models/${bareName}`;
  }

  return `${BASE_URL}${transformed}`;
}

export async function apiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  parameters?: RequestParameters,
) {
  const { body, qs, option, headers } = parameters ?? {};

  const credentials = await this.getCredentials<GoogleApiCredentials>('googleApi');
  const projectId =
    this.getNodeParameter('projectId', 0, '', { extractValue: true }) as string;
  const region = credentials.region || 'us-central1';

  const accessToken = await getVertexAccessToken({
    email: credentials.email,
    privateKey: credentials.privateKey,
  });

  const url = buildVertexUrl(endpoint, projectId, region);

  const options: IDataObject = {
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method,
    body,
    qs,
    url,
    json: true,
  };

  if (option && Object.keys(option).length !== 0) {
    Object.assign(options, option);
  }

  const bodyStr = body
    ? typeof body === 'string'
      ? body.length > 500
        ? body.substring(0, 500) + '... [truncated]'
        : body
      : JSON.stringify(body, null, 2).length > 500
        ? JSON.stringify(body, null, 2).substring(0, 500) + '... [truncated]'
        : JSON.stringify(body, null, 2)
    : '(empty)';

  console.log('[VertexAdvanced] === REQUEST ===');
  console.log('[VertexAdvanced] URL:', url);
  console.log('[VertexAdvanced] Method:', method);
  console.log('[VertexAdvanced] Body:', bodyStr);
  console.log('[VertexAdvanced] ===============');

  try {
    const response = await this.helpers.httpRequest.call(this, options as any);
    return response;
  } catch (error: any) {
    const errorData = error.response?.data ?? error.message;
    console.error('[VertexAdvanced] === REQUEST FAILED ===');
    console.error('[VertexAdvanced] URL:', url);
    console.error('[VertexAdvanced] Method:', method);
    console.error('[VertexAdvanced] Status:', error.response?.status ?? 'N/A');
    console.error('[VertexAdvanced] Error:', typeof errorData === 'string' ? errorData : JSON.stringify(errorData, null, 2));
    console.error('[VertexAdvanced] =======================');
    throw error;
  }
}

export function getRegion(this: IExecuteFunctions | ILoadOptionsFunctions): string {
  return (this as IExecuteFunctions).getCredentials?.('googleApi').then(
    (creds) => (creds as GoogleApiCredentials).region || 'us-central1',
  ) as unknown as string;
}
