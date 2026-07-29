# 🤖 ContentForge-AI

A stunning **Next.js & FastAPI web application** powered by an **8-agent AI pipeline** built with [CrewAI](https://crewai.com). It takes any topic and automatically produces a complete, publish-ready content package — including a blog post, Twitter thread, LinkedIn post, an email blurb, and a cover image (either AI-generated or custom-uploaded). You can then review and **manually approve** posting to Discord with a single click.

Runs efficiently using a dual-model approach with [Groq](https://console.groq.com) (Llama 3.3 70B & Llama 3.1 8B), [Serper](https://serper.dev) for web search, and [Pollinations.ai](https://pollinations.ai) for cover image generation (free, no key required).

---

## ✨ Features

- **Beautiful Next.js Frontend**: A sleek, dark-mode UI with glassmorphism effects, Framer Motion animations, and a responsive layout.
- **Persistent Session History**: A responsive left sidebar saves all your previous generated sessions using local storage — never lose past content.
- **FastAPI Backend with SSE Streaming**: A robust Python backend that runs the CrewAI pipeline and streams real-time logs to the frontend as they happen.
- **8 Autonomous Agents**: Specialized AI agents handle Topic Analysis, Research, SEO, Writing, Editing, Social Media adaptation, Image Prompting, and Publishing — all running sequentially.
- **Custom Image Upload & Free AI Image Generation**: 
  - **Custom Image Upload**: Attach your own custom image in the prompt bar to bypass AI image generation and use your image across all social cards and Discord posts.
  - **AI Generation**: If no image is provided, automatically generates a 1024×1024 cover image via [Pollinations.ai](https://pollinations.ai) (free, no API key needed).
- **Approval-Gated Discord Posting**: After content is generated, a dedicated **Discord** tab shows you an exact preview of the embed (title + summary + LinkedIn preview) before you post. Click **"Approve & Post to Discord"** to publish — nothing is ever sent automatically.
- **Robust JSON Control Character Parsing**: Backend (`json.loads(strict=False)` + re-serialization) and frontend fallback sanitization prevent string literal control-character errors (`\n`, `\t`) when parsing multiline LLM output.
- **Resilient LLM Calls**: A custom retry wrapper handles Groq free-tier rate limits (with smart wait-time parsing) *and* transient network socket drops (`ConnectionResetError`, `httpx.ConnectError`) with automatic backoff — so a flaky connection won't kill your run.
- **Free & Lightning Fast**: Powered by Groq's LPU inference. Fast 8B models handle simpler tasks (Topic Analyzer, SEO, Designer); the powerful 70B model handles complex reasoning and writing.

---

## 📋 Table of Contents

- [What It Does](#what-it-does)
- [How It Works — The 8-Agent Pipeline](#how-it-works--the-8-agent-pipeline)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [Discord Approval Flow](#discord-approval-flow)

---

## 🎯 What It Does

Enter a topic in the UI (e.g., *"The impact of AI agents on small business productivity"*), optionally attach a custom cover image, and watch live as the agents stream their progress in the terminal widget. The system ultimately generates:

| Output | Description |
|--------|-------------|
| 📊 Research angles | 3–5 focused subtopics (under 100 words) |
| 📚 Research notes | Facts, statistics, examples per angle |
| 🎯 SEO outline | Keyword list + H1/H2/H3 heading structure |
| ✍️ Blog post | Engaging 300–400 word Markdown article with emojis |
| ✅ Polished draft | Grammar-checked, flow-improved version |
| 🐦 Twitter thread | 5–7 tweet thread with hashtags & emojis |
| 💼 LinkedIn post | Professional post (up to 150 words) |
| 📧 Email blurb | Newsletter snippet (up to 150 words) |
| 🎨 Cover image | Custom-uploaded image OR AI 1024×1024 image via Pollinations.ai |
| 💬 Discord preview | Exact embed preview (title + summary + LinkedIn) before posting |

*All outputs are displayed in the UI, saved to your browser's persistent history, saved locally in the `outputs/` folder, and optionally published to Discord after your explicit approval.*

---

## 🧠 How It Works — The 8-Agent Pipeline

The system runs agents **sequentially** — each agent receives the output of the previous one as context.

| # | Agent | Model | Role |
|---|-------|-------|------|
| 1 | **Topic Analyzer** | Llama 3.1 8B | Breaks topic into 3–5 research angles (≤100 words) |
| 2 | **Research Agent** | Llama 3.3 70B | Gathers facts, stats & examples via web search (max 2 searches) |
| 3 | **SEO Agent** | Llama 3.1 8B | Builds keyword list + H1/H2/H3 outline |
| 4 | **Writer Agent** | Llama 3.3 70B | Writes the core blog post using research + outline |
| 5 | **Editor Agent** | Llama 3.3 70B | Proofreads, polishes grammar & flow |
| 6 | **Designer Agent** | Llama 3.1 8B | Repurposes post → Twitter / LinkedIn / Email (with word caps) |
| 7 | **Image Prompt Agent** | Llama 3.3 70B | Writes a vivid, descriptive prompt for the cover image |
| 8 | **Publisher Agent** | Llama 3.3 70B | Compiles everything into the final JSON package |

---

## 🔌 API Endpoints

The FastAPI backend exposes the following endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate` | `POST` | Accepts `{ topic, image_path? }` and returns an SSE event stream of execution logs and completion payload. |
| `/upload-image` | `POST` | Accepts a multipart image file (`UploadFile`) and saves it to `outputs/` for use in generation. |
| `/publish-discord` | `POST` | Accepts `{ content, image_path? }` and posts the formatted embed to the configured Discord Webhook. |
| `/outputs/*` | `GET` | Static file mount serving generated cover images and Markdown outputs. |

---

## 📂 Project Structure

```
agent_project/
│
├── api.py                 # FastAPI backend (SSE streaming, /generate, /upload-image, /publish-discord)
├── crew_setup.py          # CrewAI pipeline (8 agents, custom image handling, Pollinations image gen, Discord posting)
├── run_app.bat            # Windows script to launch both frontend and backend
├── requirements.txt       # Python backend dependencies
├── .env                   # Your API keys (never commit this!)
│
├── frontend/              # Next.js React application
│   ├── app/
│   │   ├── page.tsx       # Main UI: custom image picker, SSE streaming, tabs, Discord approve flow, sidebar
│   │   ├── globals.css    # Global styles & glassmorphism effects
│   ├── package.json       # Node.js frontend dependencies
│
├── outputs/               # Generated Markdown files, user uploads, & cover PNG images
│
└── venv/                  # Python virtual environment
```

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ (for Next.js)
- A free [Groq](https://console.groq.com) API key

### 1. Backend Setup (Python)
```powershell
# Create & activate a virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup (Node.js)
```powershell
cd frontend
npm install
```

### 3. API Keys (.env)
Create a `.env` file in the root `agent_project/` directory:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx        # Required
SERPER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx          # Optional — enables live web search
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... # Optional — enables Discord posting
```

> **Image generation** uses [Pollinations.ai](https://pollinations.ai) — completely free, no key needed.

> **Telemetry** is disabled by default (`CREWAI_DISABLE_TELEMETRY=true`, `OTEL_SDK_DISABLED=true`) so there are no background phone-home requests cluttering your logs.

---

## 🏃 Running the Application

### The Easy Way (Windows)
Double-click **`run_app.bat`** in the project folder.  
This opens two terminal windows — one for the backend, one for the frontend.

### The Manual Way

**Terminal 1 — Backend:**
```powershell
venv\Scripts\activate
uvicorn api:app --reload
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
```

### Viewing the App
Once both servers are running, open your browser:  
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 💬 Discord Approval Flow

1. After generation completes, click the **Discord** tab in the results panel.
2. A preview card shows the **exact embed** (title, summary, LinkedIn preview + cover image) that will be posted to your Discord channel.
3. Click **"Approve & Post to Discord"** to publish.
4. The button shows a loading spinner while posting, then switches to a green **"Posted to Discord ✓"** confirmation.
5. On failure, an inline error message appears and the button re-enables for a retry.

> Nothing is ever posted automatically — posting is always a deliberate user action.

---

## ⚖️ License
This project is for educational and personal use. Free to modify and extend.
