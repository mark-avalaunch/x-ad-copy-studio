# X Ad Copy Studio

Premium single-page web app for turning a website URL into a structured brand template and usable X ad copy variations.

## What it does

- Sends the URL through a Netlify Function that uses OpenAI plus live web search to extract a lightweight brand template
- Shows a readable brand template with optional edit mode for audience, offer, benefits, pain points, differentiators, proof, CTA, tone, and market context
- Generates X-native copy across single posts, short variants, threads, audience rewrites, angle explorer, hooks/CTAs, and creative prompts
- Adds a post-analysis competitor workflow that drafts plausible competitor ads and rewrites them against the active brand template and tone
- Supports favorites, remix actions, selected export, history, comparison, and a realistic X preview panel
- Falls back to manual template entry when extraction is weak or blocked

## Stack

- React 19
- TypeScript
- Vite
- Netlify Functions
- Cheerio
- OpenAI SDK for server-side URL analysis and optional competitor ad generation

## Local development

```bash
npm install
npm run dev
```

For local function development, use:

```bash
npm run dev:netlify
```

## AI URL analysis

The URL analysis step uses `/.netlify/functions/analyze`.

- If `OPENAI_API_KEY` is present in the Netlify environment, the function uses the OpenAI Responses API with web search plus the site snapshot to extract a structured brand template.
- If AI analysis fails, the function falls back to the local site extractor and finally to manual template mode if the URL is too thin.

Optional env vars:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_ANALYSIS_MODEL=gpt-5.4-mini
```

## Optional AI competitor generation

The competitor section uses `/.netlify/functions/competitor-ads`.

- If `OPENAI_API_KEY` is present in the Netlify environment, the function uses the OpenAI Responses API to draft plausible competitor ads and brand-aware alternatives.
- If no API key is present, the function falls back to local known-business profiles plus deterministic rewrites so the UI still works during development.

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
