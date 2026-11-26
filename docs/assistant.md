# Website chat assistant

The "Ask ANLIMA" button on public pages opens a chat assistant powered by Claude (Anthropic). It helps visitors choose a car, check availability and prices, and understand how booking works.

## Turn it on

Create an API key at console.anthropic.com and add it to the server environment (`.env` locally). Do not commit it or paste it into chat.

```
ANTHROPIC_API_KEY=
ASSISTANT_DAILY_LIMIT=500   # optional: most chat requests per 24 hours across the site
```

Restart the app. Until the key is set, the chat button is hidden.

## What it can and cannot do

- It answers from live data through three read-only tools (`src/lib/assistant/tools.ts`): the cars on offer and their prices, whether a car is free for given dates (with the exact quote), and ANLIMA's current fees and cancellation terms from Fees & settings.
- It cannot see or change any customer's bookings, payments or personal details, and cannot book. For existing bookings, refunds, accidents or complaints it directs people to the Contact page.
- Its instructions are in `src/lib/assistant/prompt.ts`. Edit that file to change its tone or what it says about ANLIMA.

## Model and costs

- Model: Claude Opus 5.5 at low effort, which suits quick chat. Replies are capped at 4,000 tokens and conversations at 20 turns.
- If Opus declines a message on safety grounds, the request is automatically re-run on a fallback model chosen by Anthropic (`fallbacks: "default"`), so the visitor still gets an answer.
- The instructions are marked for prompt caching to lower the cost of repeated requests.
- Limits: 20 messages per visitor every 10 minutes, and `ASSISTANT_DAILY_LIMIT` requests per day across the site. Set a monthly spend limit in the Anthropic console as well.

## Privacy

Conversations are kept only in the visitor's browser and are not stored by ANLIMA. Only a keyed hash of the visitor's address is stored briefly, for rate limiting. Messages are sent to Anthropic to generate replies, so mention the assistant in the privacy notice. The chat asks visitors not to share card, Ghana Card or licence numbers.

## Tests

`npm run test:assistant` runs the chat route against a local stand-in for the Anthropic API (nothing is sent to Anthropic): streaming, the tool loop over live fleet data, refusals, input validation and rate limits.
