import OpenAI from 'openai'
import * as cheerio from 'cheerio'
import { getMethod, json, parseJsonBody } from './_lib/http.mjs'

const defaultHeaders = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
}

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'brief', 'evidence', 'extractionScore', 'notice'],
  properties: {
    mode: { type: 'string', enum: ['analyzed', 'manual'] },
    brief: {
      type: 'object',
      additionalProperties: false,
      required: [
        'companyName',
        'oneLiner',
        'targetAudience',
        'primaryOffer',
        'benefits',
        'painPoints',
        'differentiators',
        'proofPoints',
        'desiredCta',
        'brandTone',
        'wordsToAvoid',
        'regionContext',
      ],
      properties: {
        companyName: { type: 'string' },
        oneLiner: { type: 'string' },
        targetAudience: { type: 'string' },
        primaryOffer: { type: 'string' },
        benefits: { type: 'array', items: { type: 'string' } },
        painPoints: { type: 'array', items: { type: 'string' } },
        differentiators: { type: 'array', items: { type: 'string' } },
        proofPoints: { type: 'array', items: { type: 'string' } },
        desiredCta: { type: 'string' },
        brandTone: { type: 'string' },
        wordsToAvoid: { type: 'string' },
        regionContext: { type: 'string' },
      },
    },
    evidence: {
      type: 'object',
      additionalProperties: false,
      required: ['pageTitle', 'metaDescription', 'headlines', 'snippets', 'ctas'],
      properties: {
        pageTitle: { type: 'string' },
        metaDescription: { type: 'string' },
        headlines: { type: 'array', items: { type: 'string' } },
        snippets: { type: 'array', items: { type: 'string' } },
        ctas: { type: 'array', items: { type: 'string' } },
      },
    },
    extractionScore: { type: 'number' },
    notice: { type: 'string' },
  },
}

function normalizeUrl(input) {
  if (!input) return null
  try {
    return new URL(input).toString()
  } catch {
    try {
      return new URL(`https://${input}`).toString()
    } catch {
      return null
    }
  }
}

function clean(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniq(items) {
  return [...new Set((items ?? []).map((item) => clean(item)).filter(Boolean))]
}

function first(items, fallback = '') {
  return items.find(Boolean) || fallback
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clip(value, limit) {
  return clean(value).slice(0, limit)
}

function metaContent($, selector) {
  return clean($(selector).attr('content') || '')
}

function takeBest(items, limit, min = 22, max = 180) {
  return uniq(items)
    .filter((item) => item.length >= min && item.length <= max)
    .slice(0, limit)
}

function sentenceCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

function splitTitleParts(value) {
  return clean(value)
    .split(/\s+[|–-]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function emptyBrief() {
  return {
    companyName: '',
    oneLiner: '',
    targetAudience: '',
    primaryOffer: '',
    benefits: [],
    painPoints: [],
    differentiators: [],
    proofPoints: [],
    desiredCta: '',
    brandTone: '',
    wordsToAvoid: 'Generic hype, vague superlatives, forced urgency',
    regionContext: '',
  }
}

function emptyEvidence() {
  return {
    pageTitle: '',
    metaDescription: '',
    headlines: [],
    snippets: [],
    ctas: [],
  }
}

function normalizeList(items, fallback = [], limit = 3) {
  const next = uniq(Array.isArray(items) ? items : []).slice(0, limit)
  return next.length ? next : fallback
}

function guessCompanyName($, pageTitle, hostname) {
  const siteName = metaContent($, 'meta[property="og:site_name"]')
  const applicationName = metaContent($, 'meta[name="application-name"]')
  const titleCandidates = [
    ...splitTitleParts(siteName),
    ...splitTitleParts(applicationName),
    ...splitTitleParts(pageTitle),
    hostname.replace(/^www\./, '').split('.')[0],
  ]

  return (
    titleCandidates.find((item) => item.length > 1 && item.length < 40 && !/welcome to|future of|official site/i.test(item)) ||
    clean(siteName) ||
    clean(applicationName) ||
    splitTitleParts(pageTitle)[0] ||
    hostname.replace(/^www\./, '').split('.')[0]
  )
}

function inferAudience(text) {
  const checks = [
    { match: /\bdevelopers?|engineers?|api\b/i, value: 'Developers, engineers, and technical teams' },
    { match: /\bfounders?|startups?\b/i, value: 'Founders and startup operators' },
    { match: /\bmarketers?|growth|revenue\b/i, value: 'Marketing and growth teams' },
    { match: /\becommerce|shopify|stores?\b/i, value: 'Ecommerce teams and online sellers' },
    { match: /\bcreators?|audience\b/i, value: 'Creators and audience-led businesses' },
    { match: /\benterprise|security|compliance\b/i, value: 'Enterprise buyers and cross-functional teams' },
    { match: /\bcrypto|onchain|wallet\b/i, value: 'Crypto-native users and teams' },
    { match: /\bblockchain|token|web3|fundraising|launchpad\b/i, value: 'Crypto-native teams, token projects, and web3 communities' },
  ]

  return first(checks.filter((item) => item.match.test(text)).map((item) => item.value), 'Operators, marketers, and teams evaluating a modern software product')
}

function inferTone(text) {
  if (/\bprecision|api|workflow|infrastructure|engineering\b/i.test(text)) return 'Technical, clear, and efficiency-minded'
  if (/\bluxury|premium|beautiful|craft\b/i.test(text)) return 'Premium, polished, and design-forward'
  if (/\bmove fast|speed|fast\b/i.test(text)) return 'Confident, modern, and momentum-driven'
  if (/\bfounder|build|mission\b/i.test(text)) return 'Founder-led, direct, and conviction-heavy'
  return 'Clear, modern, and benefit-focused'
}

function inferCta(ctas, bodyText) {
  const candidates = uniq([
    ...(Array.isArray(ctas) ? ctas : []),
    ...(bodyText.match(/\b(book demo|try free|get started|learn more|join waitlist|sign up|start free)\b/gi) ?? []),
  ])

  return first(candidates, 'Learn more')
}

function inferProofPoints(snippets, bodyText) {
  const regexMatches = bodyText.match(/\b(trusted by[^.]{0,60}|used by[^.]{0,60}|SOC 2[^.]{0,40}|\d+%[^.]{0,40}|\d+[kKmM]\+[^.]{0,40}|G2[^.]{0,30})/gi) ?? []
  const candidates = [
    ...snippets.filter((item) => /\btrusted|used by|customers|teams|security|soc 2|g2|reviews?|compliance|millions|thousands\b/i.test(item)),
    ...regexMatches,
  ]

  return takeBest(candidates, 3)
}

function inferPainPoints(snippets, bodyText) {
  const candidates = [...snippets.filter((item) => /\bslow|manual|fragmented|messy|bloated|complex|hard|spend too much time|waste\b/i.test(item))]

  if (!candidates.length) {
    if (/\bmanual\b/i.test(bodyText)) candidates.push('Manual work is slowing teams down')
    if (/\bcomplex\b/i.test(bodyText)) candidates.push('Current workflows are too complex')
    if (/\bfragmented|disconnected\b/i.test(bodyText)) candidates.push('Teams are working across disconnected tools')
  }

  return takeBest(candidates.map(sentenceCase), 3)
}

function inferDifferentiators(snippets, headlines, bodyText) {
  const candidates = [
    ...headlines.filter((item) => /\bfast|simple|modern|purpose-built|all-in-one|premium|secure|opinionated\b/i.test(item)),
    ...snippets.filter((item) => /\bonly|fast|built for|purpose-built|simple|modern|premium|secure|AI-powered|real-time\b/i.test(item)),
  ]

  if (!candidates.length) {
    if (/\breal-time\b/i.test(bodyText)) candidates.push('Real-time product experience')
    if (/\bsecure\b/i.test(bodyText)) candidates.push('Security-forward positioning')
    if (/\bAI\b/i.test(bodyText)) candidates.push('AI-assisted workflow')
  }

  return takeBest(candidates.map(sentenceCase), 3)
}

function inferBenefits(headlines, snippets) {
  const candidates = [
    ...headlines,
    ...snippets.filter((item) => /\bhelp|faster|grow|ship|save|convert|launch|clarity|visibility|revenue|scale\b/i.test(item)),
  ]

  return takeBest(candidates.map(sentenceCase), 3)
}

function extractEvidence($) {
  const pageTitle = clean($('title').text() || '')
  const metaDescription = metaContent($, 'meta[name="description"]') || metaContent($, 'meta[property="og:description"]')
  const ogTitle = metaContent($, 'meta[property="og:title"]')
  const twitterTitle = metaContent($, 'meta[name="twitter:title"]')
  const applicationName = metaContent($, 'meta[name="application-name"]')
  const socialDescriptions = uniq([
    metaDescription,
    metaContent($, 'meta[property="og:description"]'),
    metaContent($, 'meta[name="twitter:description"]'),
  ])

  const headlines = takeBest(
    [
      ...$('h1, h2, h3')
        .toArray()
        .map((node) => $(node).text()),
      ogTitle,
      twitterTitle,
      applicationName,
      ...splitTitleParts(pageTitle),
    ],
    8,
  )

  const snippets = takeBest(
    [
      ...$('p, li')
        .toArray()
        .map((node) => $(node).text()),
      ...socialDescriptions,
    ],
    12,
  )

  const ctas = uniq(
    [
      ...$('a, button')
        .toArray()
        .map((node) => $(node).text()),
      ...socialDescriptions.flatMap((item) => item.match(/\b(book demo|try free|get started|learn more|join waitlist|sign up|start free|contact sales)\b/gi) ?? []),
    ].filter((item) => /\b(book|try|get started|learn|join|sign|start|request|contact|talk)\b/i.test(item)),
  ).slice(0, 8)

  return { pageTitle, metaDescription, headlines, snippets, ctas }
}

function sanitizeBrief(raw) {
  const fallback = emptyBrief()

  return {
    companyName: clean(raw?.companyName),
    oneLiner: clean(raw?.oneLiner),
    targetAudience: clean(raw?.targetAudience),
    primaryOffer: clean(raw?.primaryOffer),
    benefits: normalizeList(raw?.benefits),
    painPoints: normalizeList(raw?.painPoints),
    differentiators: normalizeList(raw?.differentiators),
    proofPoints: normalizeList(raw?.proofPoints),
    desiredCta: clean(raw?.desiredCta) || 'Learn more',
    brandTone: clean(raw?.brandTone),
    wordsToAvoid: clean(raw?.wordsToAvoid) || fallback.wordsToAvoid,
    regionContext: clean(raw?.regionContext),
  }
}

function sanitizeEvidence(raw, fallback = emptyEvidence()) {
  return {
    pageTitle: clean(raw?.pageTitle) || fallback.pageTitle,
    metaDescription: clean(raw?.metaDescription) || fallback.metaDescription,
    headlines: normalizeList(raw?.headlines, fallback.headlines, 8),
    snippets: normalizeList(raw?.snippets, fallback.snippets, 10),
    ctas: normalizeList(raw?.ctas, fallback.ctas, 6),
  }
}

function buildHeuristicAnalysis(normalizedUrl, evidence, bodyText, companyNameHint = '') {
  const hostname = new URL(normalizedUrl).hostname

  const oneLiner = first(
    [evidence.metaDescription, evidence.headlines[0], evidence.snippets[0]],
    'Modern software product with a clear offer and marketable value proposition',
  )

  const benefits = inferBenefits(evidence.headlines, evidence.snippets)
  const proofPoints = inferProofPoints(evidence.snippets, bodyText)
  const painPoints = inferPainPoints(evidence.snippets, bodyText)
  const differentiators = inferDifferentiators(evidence.snippets, evidence.headlines, bodyText)
  const audience = inferAudience(`${evidence.headlines.join(' ')} ${evidence.snippets.join(' ')} ${bodyText}`)
  const extractionScore = Math.min(
    84,
    40 +
      evidence.headlines.length * 4 +
      evidence.snippets.length * 2 +
      (evidence.metaDescription ? 10 : 0) +
      (evidence.ctas.length ? 6 : 0),
  )

  const brief = {
    companyName: clean(companyNameHint) || guessCompanyName(cheerio.load('<html></html>'), evidence.pageTitle, hostname),
    oneLiner,
    targetAudience: audience,
    primaryOffer: first(benefits, oneLiner),
    benefits: benefits.length ? benefits : ['Clearer value proposition', 'Faster buyer understanding', 'Better response quality from X traffic'],
    painPoints: painPoints.length ? painPoints : ['The site does not make the pain obvious enough', 'The value proposition is hard to summarize quickly', 'Offer clarity may be getting lost'],
    differentiators: differentiators.length ? differentiators : ['Clear positioning', 'Modern product presentation', 'Focused offer'],
    proofPoints: proofPoints.length ? proofPoints : ['Visible product polish and clearer messaging cues'],
    desiredCta: inferCta(evidence.ctas, bodyText),
    brandTone: inferTone(`${evidence.headlines.join(' ')} ${bodyText}`),
    wordsToAvoid: 'Generic hype, vague superlatives, forced urgency',
    regionContext: 'Global English-speaking market unless the site suggests otherwise',
  }

  return {
    mode: extractionScore < 58 ? 'manual' : 'analyzed',
    url: normalizedUrl,
    brief,
    evidence,
    extractionScore,
    notice:
      extractionScore < 58
        ? 'AI analysis was unavailable, and the local fallback could not extract enough detail. You can still edit the template manually.'
        : 'AI analysis was unavailable, so this brand template came from the site fallback extractor.',
  }
}

async function fetchSiteSnapshot(normalizedUrl) {
  try {
    const response = await fetch(normalizedUrl, { headers: defaultHeaders, redirect: 'follow' })
    if (!response.ok) {
      return { evidence: emptyEvidence(), bodyText: '', hostname: new URL(normalizedUrl).hostname }
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const evidence = extractEvidence($)
    const hostname = new URL(normalizedUrl).hostname
    const bodyText = clip($('body').text(), 8000)
    const companyName = guessCompanyName($, evidence.pageTitle, hostname)

    return { evidence, bodyText, hostname, companyName }
  } catch {
    return { evidence: emptyEvidence(), bodyText: '', hostname: new URL(normalizedUrl).hostname }
  }
}

async function analyzeWithOpenAI(normalizedUrl, siteSnapshot) {
  if (!process.env.OPENAI_API_KEY) return null

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const bodyExcerpt = clip(siteSnapshot.bodyText, 3500)
  const prompt = `Analyze the company behind this URL and extract a faithful brand template.

URL:
${normalizedUrl}

What to do:
- Use live web search to inspect the URL and related public pages.
- Use the provided site snapshot as grounding when it exists.
- Return a practical brand template for ad copy generation.
- Stay conservative. Do not invent customers, metrics, testimonials, or product claims.
- If the site is thin or unclear, lower the extraction score and switch mode to "manual".
- Keep every field readable and directly usable by a marketer.

Site snapshot:
${JSON.stringify(
    {
      companyNameHint: siteSnapshot.companyName || '',
      pageTitle: siteSnapshot.evidence.pageTitle,
      metaDescription: siteSnapshot.evidence.metaDescription,
      headlines: siteSnapshot.evidence.headlines,
      snippets: siteSnapshot.evidence.snippets,
      ctas: siteSnapshot.evidence.ctas,
      bodyExcerpt,
    },
    null,
    2,
  )}

Field rules:
- oneLiner: 1 sentence, plain English, no hype.
- targetAudience: 1 concise sentence naming the real buyer/user.
- primaryOffer: the main product or service in one sentence fragment.
- benefits, painPoints, differentiators, proofPoints: 2-3 short bullets each when possible.
- desiredCta: a realistic CTA from the brand if visible, otherwise a conservative default.
- brandTone: describe the brand voice in one sentence.
- wordsToAvoid: short comma-separated guidance for bad copy patterns.
- regionContext: geography, language, or market context only if supported.
- evidence should include short direct cues, not essays.
- notice should briefly explain whether the result is reliable or needs manual cleanup.`

  const response = await client.responses.create({
    model: process.env.OPENAI_ANALYSIS_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    reasoning: { effort: 'low' },
    max_output_tokens: 2200,
    include: ['web_search_call.action.sources'],
    tools: [
      {
        type: 'web_search_preview',
        search_context_size: 'medium',
        user_location: {
          type: 'approximate',
          country: 'US',
          timezone: 'America/Los_Angeles',
        },
      },
    ],
    tool_choice: { type: 'web_search_preview' },
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'brand_template_analysis',
        strict: true,
        schema: analysisSchema,
      },
    },
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You are a senior brand strategist. Use web search and the supplied site cues to extract a grounded brand template. Be literal, commercially sensible, and cautious about unsupported claims.',
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
  })

  const parsed = JSON.parse(response.output_text)
  const brief = sanitizeBrief(parsed.brief)
  const evidence = sanitizeEvidence(parsed.evidence, siteSnapshot.evidence)
  const extractionScore = clamp(Math.round(Number(parsed.extractionScore) || 0), 20, 98)
  const manualMode = !brief.companyName || !brief.oneLiner || extractionScore < 50

  return {
    mode: manualMode ? 'manual' : parsed.mode === 'manual' ? 'manual' : 'analyzed',
    url: normalizedUrl,
    brief: {
      ...brief,
      companyName: brief.companyName || siteSnapshot.companyName || '',
      proofPoints: brief.proofPoints.length ? brief.proofPoints : normalizeList(siteSnapshot.evidence.snippets, [], 3),
    },
    evidence,
    extractionScore,
    notice:
      clean(parsed.notice) ||
      (manualMode
        ? 'AI searched the URL, but the brand template still needs manual cleanup before you generate copy.'
        : 'AI extracted this brand template from the URL using live web search and site cues.'),
  }
}

function createManualAnalysis(normalizedUrl, notice, previousBrief = emptyBrief()) {
  return {
    mode: 'manual',
    url: normalizedUrl,
    brief: {
      ...emptyBrief(),
      ...previousBrief,
      benefits: normalizeList(previousBrief.benefits),
      painPoints: normalizeList(previousBrief.painPoints),
      differentiators: normalizeList(previousBrief.differentiators),
      proofPoints: normalizeList(previousBrief.proofPoints),
    },
    evidence: emptyEvidence(),
    extractionScore: 24,
    notice,
  }
}

export default async function handler(requestOrEvent) {
  if (getMethod(requestOrEvent) !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const payload = await parseJsonBody(requestOrEvent)
  if (!payload) {
    return json(400, { error: 'Invalid JSON body' })
  }

  const normalizedUrl = normalizeUrl(payload.url)
  if (!normalizedUrl) {
    return json(400, { error: 'Invalid URL' })
  }

  const siteSnapshot = await fetchSiteSnapshot(normalizedUrl)

  try {
    const aiAnalysis = await analyzeWithOpenAI(normalizedUrl, siteSnapshot)
    if (aiAnalysis) {
      return json(200, aiAnalysis)
    }
  } catch {}

  if (
    siteSnapshot.evidence.pageTitle ||
    siteSnapshot.evidence.metaDescription ||
    siteSnapshot.evidence.headlines.length ||
    siteSnapshot.evidence.snippets.length
  ) {
    return json(200, buildHeuristicAnalysis(normalizedUrl, siteSnapshot.evidence, siteSnapshot.bodyText, siteSnapshot.companyName))
  }

  return json(
    200,
    createManualAnalysis(
      normalizedUrl,
      process.env.OPENAI_API_KEY
        ? 'We could not extract enough reliable detail from that URL. The template is open for manual cleanup.'
        : 'OpenAI URL analysis is not configured, and the site fallback could not extract enough detail. The template is open for manual cleanup.',
    ),
  )
}
