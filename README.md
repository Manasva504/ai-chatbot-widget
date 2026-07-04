# AI Chatbot Widget for Small Business Websites

An embeddable AI chat widget that answers website visitors' questions using
**only the business's own FAQ content** — no hallucinated hours, prices, or
policies. Powered by the Google Gemini API **free tier** (no credit card
needed) with a FastAPI backend and a single dependency-free JavaScript file
on the frontend.

## The Freelance Pitch

Most small businesses (bakeries, salons, clinics, gyms, tutors) answer the
same 10 questions over and over on phone and WhatsApp: *"Are you open on
Sunday?"*, *"Do you deliver?"*, *"How far in advance do I order a cake?"*

This project is a **reusable template** for selling that solution:

1. Swap one Markdown file (`backend/data/faq.md`) with the client's FAQ.
2. Change two config values (business name, brand color).
3. Deploy the backend once, hand the client two `<script>` tags.

Same codebase, new client, ~1 hour of work per deployment. The demo ships with
a fictional bakery ("Bloom & Co Bakery") so you can show it working end-to-end.

## Architecture

```
┌─────────────────────┐        POST /chat         ┌──────────────────────┐
│  Client's website   │  { message, history,      │   FastAPI backend    │
│  ┌───────────────┐  │    business_name }        │  (backend/app.py)    │
│  │  widget.js    │ ─┼──────────────────────────▶│                      │
│  │  (chat bubble │  │                           │  reads faq.md fresh  │
│  │   + window)   │ ◀┼───────────────────────────│  per request, builds │
│  └───────────────┘  │      { reply }            │  system prompt       │
└─────────────────────┘                           └──────────┬───────────┘
                                                             │ generateContent
                                                             │ (FAQ-grounded
                                                             │  system prompt)
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │   Google Gemini API  │
                                                  │ (gemini-2.5-flash-   │
                                                  │  lite, free tier)    │
                                                  └──────────────────────┘
```

The system prompt instructs the model to answer **only** from the FAQ text and
to offer a human handoff when the answer isn't there — this is what keeps it
from inventing information.

## Project Structure

```
ai-chatbot-widget/
  backend/
    app.py            # FastAPI service (health check + /chat endpoint)
    requirements.txt
    .env.example      # copy to .env and add your Anthropic API key
    data/faq.md       # THE file you swap per client
  frontend/
    widget.js         # self-contained embeddable widget (no build step)
    demo.html         # fake bakery landing page showcasing the widget
  README.md
```

## Setup & Run Locally

### Backend

```bash
cd ai-chatbot-widget/backend

# 1. Install dependencies (a virtualenv is recommended)
pip install -r requirements.txt

# 2. Configure your API key (FREE — no credit card required)
#    Get one at https://aistudio.google.com/apikey (sign in with Google,
#    click "Create API key", copy it)
copy .env.example .env        # Windows  (macOS/Linux: cp .env.example .env)
# ...then edit .env and paste your Gemini API key

# 3. Start the server
uvicorn app:app --reload --port 8000
```

Verify it's up: open <http://localhost:8000/health> — you should see
`{"status": "ok"}`.

### Frontend

No build step. Either:

- Just open `frontend/demo.html` directly in your browser, **or**
- Use the VS Code **Live Server** extension on `frontend/` (nicer for
  development — auto-reloads on save).

Click the chat bubble in the bottom-right corner and ask something like
*"Do you have eggless cakes?"* or *"What are your Sunday hours?"*

## Re-targeting This for a Real Client

1. **Swap the FAQ:** replace the contents of `backend/data/faq.md` with the
   client's real FAQ (hours, prices, policies, contact info). The file is
   re-read on every request, so edits apply instantly — no restart needed.
2. **Update the widget config** in the client's site:
   ```html
   <script>
     window.ChatWidgetConfig = {
       apiUrl: "https://your-backend.onrender.com",
       businessName: "Client Business Name",
       primaryColor: "#b45309",
       greeting: "Hi! Ask me about our services, hours, or pricing."
     };
   </script>
   <script src="https://your-cdn-or-backend/widget.js"></script>
   ```
3. **Deploy the backend** on Render or Railway (both have free tiers):
   set the `GEMINI_API_KEY` environment variable in the dashboard and use
   `uvicorn app:app --host 0.0.0.0 --port $PORT` as the start command.
4. **Hand the client the two script tags** above — that's the entire
   integration on their end. Works with WordPress, Wix custom code blocks,
   Shopify themes, or any hand-rolled site.

## Deployment Notes

- **Lock down CORS.** `app.py` ships with `allow_origins=["*"]` for local
  development. In production, set it to the client's real domain(s) only,
  e.g. `allow_origins=["https://www.clientbakery.com"]`.
- **Keep the API key server-side only.** The key lives in the backend's
  environment (`.env` locally, environment variables in Render/Railway).
  It must never appear in `widget.js` or any frontend code — the browser only
  ever talks to *your* backend.
- **Model choice & free-tier limits.** The backend uses `gemini-2.5-flash-lite`
  because it has the most generous free-tier quota (roughly 15 requests/minute
  and ~1,000 requests/day — check https://ai.google.dev/pricing for current
  numbers). That's plenty for a demo or a low-traffic small-business site.
  Swapping the `MODEL` constant to `gemini-2.5-flash` (smarter, lower free
  quota) is a one-line change. If a paying client ever outgrows the free tier,
  you can enable billing on the same key or switch providers — only `app.py`
  changes; the widget stays identical.

## Ideas to Extend

- **Conversation logging to SQLite** — store question/answer pairs per client
  so the business can see what visitors actually ask (and improve the FAQ).
- **Human handoff button** — when the bot can't answer, show a "Chat on
  WhatsApp" / "Email us" button with the business's real contact details.
- **Multi-client support** — serve several businesses from one backend by
  keying FAQ files off a query param or API key (e.g. `POST /chat?client=bloomco`
  loads `data/bloomco/faq.md`), so one deployment serves your whole client roster.
- Rate limiting per IP to keep API costs predictable.
- A tiny admin page where the client can edit their FAQ file themselves.
