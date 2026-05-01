# n8n-nodes-vertex-ai-full

[![n8n Community Node](https://img.shields.io/badge/n8n-community%20node-ff6d5a?style=flat-square)](https://www.n8n.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A production-grade n8n community node that brings the polished UI/UX of the official n8n Gemini node to **Google Cloud Vertex AI** — powered entirely by Service Account authentication.

> **Based on [n8n-nodes-vertex-advanced](https://github.com/airesearch-official/n8n-nodes-vertex-advanced) by [airesearch-official](https://github.com/airesearch-official)** — extended with Document analysis support and additional improvements.

---

## Why This Node Exists

The official n8n Gemini node uses the Google AI Studio API (API key authentication), which has strict rate limits and cannot tap into enterprise Google Cloud billing. This node provides the **exact same interface and feature set** but routes every request through the **Vertex AI API** using Google Cloud Service Account credentials.

This means you can:

- **Use your enterprise Google Cloud credits** instead of AI Studio quotas
- **Bypass AI Studio API limits** with Vertex AI's higher throughput
- **Leverage existing GCP infrastructure** — service accounts, IAM policies, audit logging
- **Access the full model catalog** including preview and region-specific models

---

## Key Features

### Text — Message Gemini Models
- Multi-turn conversations with role-based messages
- Built-in tools: Google Search, URL Context, Google Maps, Code Execution
- JSON output mode for structured responses
- Thinking budget control for reasoning models
- Temperature, top-P, top-K, frequency/presence penalty tuning
- System messages and merged response output

### Image — Generate, Analyze & Edit
- **Generate images** with Gemini (multimodal output) and Imagen 3 models
- **Analyze images** from URLs or binary data — ask questions, get descriptions
- **Edit images** with natural language prompts — combine, modify, transform
- Flawless Base64 `inlineData` interception — no temporary file uploads or GCS buckets required

### Audio — Transcribe & Analyze
- **Transcribe audio** into text with start/end time markers
- **Analyze audio** content — ask questions about speech, music, or ambient sound
- Supports URL and binary input with automatic MIME type detection

### Video — Generate & Analyze
- **Generate videos** with Veo models — configurable duration, aspect ratio, person generation
- **Analyze videos** from URLs or binary data
- Return as binary file or downloadable URL

### Document — Analyze *(added in this fork)*
- **Analyze PDFs, images, and text files** with any Gemini multimodal model
- Supports PDF, plain text, HTML, Markdown, CSV, RTF, JPEG, PNG, WebP, GIF, HEIC
- Input from binary data (previous node) or public URL
- Automatic MIME type detection from binary metadata
- Multi-document support — pass multiple files separated by comma
- Options: System Message, Temperature, Top-P, Top-K, Max Tokens, Thinking Budget
- Only sends parameters supported by the Vertex AI API — no risk of 400 errors

---

## Installation

### Via n8n UI

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Click **Install**
4. Enter `n8n-nodes-vertex-ai-full`
5. Click **Install** and restart n8n

### Via npm (self-hosted)

```bash
cd ~/.n8n/custom
npm install n8n-nodes-vertex-ai-full
```

Then restart n8n.

### Via pnpm

```bash
cd ~/.n8n/custom
pnpm add n8n-nodes-vertex-ai-full
```

---

## Authentication Guide

This node uses the standard n8n **Google Service Account** credential (`googleApi`). Here's how to set it up:

### Step 1: Create a Service Account

1. Open the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Click **Create Service Account**
4. Give it a name (e.g., `n8n-vertex-ai`) and click **Create and Continue**

### Step 2: Grant Permissions

Assign the **Vertex AI User** role (`roles/aiplatform.user`) to the service account. This grants access to all Vertex AI generative models.

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:n8n-vertex-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Step 3: Download the Key

1. In the Service Accounts page, click on your service account
2. Go to the **Keys** tab
3. Click **Add Key** → **Create new key** → **JSON**
4. Save the downloaded JSON file

### Step 4: Configure in n8n

1. In n8n, go to **Credentials** → **Create Credential** → **Google Service Account**
2. Paste the **email** from the JSON key file
3. Paste the **private key** from the JSON key file
4. Set the **region** (e.g., `us-central1`, `europe-west4`, or `global`)

### Step 5: Use the Node

1. Add the **Vertex AI Full** node to your workflow
2. Select your Google Service Account credential
3. Enter your **GCP Project ID**
4. Choose a resource (Text, Image, Audio, Video, Document) and configure as needed

---

## Region Handling

The node automatically handles regional routing:

- **Regional endpoints** (e.g., `us-central1`, `europe-west4`): Routes to `https://aiplatform.googleapis.com/v1beta1/projects/{project}/locations/{region}/publishers/google/models/{model}:{method}`
- **Global endpoint**: When region is set to `global`, the node correctly uses `https://aiplatform.googleapis.com` without the invalid `global-aiplatform` subdomain

All region logic is handled internally — you just select the region in your credential.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│   n8n Workflow  │────▶│  Vertex AI Full      │────▶│  Vertex AI API          │
│                 │     │  Node                │     │  aiplatform.googleapis  │
│  Binary Data    │     │                      │     │  .com                   │
│  Text Input     │     │  JWT Auth (SA)       │     │                         │
│  PDF / Image    │     │  Base64 inlineData   │     │  Gemini / Imagen / Veo  │
└─────────────────┘     └──────────────────────┘     └─────────────────────────┘
```

### Key Engineering Decisions

- **No file uploads**: Binary data is converted to Base64 and embedded as `inlineData` directly in the API payload — no intermediate GCS uploads or polling
- **Service Account JWT auth**: Generates OAuth2 Bearer tokens via JWT Bearer grant flow — no API keys
- **Unified base URL**: All requests go to `aiplatform.googleapis.com` with the region specified in the path only
- **Dynamic model list**: All model dropdowns are fetched live from the Vertex AI API — no hardcoded lists, future models appear automatically

---

## Development

```bash
git clone https://github.com/flavien317/n8n-nodes-vertex-ai-full.git
cd n8n-nodes-vertex-ai-full
npm install
npm run build
```

To use during development, symlink the `dist` folder into your n8n custom nodes directory:

```bash
ln -s $(pwd)/dist ~/.n8n/custom/n8n-nodes-vertex-ai-full
```

---

## Supported Models

Models are loaded dynamically from the Vertex AI API — the list below reflects current availability but will update automatically as Google releases new models.

| Resource | Models |
|----------|--------|
| **Text** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, and all Gemini text models |
| **Image Generation** | Gemini 2.5 Flash Image, Imagen 3, Imagen 4 |
| **Image Analysis** | All Gemini multimodal models |
| **Audio** | Gemini 2.5 Flash, Gemini 2.0 Flash, and all audio-capable Gemini models |
| **Video Generation** | Veo 2, Veo 3, and all Veo models |
| **Document Analysis** | All Gemini multimodal models (recommended: Gemini 2.5 Pro/Flash for large PDFs) |

---

## Credits

This project is a fork and extension of **[n8n-nodes-vertex-advanced](https://github.com/airesearch-official/n8n-nodes-vertex-advanced)** by [airesearch-official](https://github.com/airesearch-official), published under the MIT license.

**Changes made in this fork:**
- Added **Document resource** — analyze PDFs, images, and text files with Gemini multimodal models
- Dynamic model search for all resources — models fetched live from the API
- Package renamed to `n8n-nodes-vertex-ai-full` and node renamed to `Vertex AI Full`

---

## License

MIT
