import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import type { Content } from '../../helpers/interfaces';
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
		typeOptions: {
			rows: 3,
		},
		description: 'The question or instruction to apply to the document',
	},
	{
		displayName: 'Input Type',
		name: 'inputType',
		type: 'options',
		default: 'binary',
		options: [
			{
				name: 'Binary File (PDF/image from previous node)',
				value: 'binary',
			},
			{
				name: 'URL (public link)',
				value: 'url',
			},
		],
	},
	{
		displayName: 'Input Data Field Name(s)',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		placeholder: 'e.g. data',
		hint: 'The name of the input field containing the binary file data to be processed',
		description:
			'Name of the binary field(s) which contains the document(s), separate multiple field names with commas',
		displayOptions: {
			show: {
				inputType: ['binary'],
			},
		},
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
		displayOptions: {
			show: {
				inputType: ['binary'],
			},
		},
		description:
			'MIME type of the document. Use "Detect Automatically" to read it from the binary data (recommended).',
	},
	{
		displayName: 'URL(s)',
		name: 'documentUrls',
		type: 'string',
		placeholder: 'e.g. https://example.com/document.pdf',
		description:
			'URL(s) of the document(s) to analyze, multiple URLs can be added separated by comma',
		default: '',
		displayOptions: {
			show: {
				inputType: ['url'],
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
		placeholder: 'Add Option',
		type: 'collection',
		default: {},
		options: [
			{
				displayName: 'Max Output Tokens',
				name: 'maxOutputTokens',
				type: 'number',
				default: 2048,
				description: 'Maximum number of tokens in the response',
				typeOptions: {
					minValue: 1,
				},
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
	const options = this.getNodeParameter('options', i, {}) as { maxOutputTokens?: number };

	const generationConfig = {
		maxOutputTokens: options.maxOutputTokens,
	};

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
		// binary
		const binaryPropertyNames = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
		const mimeTypeSetting = this.getNodeParameter('mimeType', i, 'auto') as string;

		const partsPromises = binaryPropertyNames
			.split(',')
			.map((name) => name.trim())
			.filter((name) => name)
			.map(async (binaryPropertyName) => {
				const { base64, mimeType: detectedMimeType } = await getBinaryAsBase64.call(
					this,
					i,
					binaryPropertyName,
				);
				const resolvedMimeType =
					mimeTypeSetting === 'auto' ? detectedMimeType : mimeTypeSetting;
				return { inlineData: { mimeType: resolvedMimeType, data: base64 } };
			});

		const parts = await Promise.all(partsPromises);
		contents = [{ role: 'user', parts }];
	}

	// Append the prompt at the end
	contents[0].parts.push({ text });

	const body = { contents, generationConfig };

	const response = (await apiRequest.call(this, 'POST', `/${model}:generateContent`, {
		body,
	})) as { candidates: Array<{ content: Content }> };

	if (simplify) {
		return response.candidates.map((candidate) => ({
			json: candidate,
			pairedItem: { item: i },
		}));
	}

	return [{ json: { ...response }, pairedItem: { item: i } }];
}
