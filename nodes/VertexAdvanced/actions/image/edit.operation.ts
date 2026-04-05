import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import type { GenerateContentResponse } from '../../helpers/interfaces';
import { getBinaryAsBase64 } from '../../helpers/utils';
import { apiRequest } from '../../transport';
import { modelRLC } from '../descriptions';

interface ImagesParameter {
  values?: Array<{ binaryPropertyName?: string }>;
}

function isImagesParameter(param: unknown): param is ImagesParameter {
  if (typeof param !== 'object' || param === null) {
    return false;
  }

  const paramObj = param as Record<string, unknown>;

  if (!('values' in paramObj)) {
    return true;
  }

  if (!Array.isArray(paramObj.values)) {
    return false;
  }

  return paramObj.values.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const itemObj = item as Record<string, unknown>;

    if (!('binaryPropertyName' in itemObj)) {
      return true;
    }

    return (
      typeof itemObj.binaryPropertyName === 'string' || itemObj.binaryPropertyName === undefined
    );
  });
}

function isGenerateContentResponse(response: unknown): response is GenerateContentResponse {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  const responseObj = response as Record<string, unknown>;

  if (!('candidates' in responseObj) || !Array.isArray(responseObj.candidates)) {
    return false;
  }

  return responseObj.candidates.every((candidate: unknown) => {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const candidateObj = candidate as Record<string, unknown>;

    if (
      !('content' in candidateObj) ||
      typeof candidateObj.content !== 'object' ||
      candidateObj.content === null
    ) {
      return false;
    }

    const contentObj = candidateObj.content as Record<string, unknown>;

    return 'parts' in contentObj && Array.isArray(contentObj.parts);
  });
}

const properties: INodeProperties[] = [
  modelRLC('imageEditModelSearch'),
  {
    displayName: 'Prompt',
    name: 'prompt',
    type: 'string',
    placeholder: 'e.g. combine the first image with the second image',
    description: 'Instruction describing how to edit the image',
    default: '',
    typeOptions: {
      rows: 2,
    },
  },
  {
    displayName: 'Images',
    name: 'images',
    type: 'fixedCollection',
    placeholder: 'Add Image',
    typeOptions: {
      multipleValues: true,
      multipleValueButtonText: 'Add Image',
    },
    default: { values: [{ binaryPropertyName: 'data' }] },
    description: 'Add one or more binary fields to include images with your prompt',
    options: [
      {
        displayName: 'Image',
        name: 'values',
        values: [
          {
            displayName: 'Binary Field Name',
            name: 'binaryPropertyName',
            type: 'string',
            default: 'data',
            placeholder: 'e.g. data',
            description: 'The name of the binary field containing the image data',
          },
        ],
      },
    ],
  },
  {
    displayName: 'Options',
    name: 'options',
    placeholder: 'Add Option',
    type: 'collection',
    default: {},
    options: [
      {
        displayName: 'Put Output in Field',
        name: 'binaryPropertyOutput',
        type: 'string',
        default: 'edited',
        hint: 'The name of the output field to put the binary file data in',
      },
    ],
  },
];

const displayOptions = {
  show: {
    operation: ['edit'],
    resource: ['image'],
  },
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
  const prompt = this.getNodeParameter('prompt', i, '');
  let model = this.getNodeParameter('modelId', i, '', { extractValue: true }) as string;
  if (!model) {
    model = 'gemini-2.5-flash-image-preview';
  }

  const binaryPropertyOutput = this.getNodeParameter('options.binaryPropertyOutput', i, 'edited');
  const outputKey = typeof binaryPropertyOutput === 'string' ? binaryPropertyOutput : 'data';

  const imagesParam = this.getNodeParameter('images', i, {
    values: [{ binaryPropertyName: 'data' }],
  });

  if (!isImagesParameter(imagesParam)) {
    throw new Error('Invalid images parameter format');
  }

  const imagesUi = imagesParam.values ?? [];
  const imageFieldNames = imagesUi
    .map((v) => v.binaryPropertyName)
    .filter((n): n is string => Boolean(n));

  const inlineParts = [] as Array<{ inlineData: { mimeType: string; data: string } }>;
  for (const fieldName of imageFieldNames) {
    const { base64, mimeType } = await getBinaryAsBase64.call(this, i, fieldName);
    inlineParts.push({ inlineData: { mimeType, data: base64 } });
  }

  const generationConfig = {
    responseModalities: ['IMAGE'],
  };

  const body = {
    contents: [
      {
        role: 'user',
        parts: [...inlineParts, { text: prompt }],
      },
    ],
    generationConfig,
  };

  const response: unknown = await apiRequest.call(
    this,
    'POST',
    `/${model}:generateContent`,
    {
      body,
    },
  );

  if (!isGenerateContentResponse(response)) {
    throw new Error('Invalid response format from Vertex AI API');
  }

  const promises = response.candidates.map(async (candidate) => {
    const imagePart = candidate.content.parts.find((part) => 'inlineData' in part);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image data returned from Vertex AI API');
    }

    const bufferOut = Buffer.from(imagePart.inlineData.data, 'base64');
    const binaryOut = await this.helpers.prepareBinaryData(
      bufferOut,
      'image.png',
      imagePart.inlineData.mimeType,
    );
    return {
      binary: {
        [outputKey]: binaryOut,
      },
      json: {
        ...binaryOut,
        data: undefined,
      },
      pairedItem: { item: i },
    };
  });

  return await Promise.all(promises);
}
