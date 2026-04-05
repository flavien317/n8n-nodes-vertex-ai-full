/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import { NodeConnectionTypes, type INodeTypeDescription } from 'n8n-workflow';

import * as audio from './audio';
import * as image from './image';
import * as text from './text';
import * as video from './video';

export const versionDescription: INodeTypeDescription = {
  displayName: 'Vertex AI Advanced',
  name: 'vertexAdvanced',
  icon: 'file:gemini.svg',
  group: ['transform'],
  version: [1, 1.1],
  defaultVersion: 1.1,
  subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
  description: 'Interact with Google Vertex AI models — multimodal text, image, audio, and video',
  defaults: {
    name: 'Vertex AI Advanced',
  },
  usableAsTool: true,
  codex: {
    alias: ['google-vertex', 'video', 'audio', 'transcribe', 'multimodal', 'gemini'],
    categories: ['AI'],
    subcategories: {
      AI: ['Agents', 'Miscellaneous', 'Root Nodes'],
    },
    resources: {
      primaryDocumentation: [
        {
          url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models',
        },
      ],
    },
  },
  inputs: `={{
    (() => {
      const resource = $parameter.resource;
      const operation = $parameter.operation;
      if (resource === 'text' && operation === 'message') {
        return [{ type: 'main' }, { type: 'ai_tool', displayName: 'Tools' }];
      }

      return ['main'];
    })()
  }}`,
  outputs: [NodeConnectionTypes.Main],
  credentials: [
    {
      name: 'googleApi',
      required: true,
    },
  ],
  properties: [
    {
      displayName: 'Project ID',
      name: 'projectId',
      type: 'string',
      default: '',
      placeholder: 'e.g. my-gcp-project',
      description: 'The Google Cloud Platform project ID',
      required: true,
    },
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      noDataExpression: true,
      options: [
        {
          name: 'Audio',
          value: 'audio',
        },
        {
          name: 'Image',
          value: 'image',
        },
        {
          name: 'Text',
          value: 'text',
        },
        {
          name: 'Video',
          value: 'video',
        },
      ],
      default: 'text',
    },
    ...audio.description,
    ...image.description,
    ...text.description,
    ...video.description,
  ],
};
