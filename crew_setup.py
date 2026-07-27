"""
Smart Content Creation & Publishing System
-------------------------------------------
A 7-agent CrewAI pipeline that takes a topic and produces a full content package.
"""

import os
import sys
import re
import io
import time
from datetime import datetime

# Fix Windows cp1252 terminal: force UTF-8 so Unicode from the LLM doesn't crash
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import litellm
from litellm.exceptions import RateLimitError as LiteLLMRateLimitError

# ── Rate-limit guard ─────────────────────────────────────────────────────────
# Groq free tier is strict on tokens-per-minute. This wrapper intercepts
# RateLimitError, reads the "try again in X.Xs" from the error body, sleeps
# exactly that long (+3 s buffer), then retries — up to 10 times.
_original_completion = litellm.completion

def _completion_with_backoff(**kwargs):
    for attempt in range(10):
        try:
            return _original_completion(**kwargs)
        except LiteLLMRateLimitError as e:
            if attempt == 9:
                raise
            match = re.search(r'try again in (\d+\.?\d*)s', str(e))
            wait = float(match.group(1)) + 3 if match else 45
            print(f"\n[RATE LIMIT] Waiting {wait:.0f}s then retrying "
                  f"(attempt {attempt + 1}/10)...")
            time.sleep(wait)

litellm.completion = _completion_with_backoff
# ─────────────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import SerperDevTool

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

if not GROQ_API_KEY or "your-real-key" in GROQ_API_KEY:
    print("ERROR: Missing or invalid GROQ_API_KEY in your .env file")
    print("Get a FREE key at: https://console.groq.com")
    sys.exit(1)

llm = LLM(
    model="groq/llama-3.3-70b-versatile",   # 12K TPM (highest on free tier)
    api_key=GROQ_API_KEY,
    temperature=0.4,
)

search_tool = SerperDevTool() if SERPER_API_KEY else None
tools_list = [search_tool] if search_tool else []

topic_analyzer = Agent(
    role="Topic Analyzer",
    goal="Break the given topic into 3-5 concrete research angles / subtopics",
    backstory="You are a content strategist who quickly identifies the most interesting and search-worthy angles on any topic.",
    llm=llm,
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
    llm=llm,
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
    llm=llm,
    verbose=True,
)

publisher = Agent(
    role="Publisher Agent",
    goal="Compile all final content pieces into a single publish-ready package with metadata",
    backstory="You are a publishing coordinator who assembles final deliverables for release.",
    llm=llm,
    verbose=True,
)


def build_tasks(topic: str):
    t1 = Task(
        description=f"Analyze the topic '{topic}'. Identify 3-5 concrete research angles worth investigating.",
        expected_output="A numbered list of 3-5 research angles with a one-line rationale each.",
        agent=topic_analyzer,
    )
    t2 = Task(
        description="Using the research angles provided, gather relevant facts, statistics, and examples for each one.",
        expected_output="Structured research notes grouped by angle, with sources noted where available.",
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
    t7 = Task(
        description="Compile the final blog post and repurposed formats into one publish-ready package with title, summary, timestamp.",
        expected_output="A JSON object with keys: title, summary, blog_post, twitter_thread, linkedin_post, email_blurb, generated_at.",
        agent=publisher,
        context=[t5, t6],
    )
    return [t1, t2, t3, t4, t5, t6, t7]


def run(topic: str):
    tasks = build_tasks(topic)
    crew = Crew(
        agents=[topic_analyzer, researcher, seo_agent, writer, editor, designer, publisher],
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
    return result


if __name__ == "__main__":
    topic_arg = " ".join(sys.argv[1:]) or "The future of AI agents in daily productivity"
    run(topic_arg)