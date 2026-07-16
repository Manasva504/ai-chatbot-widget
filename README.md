# AI Chatbot Widget

A chat widget for small business websites that answers visitor questions
using only the business's own FAQ file.

## The thinking behind it

Most small businesses (bakeries, salons, gyms) answer the same questions
every day — "are you open on Sunday?", "do you deliver?", "how early do I
need to order a cake?". An AI chatbot could handle these, but normal LLM
chatbots hallucinate: they'll confidently invent opening hours or prices
that don't exist, which is worse than no chatbot at all.

So the core idea here is grounding. The backend never lets the model answer
from its own knowledge. On every request it reads the business's FAQ file
and sends it inside the system prompt with strict instructions: answer only
from this text, and if the answer isn't in it, say so and offer to connect
the visitor with a human. Ask it something outside the FAQ and it refuses
instead of guessing.

The second idea is reusability. Everything business-specific lives in one
markdown file (`backend/data/faq.md`) and a small config object on the
website. Swap those and the same code works for any business.

## Architecture

```
+-------------------+         +------------------+         +--------------+
|  any website      |  POST   |  FastAPI backend |         |  Gemini API  |
|  + widget.js      | ------> |  (app.py)        | ------> |  (free tier) |
|  (chat bubble UI) | /chat   |  FAQ + prompt    |         |              |
+-------------------+         +------------------+         +--------------+
```

- **widget.js** — one vanilla JS file, no frameworks, no build step. Renders
  the chat UI, keeps the recent conversation in memory (the LLM API is
  stateless, so history is re-sent with each message, capped at 20), and
  talks only to the backend.
- **app.py** — FastAPI server with a single `/chat` endpoint. Builds the
  FAQ-grounded prompt, calls Gemini, retries on transient 5xx errors, and
  maps failures to proper HTTP codes. The API key stays here, server-side —
  the browser never talks to Google directly.
- **faq.md** — the knowledge base. Read fresh on every request, so edits go
  live without a restart.

## Stack

Python / FastAPI / Uvicorn · Gemini API (`gemini-2.5-flash-lite`) · vanilla JS

`frontend/demo.html` is a fake(example) bakery site to see the widget working.
