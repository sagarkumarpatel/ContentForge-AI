import subprocess
import os
import sys
import json
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from fastapi.staticfiles import StaticFiles
import requests
from crew_setup import post_to_discord, build_discord_message

app = FastAPI()

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("outputs", exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

class GenerateRequest(BaseModel):
    topic: str

@app.post("/generate")
async def generate_content(req: GenerateRequest, request: Request):
    async def event_generator():
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        python_exe = sys.executable
        
        # Run the crew pipeline in a subprocess so we can stream its stdout
        process = subprocess.Popen(
            [python_exe, "crew_setup.py", req.topic],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # Merge stderr into stdout
            text=True,
            encoding="utf-8",
            bufsize=1, # Line buffered
            env=env
        )

        final_output_path = None
        image_url = None
        discord_posted = False

        # Read line by line as it comes out
        for line in process.stdout:
            # Stop if the client disconnects
            if await request.is_disconnected():
                process.terminate()
                break
            
            line_str = line.strip()
            if not line_str:
                continue

            # Look for the final output path
            if "Done! Full output saved to" in line_str:
                final_output_path = line_str.split("Done! Full output saved to ")[1].strip()
                
            # Look for image saved path
            if "Image saved to" in line_str:
                image_path = line_str.split("Image saved to ")[1].strip()
                image_url = "/" + image_path.replace("\\", "/")
                
            # Look for discord post success
            if "Successfully posted to Discord!" in line_str:
                discord_posted = True

            yield {
                "event": "message",
                "data": json.dumps({"type": "log", "content": line_str})
            }
        
        process.wait()
        
        # Once finished, read the output file and send it to the client
        if final_output_path and os.path.exists(final_output_path):
            with open(final_output_path, "r", encoding="utf-8") as f:
                content = f.read()
                
                # Try to clean markdown formatting (like ```json) if the LLM added it
                cleaned = content.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                
                payload = {
                    "type": "complete", 
                    "content": cleaned,
                    "discord_posted": discord_posted,
                    "discord_preview": build_discord_message(cleaned)
                }
                if image_url:
                    payload["image_url"] = image_url

                yield {
                    "event": "message",
                    "data": json.dumps(payload)
                }
        else:
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": "Failed to find final output file."})
            }

    return EventSourceResponse(event_generator())

class PublishRequest(BaseModel):
    content: str
    image_path: Optional[str] = None

@app.post("/publish-discord")
async def api_publish_discord(req: PublishRequest):
    local_image_path = None
    if req.image_path:
        if req.image_path.startswith("/outputs/"):
            local_image_path = req.image_path.lstrip("/")
        else:
            local_image_path = req.image_path

    success = post_to_discord(req.content, local_image_path)
    if success:
        return {"posted": True}
    else:
        return {"posted": False, "error": "Failed to post to Discord"}

