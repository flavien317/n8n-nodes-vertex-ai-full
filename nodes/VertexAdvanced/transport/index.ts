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

function buildVertexUrl(
  endpoint: string,
  projectId: string,
  region: string,
): string {
  const transformed = endpoint
    .replace(/^\/v1beta\//, `/v1beta1/projects/${projectId}/locations/${region}/publishers/google/`)
    .replace(
      /^\/upload\/v1beta\//,
      `/v1beta1/projects/${projectId}/locations/${region}/`,
    );

  return `https://${region}-aiplatform.googleapis.com${transformed}`;
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

  return await this.helpers.httpRequest.call(this, options as any);
}

export function getRegion(this: IExecuteFunctions | ILoadOptionsFunctions): string {
  return (this as IExecuteFunctions).getCredentials?.('googleApi').then(
    (creds) => (creds as GoogleApiCredentials).region || 'us-central1',
  ) as unknown as string;
}
