# n8n-nodes-vertex-advanced

An n8n community node that provides full multimodal access to Google Vertex AI models — text, image, audio, and video — using Google Cloud Service Account authentication.

## Features

- **Text** — Message Gemini models with tool calling, built-in tools (Google Search, URL Context, Code Execution), JSON output, thinking budget, and more
- **Image** — Analyze images, generate images (Gemini & Imagen models), edit images with prompts
- **Audio** — Transcribe audio, analyze audio content
- **Video** — Analyze videos, generate videos with Veo models

## Authentication

Uses the standard `googleApi` (Google Service Account) credential that n8n provides. You need:

1. A Google Cloud Service Account with the **Vertex AI User** role
2. The service account email
3. The private key (from a downloaded JSON key file)
4. Your GCP Project ID (entered in the node parameters)

## Installation

### Via n8n UI

1. Go to **Settings > Community Nodes**
2. Click **Install**
3. Enter `n8n-nodes-vertex-advanced`
4. Click **Install**

### Via npm

```bash
npm install n8n-nodes-vertex-advanced
```

### Via pnpm (for development)

```bash
pnpm install n8n-nodes-vertex-advanced
```

## Usage

1. Add the **Vertex AI Advanced** node to your workflow
2. Select or create a **Google Service Account** credential
3. Enter your **GCP Project ID**
4. Choose a resource (Text, Image, Audio, Video) and operation
5. Select a model and configure parameters

## API

All requests go through the Vertex AI API:

```
https://{region}-aiplatform.googleapis.com/v1beta1/projects/{project}/locations/{region}/publishers/google/models/{model}:{method}
```

Binary data is embedded as `inlineData` (base64) directly in the request payload — no intermediate file uploads required.

## License

MIT
