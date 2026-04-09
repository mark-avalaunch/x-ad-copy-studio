# X Ad Copy Studio

Premium single-page web app for turning a website URL into a structured brand brief and usable X ad copy variations.

## What it does

- Scrapes a website through a Netlify Function and extracts a lightweight brand brief
- Shows editable fields for audience, offer, benefits, pain points, differentiators, proof, CTA, tone, and market context
- Generates X-native copy across single posts, short variants, threads, audience rewrites, angle explorer, hooks/CTAs, and creative prompts
- Adds a post-analysis competitor workflow that drafts plausible competitor ads and rewrites them against the active brand brief and tone
- Supports favorites, remix actions, selected export, history, comparison, and a realistic X preview panel
- Falls back to manual brief entry when scraping is weak or blocked

## Stack

- React 19
- TypeScript
- Vite
- Netlify Functions
- Cheerio
- OpenAI SDK for optional server-side competitor ad generation

## Local development

```bash
npm install
npm run dev
```

For local function development, use:

```bash
npm run dev:netlify
```

## Optional AI competitor generation

The competitor section uses `/.netlify/functions/competitor-ads`.

- If `OPENAI_API_KEY` is present in the Netlify environment, the function uses the OpenAI Responses API to draft plausible competitor ads and brand-aware alternatives.
- If no API key is present, the function falls back to local known-business profiles plus deterministic rewrites so the UI still works during development.

Optional env vars:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

## Build

```bash
npm run build
npm run lint
```

## Deploy

GitHub:

```bash
git push origin main
```

Netlify:

```bash
npx netlify-cli login
npx netlify-cli deploy --prod
```

If you want continuous deploys, connect the GitHub repo in Netlify and keep:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
