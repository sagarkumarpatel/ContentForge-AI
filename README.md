# 🤖 ContentForge-AI

A stunning **Next.js & FastAPI web application** powered by an **8-agent AI pipeline** built with [CrewAI](https://crewai.com). It takes any topic and automatically produces a complete, publish-ready content package — including a blog post, Twitter thread, LinkedIn post, an email blurb, and a generated cover image. It can even auto-post directly to Discord!

Runs efficiently using a dual-model approach with [Groq](https://console.groq.com) (Llama 3.3 70B & Llama 3.1 8B), [Serper](https://serper.dev) for web search, and Gemini Imagen 3 for cover images.

---

## ✨ Features

- **Beautiful Next.js Frontend**: A sleek, dark-mode UI with glassmorphism effects, Framer Motion animations, and a responsive layout.
- **Persistent Search History**: A responsive left sidebar saves and displays all your previous generated sessions using local storage—never lose past content.
- **FastAPI Backend**: A robust Python backend that runs the CrewAI pipeline and streams real-time logs to the frontend via Server-Sent Events (SSE).
- **8 Autonomous Agents**: Specialized AI agents handle Topic Analysis, Research, SEO, Writing, Editing, Social Media adaptation, Image Prompting, and Publishing sequentially.
- **Image Generation**: Automatically creates a highly-descriptive prompt and generates a cover image via Gemini Imagen (with a Pollinations.ai fallback).
- **Discord Auto-Posting**: Pushes beautifully formatted Discord embeds with the cover image attached directly to your server via Webhooks.
- **Free & Lightning Fast**: Powered by Groq's LPU inference. Fast 8B models handle simpler tasks, while the powerful 70B model handles complex reasoning and writing to optimize rate limits.

---

## 📋 Table of Contents

- [What It Does](#what-it-does)
- [How It Works — The 8-Agent Pipeline](#how-it-works--the-8-agent-pipeline)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)

---

## 🎯 What It Does

Enter a topic in the UI (e.g., *"The impact of AI agents on small business productivity"*), and watch live as the agents stream their progress in the terminal widget. The system ultimately generates:

| Output | Description |
|--------|-------------|
| 📊 Research angles | 3–5 focused subtopics to investigate |
| 📚 Research notes | Facts, statistics, examples per angle |
| 🎯 SEO outline | Keyword list + H1/H2/H3 heading structure |
| ✍️ Blog post | Short, engaging 300–400 word Markdown article |
| ✅ Polished draft | Grammar-checked, flow-improved version |
| 🐦 Twitter thread | 3-tweet thread ready to post |
| 💼 LinkedIn post | Short, professional post |
| 📧 Email blurb | Quick newsletter snippet |
| 🎨 Cover Image | A generated image based on the article's theme |

*All final outputs are displayed cleanly in the UI, saved into your browser's persistent history, saved locally in the `outputs/` folder, and optionally published to Discord.*

---

## 🧠 How It Works — The 8-Agent Pipeline

The system runs agents **sequentially** — each agent receives the output of the previous one as context.

| # | Agent | Role |
|---|-------|------|
| 1 | **Topic Analyzer** | Breaks topic into 3-5 research angles |
| 2 | **Research Agent** | Gathers facts, stats & examples via web search |
| 3 | **SEO Agent** | Builds keyword list + H1/H2/H3 outline |
| 4 | **Writer Agent** | Writes the core blog post using research + outline |
| 5 | **Editor Agent** | Proofreads, polishes grammar & flow |
| 6 | **Designer Agent** | Repurposes post → Twitter / LinkedIn / Email |
| 7 | **Image Prompt Agent** | Writes a vivid, descriptive prompt for the cover image |
| 8 | **Publisher Agent** | Compiles everything into the final JSON package |

---

## 📂 Project Structure

```
agent_project/
│
├── api.py                 # FastAPI backend (handles streaming & execution)
├── crew_setup.py          # Core CrewAI logic (Agents, Tasks, Image Gen, Discord)
├── run_app.bat            # Windows script to launch both Frontend and Backend
├── requirements.txt       # Python backend dependencies
├── .env                   # Your API keys (never commit this to Git!)
│
├── frontend/              # Next.js React application
│   ├── app/
│   │   ├── page.tsx       # Main UI page, SSE streaming, sidebar & local storage history
│   │   ├── globals.css    # Tailwind styling & Glassmorphism
│   ├── package.json       # Node.js frontend dependencies
│
├── outputs/               # Generated Markdown and PNG cover images
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
Create a `.env` file in the root `agent_project` directory and add your keys:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SERPER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    # Optional, for web search
GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx    # Optional, for cover images (falls back to Pollinations if missing)
DISCORD_WEBHOOK_URL=https://discord.com/api/...    # Optional, for auto-posting completed packages
```

*Note: The pipeline is heavily optimized to keep token usage low and avoid Groq free-tier rate limits by employing a smart backoff strategy and model-routing.*

---

## 🏃 Running the Application

### The Easy Way (Windows)
Simply double-click the **`run_app.bat`** file in the project folder! 
This will automatically open two terminal windows (one for the backend, one for the frontend).

### The Manual Way
**Terminal 1 (Backend):**
```powershell
venv\Scripts\activate
uvicorn api:app --reload
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```

### Viewing the App
Once both servers are running, open your browser and go to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ⚖️ License
This project is for educational and personal use. Free to modify and extend.
