import {
  validateNodeParameters,
  type IExecuteFunctions,
  type INodeExecutionData,
} from 'n8n-workflow';

import type { Content, GenerateContentResponse } from './interfaces';
import { getBinaryAsBase64, urlToBase64 } from './utils';
import { apiRequest } from '../transport';

export async function baseAnalyze(
  this: IExecuteFunctions,
  i: number,
  urlsPropertyName: string,
  fallbackMimeType: string,
): Promise<INodeExecutionData[]> {
  const model = this.getNodeParameter('modelId', i, '', {
    extractValue: true,
  }) as string;
  const inputType = this.getNodeParameter('inputType', i, 'url') as string;
  const text = this.getNodeParameter('text', i, '') as string;
  const simplify = this.getNodeParameter('simplify', i, true) as boolean;
  const options = this.getNodeParameter('options', i, {});
  validateNodeParameters(
    options,
    { maxOutputTokens: { type: 'number', required: false } },
    this.getNode(),
  );
  const generationConfig = {
    maxOutputTokens: options.maxOutputTokens,
  };

  let contents: Content[];
  if (inputType === 'url') {
    const urls = this.getNodeParameter(urlsPropertyName, i, '') as string;
    const partsPromises = urls
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u)
      .map(async (url) => {
        const { base64, mimeType } = await urlToBase64.call(
          this,
          url,
          fallbackMimeType,
        );
        return {
          inlineData: { mimeType, data: base64 },
        };
      });

    const parts = await Promise.all(partsPromises);
    contents = [
      {
        role: 'user',
        parts,
      },
    ];
  } else {
    const binaryPropertyNames = this.getNodeParameter(
      'binaryPropertyName',
      i,
      'data',
    );
    const partsPromises = binaryPropertyNames
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name)
      .map(async (binaryPropertyName) => {
        const { base64, mimeType } = await getBinaryAsBase64.call(
          this,
          i,
          binaryPropertyName,
        );
        return {
          inlineData: { mimeType, data: base64 },
        };
      });

    const parts = await Promise.all(partsPromises);
    contents = [
      {
        role: 'user',
        parts,
      },
    ];
  }

  contents[0].parts.push({ text });

  const body = {
    contents,
    generationConfig,
  };

  const response = (await apiRequest.call(
    this,
    'POST',
    `/${model}:generateContent`,
    { body },
  )) as GenerateContentResponse;

  if (simplify) {
    return response.candidates.map((candidate) => ({
      json: candidate,
      pairedItem: { item: i },
    }));
  }

  return [
    {
      json: { ...response },
      pairedItem: { item: i },
    },
  ];
}
