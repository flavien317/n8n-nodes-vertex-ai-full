import {
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeProperties,
  updateDisplayOptions,
} from 'n8n-workflow';

import type {
  Content,
  GenerateContentGenerationConfig,
} from '../../helpers/interfaces';
import { getBinaryAsBase64, urlToBase64 } from '../../helpers/utils';
import { apiRequest } from '../../transport';
import { modelRLC } from '../descriptions';

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'text/plain': 'Plain Text',
  'text/html': 'HTML',
  'text/md': 'Markdown',
  'text/csv': 'CSV',
  'text/rtf': 'RTF',
  'image/jpeg': 'JPEG Image',
  'image/png': 'PNG Image',
  'image/webp': 'WebP Image',
  'image/gif': 'GIF Image',
  'image/heic': 'HEIC Image',
};

const properties: INodeProperties[] = [
  modelRLC('documentModelSearch'),
  {
    displayName: 'Prompt / Question',
    name: 'text',
    type: 'string',
    placeholder: 'e.g. Summarize this document, Extract all dates, What are the key findings?',
    default: 'Please summarize this document.',
    typeOptions: { rows: 3 },
    description: 'The question or instruction to apply to the document',
  },
  {
    displayName: 'Input Type',
    name: 'inputType',
    type: 'options',
    default: 'binary',
    options: [
      { name: 'Binary File (PDF/image from previous node)', value: 'binary' },
      { name: 'URL (public link)', value: 'url' },
    ],
  },
  {
    displayName: 'Input Data Field Name(s)',
    name: 'binaryPropertyName',
    type: 'string',
    default: 'data',
    placeholder: 'e.g. data',
    hint: 'The name of the input field containing the binary file data to be processed',
    description: 'Name of the binary field(s) which contains the document(s), separate multiple field names with commas',
    displayOptions: { show: { inputType: ['binary'] } },
  },
  {
    displayName: 'MIME Type',
    name: 'mimeType',
    type: 'options',
    default: 'auto',
    options: [
      { name: 'Detect Automatically', value: 'auto' },
      ...Object.entries(SUPPORTED_MIME_TYPES).map(([value, name]) => ({ name, value })),
    ],
    displayOptions: { show: { inputType: ['binary'] } },
    description: 'MIME type of the document. Use "Detect Automatically" to read it from the binary data (recommended).',
  },
  {
    displayName: 'URL(s)',
    name: 'documentUrls',
    type: 'string',
    placeholder: 'e.g. https://example.com/document.pdf',
    description: 'URL(s) of the document(s) to analyze, multiple URLs can be added separated by comma',
    default: '',
    displayOptions: { show: { inputType: ['url'] } },
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
    placeholder: 'Add Option',
    type: 'collection',
    default: {},
    options: [
      {
        displayName: 'System Message',
        name: 'systemMessage',
        type: 'string',
        default: '',
        placeholder: 'e.g. You are a document analysis expert',
        description: 'A system-level instruction given to the model before the document and prompt',
      },
      {
        displayName: 'Maximum Number of Tokens',
        name: 'maxOutputTokens',
        default: 2048,
        description: 'The maximum number of tokens to generate in the response',
        type: 'number',
        typeOptions: { minValue: 1, numberPrecision: 0 },
      },
      {
        displayName: 'Number of Completions',
        name: 'candidateCount',
        default: 1,
        description: 'How many completions to generate for each prompt',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 8, numberPrecision: 0 },
      },
      {
        displayName: 'Output Randomness (Temperature)',
        name: 'temperature',
        default: 1,
        description: 'Controls the randomness of the output. Lower = more deterministic, higher = more creative',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
      },
      {
        displayName: 'Output Randomness (Top P)',
        name: 'topP',
        default: 1,
        description: 'The maximum cumulative probability of tokens to consider when sampling',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 1 },
      },
      {
        displayName: 'Output Randomness (Top K)',
        name: 'topK',
        default: 1,
        description: 'The maximum number of tokens to consider when sampling',
        type: 'number',
        typeOptions: { minValue: 1, numberPrecision: 0 },
      },
      {
        displayName: 'Thinking Budget',
        name: 'thinkingBudget',
        type: 'number',
        default: -1,
        description: 'Controls reasoning tokens for thinking models (Gemini 2.5+). Set to 0 to disable, -1 for dynamic (default).',
        typeOptions: { minValue: -1, numberPrecision: 0 },
      },
    ],
  },
];

const displayOptions = {
  show: {
    operation: ['analyze'],
    resource: ['document'],
  },
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
  const model = this.getNodeParameter('modelId', i, '', { extractValue: true }) as string;
  const inputType = this.getNodeParameter('inputType', i, 'binary') as string;
  const text = this.getNodeParameter('text', i, 'Please summarize this document.') as string;
  const simplify = this.getNodeParameter('simplify', i, true) as boolean;
  const options = this.getNodeParameter('options', i, {}) as {
    systemMessage?: string;
    maxOutputTokens?: number;
    candidateCount?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    thinkingBudget?: number;
  };

  // Only send fields explicitly set by the user to avoid API rejections
  const generationConfig: GenerateContentGenerationConfig = {};
  if (options.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = options.maxOutputTokens;
  if (options.candidateCount !== undefined) generationConfig.candidateCount = options.candidateCount;
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
  if (options.topP !== undefined) generationConfig.topP = options.topP;
  if (options.topK !== undefined) generationConfig.topK = options.topK;
  if (options.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
  }

  let contents: Content[];

  if (inputType === 'url') {
    const urls = this.getNodeParameter('documentUrls', i, '') as string;
    const partsPromises = urls
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u)
      .map(async (url) => {
        const { base64, mimeType } = await urlToBase64.call(this, url, 'application/pdf');
        return { inlineData: { mimeType, data: base64 } };
      });
    const parts = await Promise.all(partsPromises);
    contents = [{ role: 'user', parts }];
  } else {
    const binaryPropertyNames = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
    const mimeTypeSetting = this.getNodeParameter('mimeType', i, 'auto') as string;
    const partsPromises = binaryPropertyNames
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name)
      .map(async (binaryPropertyName) => {
        const { base64, mimeType: detectedMimeType } = await getBinaryAsBase64.call(this, i, binaryPropertyName);
        const resolvedMimeType = mimeTypeSetting === 'auto' ? detectedMimeType : mimeTypeSetting;
        return { inlineData: { mimeType: resolvedMimeType, data: base64 } };
      });
    const parts = await Promise.all(partsPromises);
    contents = [{ role: 'user', parts }];
  }

  contents[0].parts.push({ text });

  const body = {
    contents,
    generationConfig,
    ...(options.systemMessage ? { systemInstruction: { parts: [{ text: options.systemMessage }] } } : {}),
  };

  const response = (await apiRequest.call(this, 'POST', `/${model}:generateContent`, { body })) as {
    candidates: Array<{ content: Content }>;
  };

  if (simplify) {
    return response.candidates.map((candidate) => ({ json: candidate, pairedItem: { item: i } }));
  }

  return [{ json: { ...response }, pairedItem: { item: i } }];
}
