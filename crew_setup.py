"""
Smart Content Creation & Publishing System
-------------------------------------------
A 7-agent CrewAI pipeline that takes a topic and produces a full content package,
generates a cover image (Gemini -> Pollinations fallback), and auto-posts the
result to Discord via webhook.

SPEED NOTE: Uses two Groq models -- a fast 8B model for simple agents
(Topic Analyzer, SEO Agent, Designer Agent) and the larger 70B model only for
agents that need stronger reasoning/writing quality (Research, Writer, Editor,
Publisher, Image Prompt). This reduces rate-limit waits significantly.
"""

import os
import sys
import re
import io
import json
import time
import requests
import urllib.parse
import base64
from datetime import datetime

# Fix Windows cp1252 terminal: force UTF-8 so Unicode from the LLM doesn't crash
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import litellm
from litellm.exceptions import RateLimitError as LiteLLMRateLimitError

# Rate-limit guard: Groq free tier is strict on tokens-per-minute. This wrapper
# intercepts RateLimitError, reads the "try again in X.Xs" from the error body,
# sleeps that long (+3s buffer), then retries -- up to 4 times (reduced from
# 10 so a persistent limit fails fast instead of stalling many minutes).
_original_completion = litellm.completion

def _completion_with_backoff(**kwargs):
    for attempt in range(4):
        try:
            return _original_completion(**kwargs)
        except LiteLLMRateLimitError as e:
            if attempt == 3:
                raise
            match = re.search(r'try again in (\d+\.?\d*)s', str(e))
            wait = float(match.group(1)) + 3 if match else 30
            print(f"\n[RATE LIMIT] Waiting {wait:.0f}s then retrying "
                  f"(attempt {attempt + 1}/4)...")
            time.sleep(wait)

litellm.completion = _completion_with_backoff

from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import SerperDevTool

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

if not GROQ_API_KEY or "your-real-key" in GROQ_API_KEY:
    print("ERROR: Missing or invalid GROQ_API_KEY in your .env file")
    print("Get a FREE key at: https://console.groq.com")
    sys.exit(1)

# Fast model - for simple agents (quick responses, higher free-tier headroom)
llm_fast = LLM(
    model="groq/llama-3.1-8b-instant",
    api_key=GROQ_API_KEY,
    temperature=0.4,
)

# Powerful model - only for agents that need stronger reasoning/writing
llm = LLM(
    model="groq/llama-3.3-70b-versatile",
    api_key=GROQ_API_KEY,
    temperature=0.4,
)

search_tool = SerperDevTool() if SERPER_API_KEY else None
tools_list = [search_tool] if search_tool else []

# Agents

topic_analyzer = Agent(
    role="Topic Analyzer",
    goal="Break the given topic into 3-5 concrete research angles / subtopics",
    backstory="You are a content strategist who quickly identifies the most interesting and search-worthy angles on any topic.",
    llm=llm_fast,
    verbose=True,
)

researcher = Agent(
    role="Research Agent",
    goal="Gather accurate, up-to-date facts and data points for each research angle",
    backstory="You are a meticulous researcher who finds credible facts and always notes sources.",
    tools=tools_list,
    llm=llm,
    verbose=True,
)

seo_agent = Agent(
    role="SEO Agent",
    goal="Produce a keyword list and a heading/outline structure optimized for search",
    backstory="You are an SEO specialist who structures content for readability and search visibility.",
    llm=llm_fast,
    verbose=True,
)

writer = Agent(
    role="Writer Agent",
    goal="Write a well-structured, engaging long-form blog post using the research and SEO plan",
    backstory="You are a skilled content writer who turns research into clear, engaging articles.",
    llm=llm,
    verbose=True,
)

editor = Agent(
    role="Editor Agent",
    goal="Proofread and polish the draft for clarity, flow, grammar, and tone consistency",
    backstory="You are a sharp-eyed editor who improves clarity without changing the author's voice.",
    llm=llm,
    verbose=True,
)

designer = Agent(
    role="Designer Agent",
    goal="Reformat the article into a Twitter thread, LinkedIn post, and email newsletter",
    backstory="You are a social media specialist who adapts long-form content into platform-native formats.",
    llm=llm_fast,
    verbose=True,
)

publisher = Agent(
    role="Publisher Agent",
    goal="Compile all final content pieces into a single publish-ready package with metadata",
    backstory="You are a publishing coordinator who assembles final deliverables for release.",
    llm=llm,
    verbose=True,
)

image_prompt_agent = Agent(
    role="Image Prompt Agent",
    goal="Create a highly descriptive image generation prompt based on the article content.",
    backstory="You are an expert art director who writes vivid, highly descriptive prompts for AI image generators.",
    llm=llm,
    verbose=True,
)


# Tasks

def build_tasks(topic: str):
    t1 = Task(
        description=f"Analyze the topic '{topic}'. Identify 3-5 concrete research angles worth investigating.",
        expected_output="A numbered list of 3-5 research angles with a one-line rationale each.",
        agent=topic_analyzer,
    )
    t2 = Task(
        description="Using the research angles provided, perform AT MOST 2 targeted web searches total "
                    "(not one per angle) to gather the most important facts and statistics. Be efficient "
                    "and combine related angles into fewer, broader searches.",
        expected_output="Structured research notes grouped by angle, max 150 words total, with sources noted.",
        agent=researcher,
        context=[t1],
    )
    t3 = Task(
        description=f"Based on the topic '{topic}' and research notes, produce an SEO keyword list and a heading outline.",
        expected_output="A keyword list and full heading outline (H1/H2/H3) for the article.",
        agent=seo_agent,
        context=[t2],
    )
    t4 = Task(
        description=f"Write a short, engaging blog post (300-400 words) on '{topic}' using the research and SEO outline. Keep it concise.",
        expected_output="A short blog post in Markdown, following the SEO heading structure. Max 400 words.",
        agent=writer,
        context=[t2, t3],
    )
    t5 = Task(
        description="Proofread and polish the draft blog post for grammar, clarity, and flow. Keep Markdown structure.",
        expected_output="The final polished blog post in Markdown.",
        agent=editor,
        context=[t4],
    )
    t6 = Task(
        description="Repurpose the polished post into: (1) a short 3-tweet thread, (2) a short LinkedIn post (50-75 words), (3) an email blurb (50 words).",
        expected_output="Three concise labeled sections: TWITTER THREAD, LINKEDIN POST, EMAIL BLURB.",
        agent=designer,
        context=[t5],
    )
    t7_img = Task(
        description="Read the edited blog post. Produce ONE descriptive image-generation prompt (under 40 words) focusing on subject, art style, lighting/mood, and color palette. No text/words to be rendered in the image.",
        expected_output="A single descriptive prompt string under 40 words.",
        agent=image_prompt_agent,
        context=[t5],
    )
    t8 = Task(
        description="Compile the final blog post and repurposed formats into one publish-ready package with title, summary, timestamp.",
        expected_output="A JSON object with keys: title, summary, blog_post, twitter_thread, linkedin_post, email_blurb, generated_at.",
        agent=publisher,
        context=[t5, t6],
    )
    return [t1, t2, t3, t4, t5, t6, t7_img, t8]


# Image generation (Gemini -> Pollinations fallback)

def generate_image(image_prompt: str, img_path: str) -> bool:
    """Generates a cover image. Tries Hugging Face SDXL first (if HF_API_KEY is set),
    falls back to Pollinations.ai (free, no key required)."""
    success = False
    hf_key = os.getenv("HF_API_KEY")

    if hf_key:
        try:
            print("Generating image with Hugging Face SDXL...")
            url = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
            headers = {"Authorization": f"Bearer {hf_key}"}
            for attempt in range(3):
                resp = requests.post(
                    url,
                    headers=headers,
                    json={"inputs": image_prompt},
                    timeout=90,
                )
                if resp.status_code == 503:
                    wait = resp.json().get("estimated_time", 20)
                    print(f"HF model loading, waiting {int(min(wait, 30))}s (attempt {attempt+1}/3)...")
                    time.sleep(min(wait, 30))
                    continue
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                    with open(img_path, "wb") as f:
                        f.write(resp.content)
                    success = True
                    break
                else:
                    print(f"Hugging Face API error: {resp.status_code} - {resp.text[:300]}")
                    break
        except Exception as e:
            print(f"Hugging Face generation failed: {e}")

    if not success:
        print("Generating image with Pollinations.ai...")
        try:
            encoded_prompt = urllib.parse.quote(image_prompt)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
            resp = requests.get(url, timeout=60)
            if resp.status_code == 200:
                with open(img_path, "wb") as f:
                    f.write(resp.content)
                success = True
            else:
                print(f"Pollinations API error: {resp.status_code}")
        except Exception as e:
            print(f"Pollinations generation failed: {e}")

    return success


# Discord auto-post

def post_to_discord(text_content: str, image_path: str | None = None) -> bool:
    """Posts the final content (and optional image) to a Discord channel via webhook."""
    if not DISCORD_WEBHOOK_URL:
        print("No DISCORD_WEBHOOK_URL set in .env -- skipping Discord post.")
        return False

    # Try to parse the raw JSON to format a beautiful Discord message
    try:
        raw_str = text_content.strip()
        if raw_str.startswith("```json"):
            raw_str = raw_str[7:]
        if raw_str.startswith("```"):
            raw_str = raw_str[3:]
        if raw_str.endswith("```"):
            raw_str = raw_str[:-3]
            
        data_json = json.loads(raw_str)
        title = data_json.get("title", "New Post")
        summary = data_json.get("summary", "")
        linkedin_post = data_json.get("linkedin_post", "")
        
        message = f"🚀 **{title}** 🚀\n\n"
        if summary:
            message += f"📖 **Summary:**\n{summary}\n\n"
        if linkedin_post:
            message += f"💡 **Preview:**\n{linkedin_post}\n"
            
        message = message[:4000] # Embed descriptions can be up to 4096 chars
    except Exception:
        # Fallback to raw text if parsing fails
        message = text_content[:4000]

    try:
        if image_path and os.path.exists(image_path):
            filename = os.path.basename(image_path)
            with open(image_path, "rb") as f:
                files = {"file": (filename, f, "image/png")}
                embed = {
                    "title": "✨ New Content Published ✨",
                    "description": message,
                    "color": 3447003, # Blue color
                    "image": {
                        "url": f"attachment://{filename}"
                    }
                }
                payload = {"payload_json": json.dumps({"embeds": [embed]})}
                resp = requests.post(DISCORD_WEBHOOK_URL, data=payload, files=files)
        else:
            embed = {
                "title": "✨ New Content Published ✨",
                "description": message,
                "color": 3447003
            }
            payload = {"payload_json": json.dumps({"embeds": [embed]})}
            resp = requests.post(DISCORD_WEBHOOK_URL, data=payload)

        if resp.status_code in (200, 204):
            print("Successfully posted to Discord!")
            return True
        else:
            print(f"Discord post failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"Discord post error: {e}")
        return False


# Main run

def run(topic: str):
    tasks = build_tasks(topic)
    crew = Crew(
        agents=[topic_analyzer, researcher, seo_agent, writer, editor, designer, image_prompt_agent, publisher],
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()

    os.makedirs("outputs", exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = f"outputs/result_{stamp}.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(str(result))

    print(f"\nDone! Full output saved to {out_path}")

    image_prompt = str(getattr(tasks[6].output, 'raw', tasks[6].output))
    img_path = f"outputs/cover_{stamp}.png"
    img_success = generate_image(image_prompt, img_path)

    if img_success:
        print(f"Image saved to {img_path}")

    post_to_discord(str(result), img_path if img_success else None)

    return result


if __name__ == "__main__":
    topic_arg = " ".join(sys.argv[1:]) or "The future of AI agents in daily productivity"
    run(topic_arg)