import os, requests
from dotenv import load_dotenv
load_dotenv()

hf_key = os.getenv("HF_API_KEY")
if not hf_key:
    print("ERROR: HF_API_KEY not found in .env")
else:
    print(f"HF_API_KEY found: {hf_key[:10]}...")
    url = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {hf_key}"},
        json={"inputs": "a red apple on a wooden table"},
        timeout=30
    )
    print(f"Status: {resp.status_code}")
    ct = resp.headers.get("content-type", "")
    print(f"Content-Type: {ct}")
    if resp.status_code == 200 and ct.startswith("image"):
        print("SUCCESS: Hugging Face is working! Image returned.")
    else:
        print(f"Response: {resp.text[:400]}")
