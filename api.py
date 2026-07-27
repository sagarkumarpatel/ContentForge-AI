import subprocess
import os
import sys
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

app = FastAPI()

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            bufsize=1, # Line buffered
            env=env
        )

        final_output_path = None

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
                
                yield {
                    "event": "message",
                    "data": json.dumps({"type": "complete", "content": cleaned})
                }
        else:
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": "Failed to find final output file."})
            }

    return EventSourceResponse(event_generator())
