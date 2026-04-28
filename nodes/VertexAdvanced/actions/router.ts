import { NodeOperationError, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';

import * as audio from './audio';
import * as document from './document';
import * as image from './image';
import type { VertexAdvancedType } from './node.type';
import * as text from './text';
import * as video from './video';

export async function router(this: IExecuteFunctions) {
  const returnData: INodeExecutionData[] = [];

  const items = this.getInputData();
  const resource = this.getNodeParameter('resource', 0);
  const operation = this.getNodeParameter('operation', 0);

  const vertexAdvancedTypeData = {
    resource,
    operation,
  } as VertexAdvancedType;

  let execute;
  switch (vertexAdvancedTypeData.resource) {
    case 'audio':
      execute = audio[vertexAdvancedTypeData.operation].execute;
      break;
    case 'document':
      execute = document[vertexAdvancedTypeData.operation].execute;
      break;
    case 'image':
      execute = image[vertexAdvancedTypeData.operation].execute;
      break;
    case 'text':
      execute = text[vertexAdvancedTypeData.operation].execute;
      break;
    case 'video':
      execute = video[vertexAdvancedTypeData.operation].execute;
      break;
    default:
      throw new NodeOperationError(
        this.getNode(),
        `The operation "${operation}" is not supported!`,
      );
  }

  for (let i = 0; i < items.length; i++) {
    try {
      const responseData = await execute.call(this, i);
      returnData.push(...responseData);
    } catch (error) {
      if (this.continueOnFail()) {
        returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
        continue;
      }

      throw new NodeOperationError(this.getNode(), error, {
        itemIndex: i,
        description: error.description,
      });
    }
  }

  return [returnData];
}
