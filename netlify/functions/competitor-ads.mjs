import OpenAI from 'openai'
import { clean, getMethod, json, parseJsonBody, slugify } from './_lib/http.mjs'
import { createGenericBusinessProfile, findKnownBusinessProfile } from './_lib/known-businesses.mjs'

const fallbackAngles = ['Speed', 'Clarity', 'Proof']

function pick(items, index, fallback = '') {
  if (!Array.isArray(items) || !items.length) return fallback
  return clean(items[index % items.length]) || fallback
}

function compact(value) {
  return clean(value).replace(/\s+/g, ' ')
}

function sentence(value) {
  const draft = compact(value)
  return draft ? draft[0].toUpperCase() + draft.slice(1) : draft
}

function withPeriod(value) {
  const draft = compact(value)
  if (!draft) return ''
  return /[.!?]$/.test(draft) ? draft : `${draft}.`
}

function safeLines(items, fallback) {
  const lines = Array.isArray(items) ? items.map((item) => clean(item)).filter(Boolean) : []
  return lines.length ? lines : fallback
}

function validatePayload(payload) {
  const competitorName = clean(payload?.competitorName)
  const brief = payload?.brief
  const tone = clean(payload?.tone)

  if (!competitorName) return { error: 'Competitor name is required' }
  if (!brief || typeof brief !== 'object') return { error: 'Brand brief is required' }
  if (!tone) return { error: 'Tone is required' }

  return { competitorName, brief, tone }
}

function normalizeResearch(raw, competitorName) {
  const ads = Array.isArray(raw?.ads) ? raw.ads.slice(0, 3) : []
  const alternatives = Array.isArray(raw?.alternatives) ? raw.alternatives.slice(0, 3) : []

  if (ads.length < 3 || alternatives.length < 3) {
    throw new Error('Incomplete competitor research payload')
  }

  return {
    competitorName,
    mode: 'ai',
    notice: 'AI-generated competitor ad inspiration. Facebook Ad Library ingestion is the next step, so these are plausible current-style ads rather than live pulls.',
    ads: ads.map((item, index) => ({
      id: `source-${slugify(competitorName)}-${index}`,
      competitorName,
      angle: clean(item?.angle) || fallbackAngles[index],
      headline: sentence(item?.headline || `${competitorName} ad ${index + 1}`),
      body: withPeriod(item?.body || `${competitorName} ad body ${index + 1}`),
      cta: clean(item?.cta) || 'Learn more',
      rationale: withPeriod(item?.rationale || 'Plausible category-style competitor positioning.'),
    })),
    alternatives: alternatives.map((item, index) => ({
      id: `alt-${slugify(competitorName)}-${index}`,
      sourceId: `source-${slugify(competitorName)}-${index}`,
      angle: clean(item?.angle) || fallbackAngles[index],
      headline: sentence(item?.headline || `Alternative to ${competitorName}`),
      body: withPeriod(item?.body || `Alternative ad for ${competitorName}`),
      cta: clean(item?.cta) || 'Learn more',
      rationale: withPeriod(item?.rationale || 'Reframed for the analyzed brand brief and selected tone.'),
    })),
  }
}

function buildFallbackResearch(competitorName, brief, tone, notice) {
  const profile = findKnownBusinessProfile(competitorName) ?? createGenericBusinessProfile(competitorName)
  const audience = clean(brief.targetAudience) || 'buyers comparing solutions'
  const companyName = clean(brief.companyName) || 'Your brand'
  const oneLiner = clean(brief.oneLiner) || clean(brief.primaryOffer) || 'a sharper offer'
  const primaryOffer = clean(brief.primaryOffer) || clean(brief.oneLiner) || 'a stronger product story'
  const benefits = safeLines(brief.benefits, ['move faster', 'reduce friction', 'make the value obvious'])
  const pains = safeLines(brief.painPoints, ['unclear value', 'too much workflow drag', 'generic category messaging'])
  const differentiators = safeLines(brief.differentiators, ['clearer positioning', 'tighter execution', 'more specific value'])
  const proofPoints = safeLines(brief.proofPoints, ['a more believable offer', 'stronger proof language', 'a cleaner product story'])
  const desiredCta = clean(brief.desiredCta) || 'Learn more'
  const brandTone = clean(brief.brandTone) || tone

  const sourceAds = [
    {
      angle: 'Speed',
      headline: `${profile.name} keeps ${profile.category} moving`,
      body: `${profile.name} positions itself as the faster path for ${profile.audience}. The message leans on ${profile.differentiators[0].toLowerCase()}, ${profile.offer}, and a low-friction next step.`,
      cta: pick(profile.ctas, 0, 'Learn more'),
      rationale: `Feels like a plausible fast-path ad for a familiar ${profile.category} brand.`,
    },
    {
      angle: 'Clarity',
      headline: `One place for ${profile.offer}`,
      body: `${profile.name} would likely simplify the category story: fewer tools, less switching, and a cleaner way for ${profile.audience} to get the outcome they want.`,
      cta: pick(profile.ctas, 1, 'Try it now'),
      rationale: `Uses category simplification, which is common when the brand wins on ease and breadth.`,
    },
    {
      angle: 'Proof',
      headline: `${profile.name} is built for teams already in motion`,
      body: `${profile.proof[0]}. A plausible ad would combine that credibility with ${profile.differentiators[1].toLowerCase()} and a simple CTA instead of over-explaining the product.`,
      cta: pick(profile.ctas, 2, 'See how it works'),
      rationale: `Anchors on market recognition and trust rather than novelty.`,
    },
  ]

  const alternatives = sourceAds.map((ad, index) => ({
    angle: ad.angle,
    headline:
      index === 0
        ? `${companyName} gives ${audience.toLowerCase()} a cleaner path`
        : index === 1
          ? `${companyName} makes ${primaryOffer.toLowerCase()} easier to trust`
          : `${companyName} turns proof into a clearer buying reason`,
    body:
      index === 0
        ? `${sentence(pains[index % pains.length])} is still slowing strong teams down. ${companyName} helps ${audience.toLowerCase()} ${benefits[index % benefits.length].toLowerCase()} with ${differentiators[index % differentiators.length].toLowerCase()}. Keep the tone ${tone.toLowerCase()} and the promise grounded in actual workflow relief.`
        : index === 1
          ? `If ${profile.name} is selling simplicity, ${companyName} should sell clarity with specifics. Lead with ${oneLiner.toLowerCase()}, tie it to ${benefits[(index + 1) % benefits.length].toLowerCase()}, and make the message sound ${brandTone.toLowerCase()}.`
          : `${proofPoints[index % proofPoints.length]} should carry more weight than hype. Reframe the category story around ${companyName}, ${differentiators[(index + 1) % differentiators.length].toLowerCase()}, and why that matters for ${audience.toLowerCase()}.`,
    cta: desiredCta,
    rationale:
      index === 0
        ? 'Pulls the competitor speed angle back toward the current brand brief and target buyer pain.'
        : index === 1
          ? 'Uses the competitor structure but swaps in the analyzed brand’s offer and tone.'
          : 'Keeps the proof-led angle while making the brand case more concrete and believable.',
  }))

  return {
    competitorName: profile.name,
    mode: 'fallback',
    notice,
    ads: sourceAds.map((ad, index) => ({
      id: `source-${slugify(profile.name)}-${index}`,
      competitorName: profile.name,
      angle: ad.angle,
      headline: sentence(ad.headline),
      body: withPeriod(ad.body),
      cta: ad.cta,
      rationale: withPeriod(ad.rationale),
    })),
    alternatives: alternatives.map((ad, index) => ({
      id: `alt-${slugify(profile.name)}-${index}`,
      sourceId: `source-${slugify(profile.name)}-${index}`,
      angle: ad.angle,
      headline: sentence(ad.headline),
      body: withPeriod(ad.body),
      cta: ad.cta,
      rationale: withPeriod(ad.rationale),
    })),
  }
}

async function generateWithOpenAI(competitorName, brief, tone) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const knownProfile = findKnownBusinessProfile(competitorName)
  const grounding = knownProfile
    ? JSON.stringify(knownProfile, null, 2)
    : 'No preset profile found. Use general knowledge only if the business is widely known. Otherwise keep the ad copy plausible and generic.'

  const prompt = `You are generating plausible Meta/Facebook-style ad copy for inspiration, not claiming access to live ads.

Return valid JSON only in this shape:
{
  "ads": [
    { "angle": "", "headline": "", "body": "", "cta": "", "rationale": "" }
  ],
  "alternatives": [
    { "angle": "", "headline": "", "body": "", "cta": "", "rationale": "" }
  ]
}

Requirements:
- Return exactly 3 ads and exactly 3 alternatives.
- Ads should read like realistic current-style paid social copy for ${competitorName}.
- Alternatives must adapt each corresponding ad for this brand brief and selected tone.
- Keep each body under 320 characters.
- Avoid saying "Facebook Ad Library", "Meta", "as seen", or anything implying direct retrieval.
- Be specific, commercially realistic, and non-fantastical.

Competitor grounding:
${grounding}

Brand brief:
${JSON.stringify(brief, null, 2)}

Selected tone:
${tone}`

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    reasoning: { effort: 'low' },
    max_output_tokens: 1400,
    text: { verbosity: 'low' },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: 'You are a direct-response strategist. Output strict JSON only.' }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
  })

  return normalizeResearch(JSON.parse(response.output_text), competitorName)
}

export default async function handler(requestOrEvent) {
  if (getMethod(requestOrEvent) !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const payload = await parseJsonBody(requestOrEvent)
  if (!payload) {
    return json(400, { error: 'Invalid JSON body' })
  }

  const validated = validatePayload(payload)
  if (validated.error) {
    return json(400, { error: validated.error })
  }

  const { competitorName, brief, tone } = validated

  if (!process.env.OPENAI_API_KEY) {
    return json(
      200,
      buildFallbackResearch(
        competitorName,
        brief,
        tone,
        'OpenAI is not configured, so this section is using local competitor profiles and brand-aware rewrites until live ad library ingestion is wired.',
      ),
    )
  }

  try {
    return json(200, await generateWithOpenAI(competitorName, brief, tone))
  } catch {
    return json(
      200,
      buildFallbackResearch(
        competitorName,
        brief,
        tone,
        'AI generation was unavailable, so the app fell back to local competitor profiles and brand-aware rewrites.',
      ),
    )
  }
}
