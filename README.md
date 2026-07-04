# AI Chatbot Widget

A chat widget you can drop into any small business website. It answers visitor
questions (opening hours, delivery, pricing etc.) using only the FAQ file you
give it, so it doesn't make up information like normal chatbots tend to do.

I built this after noticing that most local businesses answer the same
questions on calls/WhatsApp all day. The idea is: swap one markdown file and
this works for any business, whether it's a bakery, salon or a gym.

The demo included here is a fictional bakery site (`frontend/demo.html`).

## How it works

```
widget.js (on the website)  -->  FastAPI backend  -->  Gemini API
```

- The widget is plain vanilla JS, no frameworks, no build step. It just POSTs
  the user's message to the backend.
- The backend reads `data/faq.md`, puts it inside the system prompt with strict
  instructions ("answer ONLY from this FAQ, if it's not there say so and offer
  a human"), and calls Gemini.
- The API key stays on the server. The browser never talks to Google directly.

Why this stops hallucination: the model is never asked to answer from its own
knowledge. Everything it says has to come from the FAQ text sent with each
request. If you ask something that's not in the FAQ (try "do you sell
coffee?"), it says it doesn't know instead of guessing.

## Tech stack

- **Backend:** Python, FastAPI, Uvicorn
- **LLM:** Gemini API (`gemini-2.5-flash-lite`) - free tier, no card needed
- **Frontend:** single vanilla JS file (~200 lines), works on any site

## Running it locally

You need Python 3.13+ and a free Gemini API key from
https://aistudio.google.com/apikey

```bash
cd backend
pip install -r requirements.txt

# put your key in a .env file
cp .env.example .env       # (copy on windows)
# edit .env -> GEMINI_API_KEY=your_key

python -m uvicorn app:app --reload --port 8000
```

Check http://localhost:8000/health returns `{"status":"ok"}`, then open
`frontend/demo.html` in your browser and click the chat bubble.

## Using it on a real site

Only two tags needed before `</body>`:

```html
<script>
  window.ChatWidgetConfig = {
    apiUrl: "https://your-deployed-backend.com",
    businessName: "Business Name",
    primaryColor: "#b45309",
    greeting: "Hi! Ask me about our hours, delivery or pricing."
  };
</script>
<script src="widget.js"></script>
```

Then replace `backend/data/faq.md` with the business's actual FAQ. The file is
read on every request so edits show up instantly without restarting.

For deployment I'd put the backend on Render/Railway free tier (set
`GEMINI_API_KEY` as an env var there) and remember to change
`allow_origins=["*"]` in `app.py` to the actual site domain.

## Some decisions I made

- **No framework for the widget** - it gets injected into other people's
  sites, so it has to be small and can't conflict with whatever they're
  running. It's wrapped in an IIFE and injects its own CSS.
- **FAQ as a file, not a DB** - one file per client is the whole point.
  A database would be overkill until there's an admin UI.
- **History capped at 20 messages** - the LLM API is stateless so the widget
  resends recent history each time. The cap keeps token costs bounded.
- **Retries on 5xx** - Gemini free tier occasionally throws a random 503, so
  the backend retries twice with a small backoff before showing an error.
- **429 is not retried** - if the free tier rate limit is hit, retrying
  immediately just makes it worse.

## Things I want to add

- [ ] Log conversations to SQLite so the owner can see what people actually ask
- [ ] "Talk to a human" button that opens WhatsApp with the business number
- [ ] Serve multiple businesses from one backend (`/chat?client=xyz` ->
      `data/xyz/faq.md`)
- [ ] Rate limiting per IP
