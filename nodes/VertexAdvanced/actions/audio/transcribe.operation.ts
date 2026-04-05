import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import type {
  Content,
  GenerateContentRequest,
  GenerateContentResponse,
} from '../../helpers/interfaces';
import { getBinaryAsBase64, urlToBase64 } from '../../helpers/utils';
import { apiRequest } from '../../transport';
import { modelRLC } from '../descriptions';

const properties: INodeProperties[] = [
  modelRLC('audioModelSearch'),
  {
    displayName: 'Input Type',
    name: 'inputType',
    type: 'options',
    default: 'url',
    options: [
      {
        name: 'Audio URL(s)',
        value: 'url',
      },
      {
        name: 'Binary File(s)',
        value: 'binary',
      },
    ],
  },
  {
    displayName: 'URL(s)',
    name: 'audioUrls',
    type: 'string',
    placeholder: 'e.g. https://example.com/audio.mp3',
    description:
      'URL(s) of the audio(s) to transcribe, multiple URLs can be added separated by comma',
    default: '',
    displayOptions: {
      show: {
        inputType: ['url'],
      },
    },
  },
  {
    displayName: 'Input Data Field Name(s)',
    name: 'binaryPropertyName',
    type: 'string',
    default: 'data',
    placeholder: 'e.g. data',
    hint: 'The name of the input field containing the binary file data to be processed',
    description:
      'Name of the binary field(s) which contains the audio(s), separate multiple field names with commas',
    displayOptions: {
      show: {
        inputType: ['binary'],
      },
    },
  },
  {
    displayName: 'Simplify Output',
    name: 'simplify',
    type: 'boolean',
    default: true,
    description: 'Whether to simplify the response or not',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    default: {},
    options: [
      {
        displayName: 'Start Time',
        name: 'startTime',
        type: 'string',
        default: '',
        description: 'The start time of the audio in MM:SS or HH:MM:SS format',
        placeholder: 'e.g. 00:15',
      },
      {
        displayName: 'End Time',
        name: 'endTime',
        type: 'string',
        default: '',
        description: 'The end time of the audio in MM:SS or HH:MM:SS format',
        placeholder: 'e.g. 02:15',
      },
    ],
  },
];

const displayOptions = {
  show: {
    operation: ['transcribe'],
    resource: ['audio'],
  },
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
  const model = this.getNodeParameter('modelId', i, '', { extractValue: true }) as string;
  const inputType = this.getNodeParameter('inputType', i, 'url') as string;
  const simplify = this.getNodeParameter('simplify', i, true) as boolean;
  const options = this.getNodeParameter('options', i, {});

  let contents: Content[];
  if (inputType === 'url') {
    const urls = this.getNodeParameter('audioUrls', i, '') as string;
    const partsPromises = urls
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url)
      .map(async (url) => {
        const { base64, mimeType } = await urlToBase64.call(this, url, 'audio/mpeg');
        return { inlineData: { mimeType, data: base64 } };
      });

    const parts = await Promise.all(partsPromises);
    contents = [{ role: 'user', parts }];
  } else {
    const binaryPropertyNames = this.getNodeParameter('binaryPropertyName', i, 'data');
    const partsPromises = binaryPropertyNames
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name)
      .map(async (binaryPropertyName) => {
        const { base64, mimeType } = await getBinaryAsBase64.call(this, i, binaryPropertyName);
        return { inlineData: { mimeType, data: base64 } };
      });

    const parts = await Promise.all(partsPromises);
    contents = [{ role: 'user', parts }];
  }

  const text = `Generate a transcript of the speech${
    options.startTime ? ` from ${options.startTime as string}` : ''
  }${options.endTime ? ` to ${options.endTime as string}` : ''}`;
  contents[0].parts.push({ text });

  const body: GenerateContentRequest = {
    contents,
  };

  const response = (await apiRequest.call(this, 'POST', `/${model}:generateContent`, {
    body,
  })) as GenerateContentResponse;

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
