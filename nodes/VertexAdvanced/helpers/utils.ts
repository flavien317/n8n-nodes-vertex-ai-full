import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

export async function downloadFile(
  this: IExecuteFunctions,
  url: string,
  fallbackMimeType?: string,
  qs?: IDataObject,
) {
  const downloadResponse = (await this.helpers.httpRequest({
    method: 'GET',
    url,
    qs,
    returnFullResponse: true,
    encoding: 'arraybuffer',
  })) as { body: ArrayBuffer; headers: IDataObject };

  const mimeType =
    ((downloadResponse.headers?.['content-type'] as string)?.split(';')?.[0] ??
      fallbackMimeType) ||
    'application/octet-stream';
  const fileContent = Buffer.from(downloadResponse.body);
  return {
    fileContent,
    mimeType,
  };
}

export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

export async function getBinaryAsBase64(
  this: IExecuteFunctions,
  i: number,
  binaryPropertyName: string,
): Promise<{ base64: string; mimeType: string }> {
  const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
  const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
  return {
    base64: bufferToBase64(buffer),
    mimeType: binaryData.mimeType || 'application/octet-stream',
  };
}

export async function urlToBase64(
  this: IExecuteFunctions,
  url: string,
  fallbackMimeType: string,
): Promise<{ base64: string; mimeType: string }> {
  const { fileContent, mimeType } = await downloadFile.call(
    this,
    url,
    fallbackMimeType,
  );
  return {
    base64: bufferToBase64(fileContent),
    mimeType,
  };
}
