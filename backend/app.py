"""FastAPI backend for the embeddable AI chat widget.

Answers visitor questions using only the business's FAQ content
(backend/data/faq.md), powered by the Google Gemini API free tier
(no credit card required — get a key at https://aistudio.google.com/apikey).
"""

import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --- Configuration -----------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
FAQ_PATH = BASE_DIR / "data" / "faq.md"

load_dotenv(BASE_DIR / ".env")

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Copy backend/.env.example to backend/.env "
        "and add your free Gemini API key from https://aistudio.google.com/apikey"
    )

# gemini-2.5-flash-lite has the most generous free-tier daily quota;
# swap to gemini-2.5-flash if you want slightly smarter answers.
MODEL = "gemini-2.5-flash-lite"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{MODEL}:generateContent"
)

app = FastAPI(title="AI Chatbot Widget Backend")

# CORS: allow all origins for local development / demo purposes.
# In production, lock this down to the real client domain, e.g.:
#   allow_origins=["https://www.clientbakery.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request / response models ------------------------------------------------


class HistoryMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = Field(default_factory=list)
    business_name: str = "this business"


# --- Helpers -------------------------------------------------------------------


def load_faq() -> str:
    """Read the FAQ file fresh from disk on every request so edits apply
    without restarting the server."""
    try:
        return FAQ_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"FAQ file not found at {FAQ_PATH}. Add your FAQ content there.",
        )


def build_system_prompt(business_name: str, faq_text: str) -> str:
    return f"""You are a friendly customer support assistant for {business_name}.

Answer the visitor's questions using ONLY the FAQ content provided below.
Keep your replies short and helpful: 2-4 sentences.

If the answer is not in the FAQ, say you don't have that information and
offer to connect the visitor with a human team member. NEVER invent or
guess opening hours, prices, policies, or any other details that are not
explicitly listed in the FAQ.

--- FAQ CONTENT ---
{faq_text}
--- END FAQ CONTENT ---"""


# --- Routes ---------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/chat")
def chat(request: ChatRequest) -> dict:
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    faq_text = load_faq()
    system_prompt = build_system_prompt(request.business_name, faq_text)

    # Gemini uses "user" / "model" roles (the widget sends "assistant")
    contents = [
        {
            "role": "model" if m.role == "assistant" else "user",
            "parts": [{"text": m.content}],
        }
        for m in request.history
        if m.role in ("user", "assistant") and m.content.strip()
    ]
    contents.append({"role": "user", "parts": [{"text": request.message}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 400},
    }

    # Google's free tier occasionally returns transient 500/503 "overloaded"
    # errors — retry a couple of times before giving up so visitors never
    # see an error for a momentary blip.
    max_attempts = 3
    response = None
    last_error = None
    for attempt in range(max_attempts):
        if attempt > 0:
            time.sleep(1.5 * attempt)  # 1.5s, then 3s
        try:
            response = requests.post(
                GEMINI_URL,
                json=payload,
                headers={"x-goog-api-key": API_KEY},
                timeout=30,
            )
        except requests.RequestException as e:
            last_error = str(e)
            response = None
            continue
        if response.status_code in (500, 503, 529):
            last_error = f"HTTP {response.status_code}"
            continue
        break

    if response is None:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach the AI service: {last_error}",
        )
    if response.status_code == 429:
        raise HTTPException(
            status_code=502,
            detail="The free-tier rate limit was hit. Please wait a minute and try again.",
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"The AI service returned an error (HTTP {response.status_code}).",
        )

    try:
        data = response.json()
        parts = data["candidates"][0]["content"]["parts"]
        reply = "".join(p.get("text", "") for p in parts).strip()
    except (KeyError, IndexError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an unexpected response format.",
        )

    return {"reply": reply}
