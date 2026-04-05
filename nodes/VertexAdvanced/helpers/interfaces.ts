import type { IDataObject } from 'n8n-workflow';

export type GenerateContentGenerationConfig = Pick<
  GenerationConfig,
  | 'stopSequences'
  | 'responseMimeType'
  | 'responseSchema'
  | 'responseJsonSchema'
  | 'responseModalities'
  | 'candidateCount'
  | 'maxOutputTokens'
  | 'temperature'
  | 'topP'
  | 'topK'
  | 'seed'
  | 'presencePenalty'
  | 'frequencyPenalty'
  | 'responseLogprobs'
  | 'logprobs'
  | 'speechConfig'
  | 'thinkingConfig'
  | 'mediaResolution'
>;

export interface GenerateContentRequest extends IDataObject {
  contents: Content[];
  tools?: Tool[];
  toolConfig?: {
    retrievalConfig?: {
      latLng: {
        latitude: number;
        longitude: number;
      };
    };
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  generationConfig?: GenerateContentGenerationConfig;
  cachedContent?: string;
}

export interface GenerateContentResponse {
  candidates: Array<{
    content: Content;
  }>;
}

export interface Content {
  parts: Part[];
  role: string;
}

export type Part =
  | { text: string }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    }
  | {
      functionCall: {
        id?: string;
        name: string;
        args?: IDataObject;
      };
    }
  | {
      functionResponse: {
        id?: string;
        name: string;
        response: IDataObject;
      };
    };

export interface ImagenResponse {
  predictions: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
  }>;
}

export interface VeoResponse {
  name: string;
  done: boolean;
  error?: {
    message: string;
  };
  response: {
    generateVideoResponse: {
      generatedSamples: Array<{
        video: {
          uri: string;
        };
      }>;
    };
  };
}

export interface BuiltInTools {
  googleSearch?: boolean;
  googleMaps?: {
    latitude?: number | string;
    longitude?: number | string;
  };
  urlContext?: boolean;
  fileSearch?: {
    fileSearchStoreNames?: string;
    metadataFilter?: string;
  };
  codeExecution?: boolean;
}

export interface Tool {
  functionDeclarations?: Array<{
    name: string;
    description: string;
    parameters: IDataObject;
  }>;
  googleSearch?: object;
  googleMaps?: object;
  urlContext?: object;
  fileSearch?: {
    fileSearchStoreNames?: string[];
    metadataFilter?: string;
  };
  codeExecution?: object;
}

export enum Modality {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
}

type GenerationConfig = {
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: IDataObject;
  responseJsonSchema?: IDataObject;
  responseModalities?: string[];
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseLogprobs?: boolean;
  logprobs?: number;
  speechConfig?: IDataObject;
  thinkingConfig?: { thinkingBudget: number };
  mediaResolution?: IDataObject;
};
