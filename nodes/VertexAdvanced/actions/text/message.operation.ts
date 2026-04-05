import {
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeProperties,
  updateDisplayOptions,
  validateNodeParameters,
} from 'n8n-workflow';

import type {
  GenerateContentRequest,
  GenerateContentResponse,
  Content,
  Tool,
  GenerateContentGenerationConfig,
  BuiltInTools,
} from '../../helpers/interfaces';
import { apiRequest } from '../../transport';
import { modelRLC } from '../descriptions';

const properties: INodeProperties[] = [
  modelRLC('modelSearch'),
  {
    displayName: 'Messages',
    name: 'messages',
    type: 'fixedCollection',
    typeOptions: {
      sortable: true,
      multipleValues: true,
    },
    placeholder: 'Add Message',
    default: { values: [{ content: '' }] },
    options: [
      {
        displayName: 'Values',
        name: 'values',
        values: [
          {
            displayName: 'Prompt',
            name: 'content',
            type: 'string',
            description: 'The content of the message to be send',
            default: '',
            placeholder: 'e.g. Hello, how can you help me?',
            typeOptions: {
              rows: 2,
            },
          },
          {
            displayName: 'Role',
            name: 'role',
            type: 'options',
            description:
              "Role in shaping the model's response, it tells the model how it should behave and interact with the user",
            options: [
              {
                name: 'User',
                value: 'user',
                description: 'Send a message as a user and get a response from the model',
              },
              {
                name: 'Model',
                value: 'model',
                description: 'Tell the model to adopt a specific tone or personality',
              },
            ],
            default: 'user',
          },
        ],
      },
    ],
  },
  {
    displayName: 'Simplify Output',
    name: 'simplify',
    type: 'boolean',
    default: true,
    description: 'Whether to return a simplified version of the response instead of the raw data',
  },
  {
    displayName: 'Output Content as JSON',
    name: 'jsonOutput',
    type: 'boolean',
    description: 'Whether to attempt to return the response in JSON format',
    default: false,
  },
  {
    displayName: 'Built-in Tools',
    name: 'builtInTools',
    placeholder: 'Add Built-in Tool',
    type: 'collection',
    default: {},
    options: [
      {
        displayName: 'Google Search',
        name: 'googleSearch',
        type: 'boolean',
        default: true,
        description:
          'Whether to allow the model to search the web using Google Search to get real-time information',
      },
      {
        displayName: 'Google Maps',
        name: 'googleMaps',
        type: 'collection',
        default: { latitude: '', longitude: '' },
        options: [
          {
            displayName: 'Latitude',
            name: 'latitude',
            type: 'number',
            default: '',
            description: 'The latitude coordinate for location-based queries',
            typeOptions: {
              numberPrecision: 6,
            },
          },
          {
            displayName: 'Longitude',
            name: 'longitude',
            type: 'number',
            default: '',
            description: 'The longitude coordinate for location-based queries',
            typeOptions: {
              numberPrecision: 6,
            },
          },
        ],
      },
      {
        displayName: 'URL Context',
        name: 'urlContext',
        type: 'boolean',
        default: true,
        description: 'Whether to allow the model to read and analyze content from specific URLs',
      },
      {
        displayName: 'Code Execution',
        name: 'codeExecution',
        type: 'boolean',
        default: true,
        description:
          'Whether to allow the model to execute code it generates to produce a response. Supported only by certain models.',
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
        displayName: 'Include Merged Response',
        name: 'includeMergedResponse',
        type: 'boolean',
        default: false,
        description:
          'Whether to include a single output string merging all text parts of the response',
      },
      {
        displayName: 'System Message',
        name: 'systemMessage',
        type: 'string',
        default: '',
        placeholder: 'e.g. You are a helpful assistant',
      },
      {
        displayName: 'Frequency Penalty',
        name: 'frequencyPenalty',
        default: 0,
        description:
          "Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
        type: 'number',
        typeOptions: {
          minValue: -2,
          maxValue: 2,
          numberPrecision: 1,
        },
      },
      {
        displayName: 'Maximum Number of Tokens',
        name: 'maxOutputTokens',
        default: 16,
        description: 'The maximum number of tokens to generate in the completion',
        type: 'number',
        typeOptions: {
          minValue: 1,
          numberPrecision: 0,
        },
      },
      {
        displayName: 'Number of Completions',
        name: 'candidateCount',
        default: 1,
        description: 'How many completions to generate for each prompt',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 8,
          numberPrecision: 0,
        },
      },
      {
        displayName: 'Presence Penalty',
        name: 'presencePenalty',
        default: 0,
        description:
          "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
        type: 'number',
        typeOptions: {
          minValue: -2,
          maxValue: 2,
          numberPrecision: 1,
        },
      },
      {
        displayName: 'Output Randomness (Temperature)',
        name: 'temperature',
        default: 1,
        description:
          'Controls the randomness of the output. Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive',
        type: 'number',
        typeOptions: {
          minValue: 0,
          maxValue: 2,
          numberPrecision: 1,
        },
      },
      {
        displayName: 'Output Randomness (Top P)',
        name: 'topP',
        default: 1,
        description: 'The maximum cumulative probability of tokens to consider when sampling',
        type: 'number',
        typeOptions: {
          minValue: 0,
          maxValue: 1,
          numberPrecision: 1,
        },
      },
      {
        displayName: 'Output Randomness (Top K)',
        name: 'topK',
        default: 1,
        description: 'The maximum number of tokens to consider when sampling',
        type: 'number',
        typeOptions: {
          minValue: 1,
          numberPrecision: 0,
        },
      },
      {
        displayName: 'Thinking Budget',
        name: 'thinkingBudget',
        type: 'number',
        default: -1,
        description:
          'Controls reasoning tokens for thinking models. Set to 0 to disable automatic thinking. Set to -1 for dynamic thinking (default).',
        typeOptions: {
          minValue: -1,
          numberPrecision: 0,
        },
      },
    ],
  },
];

const displayOptions = {
  show: {
    operation: ['message'],
    resource: ['text'],
  },
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
  const model = this.getNodeParameter('modelId', i, '', { extractValue: true }) as string;
  const messages = this.getNodeParameter('messages.values', i, []) as Array<{
    content: string;
    role: string;
  }>;
  const simplify = this.getNodeParameter('simplify', i, true) as boolean;
  const jsonOutput = this.getNodeParameter('jsonOutput', i, false) as boolean;
  const options = this.getNodeParameter('options', i, {});
  const builtInTools = this.getNodeParameter('builtInTools', i, {}) as BuiltInTools;
  validateNodeParameters(
    options,
    {
      includeMergedResponse: { type: 'boolean', required: false },
      systemMessage: { type: 'string', required: false },
      frequencyPenalty: { type: 'number', required: false },
      maxOutputTokens: { type: 'number', required: false },
      candidateCount: { type: 'number', required: false },
      presencePenalty: { type: 'number', required: false },
      temperature: { type: 'number', required: false },
      topP: { type: 'number', required: false },
      topK: { type: 'number', required: false },
      thinkingBudget: { type: 'number', required: false },
    },
    this.getNode(),
  );

  const generationConfig: GenerateContentGenerationConfig = {
    frequencyPenalty: options.frequencyPenalty,
    maxOutputTokens: options.maxOutputTokens,
    candidateCount: options.candidateCount,
    presencePenalty: options.presencePenalty,
    temperature: options.temperature,
    topP: options.topP,
    topK: options.topK,
    responseMimeType: jsonOutput ? 'application/json' : undefined,
  };

  if (options.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget: options.thinkingBudget,
    };
  }

  const tools: Tool[] = [];

  if (builtInTools) {
    if (builtInTools.googleSearch) {
      tools.push({ googleSearch: {} });
    }

    const googleMapsOptions = builtInTools.googleMaps;
    if (googleMapsOptions) {
      tools.push({ googleMaps: {} });
    }

    if (builtInTools.urlContext) {
      tools.push({ urlContext: {} });
    }

    if (builtInTools.codeExecution) {
      tools.push({ codeExecution: {} });
    }
  }

  const contents: Content[] = messages.map((m) => ({
    parts: [{ text: m.content }],
    role: m.role,
  }));

  const body: GenerateContentRequest = {
    ...(tools.length > 0 && { tools }),
    contents,
    generationConfig,
    systemInstruction: options.systemMessage
      ? { parts: [{ text: options.systemMessage }] }
      : undefined,
  };

  const response = (await apiRequest.call(this, 'POST', `/${model}:generateContent`, {
    body,
  })) as GenerateContentResponse;

  const candidates = options.includeMergedResponse
    ? response.candidates.map((candidate) => ({
        ...candidate,
        mergedResponse: candidate.content.parts
          .filter((part) => 'text' in part)
          .map((part) => (part as { text: string }).text)
          .join(''),
      }))
    : response.candidates;

  if (simplify) {
    return candidates.map((candidate) => ({
      json: candidate,
      pairedItem: { item: i },
    }));
  }

  return [
    {
      json: {
        ...response,
        candidates,
      },
      pairedItem: { item: i },
    },
  ];
}
