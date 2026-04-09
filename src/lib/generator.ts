import type {
  AudienceRewrite,
  BrandBrief,
  CreativeSuggestion,
  GenerationControls,
  GeneratedAd,
  GeneratedWorkspace,
  ModularLine,
  RemixKind,
  ScoreBreakdown,
  ThreadAd,
} from '../types'

const anglePool = [
  'Pain-point',
  'Aspiration',
  'Proof-led',
  'Contrarian',
  'Feature-led',
  'Founder-led',
  'Urgency-led',
  'Curiosity-led',
  'Comparison',
] as const

const audienceRewrites = [
  'Technical buyer',
  'Skeptical buyer',
  'Beginner',
  'Founder',
  'Enterprise decision-maker',
  'Crypto-native audience',
  'Casual mainstream user',
] as const

const hookStarters = [
  'Most buyers do not need more noise.',
  'The clearer offer usually wins.',
  'If the workflow still feels heavy, the problem is real.',
  'Strong copy gets better when the message gets simpler.',
  'The product story should do more than the slogan.',
  'Buyers respond faster when the value is concrete.',
]

const urgencyPhrases = [
  'Right now',
  'This quarter',
  'Before the next launch',
  'While buyers are still comparing options',
  'Before this becomes harder to fix',
]

const fillerWords = [
  'very',
  'really',
  'just',
  'actually',
  'in order to',
  'that helps you',
  'super',
]

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function clampScore(value: number) {
  return Math.max(52, Math.min(98, Math.round(value)))
}

function choose<T>(items: T[], index: number) {
  return items[index % items.length]
}

function sentence(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/^[a-z]/, (char) => char.toUpperCase())
}

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function decapitalize(value: string) {
  const draft = compact(value)
  return draft ? draft[0].toLowerCase() + draft.slice(1) : draft
}

function splitIdeas(text: string) {
  return text
    .split(/[.;!?]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function shortenToLimit(text: string, limit: number) {
  if (text.length <= limit) {
    return compact(text)
  }

  const sentences = splitIdeas(text)
  let draft = ''

  for (const part of sentences) {
    const candidate = compact(`${draft} ${part}.`)
    if (candidate.length > limit) {
      break
    }
    draft = candidate
  }

  if (draft) {
    return draft
  }

  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function trimFiller(text: string) {
  return fillerWords.reduce((draft, word) => {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi')
    return compact(draft.replace(pattern, ''))
  }, text)
}

function scoreCopy(text: string, proofPoint: string, hasQuestion: boolean, cta: string): ScoreBreakdown {
  const clarity = clampScore(92 - Math.max(0, text.length - 220) * 0.16)
  const specificity = clampScore(
    64 +
      (proofPoint ? 10 : 0) +
      (/\d|%|days|weeks|minutes|SOC 2|API|pipeline|revenue/i.test(text) ? 10 : 0) +
      (/because|for|without|instead of/i.test(text) ? 6 : 0),
  )
  const curiosity = clampScore(58 + (hasQuestion ? 16 : 0) + (/what if|hot take|most/i.test(text) ? 12 : 0))
  const credibility = clampScore(60 + (proofPoint ? 16 : 0) + (/used by|trusted|proof|teams|customers/i.test(text) ? 8 : 0))
  const urgency = clampScore(55 + (/now|today|before|this quarter|launch/i.test(text) ? 18 : 0) + (cta ? 8 : 0))
  const overall = clampScore((clarity + specificity + curiosity + credibility + urgency) / 5)

  return { clarity, specificity, curiosity, credibility, urgency, overall }
}

function audienceForControl(brief: BrandBrief, audienceType: GenerationControls['audienceType']) {
  const normalized = audienceType.toLowerCase()
  if (normalized === 'b2b operators') return 'operators and revenue-minded teams'
  if (normalized === 'enterprise buyers') return 'enterprise teams with process and security pressure'
  if (normalized === 'growth teams') return 'growth teams pushing for efficient acquisition'
  return (brief.targetAudience || 'buyers evaluating a new product').toLowerCase()
}

function benefits(brief: BrandBrief) {
  const items = brief.benefits.filter(Boolean)
  return items.length
    ? items
    : ['move faster with clearer messaging', 'improve buyer understanding quickly', 'turn attention into qualified action']
}

function pains(brief: BrandBrief) {
  const items = brief.painPoints.filter(Boolean)
  return items.length
    ? items
    : ['generic messaging that does not convert', 'a value proposition that is too vague', 'too much friction between attention and action']
}

function proofs(brief: BrandBrief) {
  const items = brief.proofPoints.filter(Boolean)
  return items.length
    ? items
    : ['The site shows enough signal to build from, even before deeper proof is added']
}

function differentiators(brief: BrandBrief) {
  const items = brief.differentiators.filter(Boolean)
  return items.length
    ? items
    : ['clearer positioning', 'a more focused offer', 'less noise around the core value']
}

function ctaForControl(brief: BrandBrief, controls: GenerationControls) {
  return controls.ctaType || brief.desiredCta || 'Learn more'
}

function formatCta(cta: string) {
  return cta.endsWith('.') ? cta : `${cta}.`
}

function appendCta(text: string, cta: string) {
  const draft = compact(text).replace(/[.!?]+$/, '')
  return compact(`${draft}. ${formatCta(cta)}`)
}

function applyTone(text: string, brief: BrandBrief, controls: GenerationControls, variant: number) {
  let draft = compact(text)

  switch (controls.tone) {
    case 'Direct response':
      break
    case 'Witty':
      draft = compact(`${choose(hookStarters, variant)} ${draft}`)
      break
    case 'Premium':
      draft = draft.replace(/\bcheap\b/gi, 'high-leverage').replace(/\bfast\b/gi, 'polished')
      break
    case 'Technical':
      draft = compact(`${draft} Focus on clarity, fewer handoffs, and faster execution.`)
      break
    case 'Founder-led':
      draft = compact(`We built ${brief.companyName} after seeing ${decapitalize(pains(brief)[0])} slow good teams down. ${draft}`)
      break
    case 'Minimal':
      draft = shortenToLimit(trimFiller(draft), 170)
      break
    case 'Bold':
      draft = draft.replace(/\bcan\b/gi, 'will').replace(/\bhelps\b/gi, 'gives')
      break
    case 'Friendly':
      draft = draft.replace(/\bMost\b/, 'A lot of').replace(/\bIf\b/, 'If you')
      break
    case 'Contrarian':
      draft = compact(`Most brands overcomplicate this. ${draft}`)
      break
  }

  if (controls.aggressiveness >= 72) {
    draft = compact(`${choose(urgencyPhrases, variant)} is a good time to fix this. ${draft}`)
  }

  if (controls.styleConstraints.includes('More curiosity') && !draft.includes('?')) {
    draft = compact(`What changes when the offer gets clearer? ${draft}`)
  }

  if (controls.styleConstraints.includes('Less hype')) {
    draft = draft.replace(/\bbest\b/gi, 'strong').replace(/\brevolutionary\b/gi, 'useful')
  }

  if (controls.styleConstraints.includes('Punchier')) {
    const lines = splitIdeas(draft).slice(0, 3)
    draft = lines.join('.\n')
    if (!draft.endsWith('.')) {
      draft = `${draft}.`
    }
  }

  return draft
}

function buildSingleBody(angle: string, brief: BrandBrief, controls: GenerationControls, variant: number) {
  const audience = audienceForControl(brief, controls.audienceType)
  const benefit = choose(benefits(brief), variant)
  const secondaryBenefit = choose(benefits(brief), variant + 1)
  const pain = choose(pains(brief), variant)
  const proof = choose(proofs(brief), variant)
  const differentiator = choose(differentiators(brief), variant)
  const companyName = brief.companyName || 'Your product'
  const primaryOffer = brief.primaryOffer || brief.oneLiner || 'a clearer offer'

  let base = ''

  switch (angle) {
    case 'Pain-point':
      base = `${sentence(pain)} is still slowing ${audience}. ${companyName} helps teams ${decapitalize(benefit)} without extra complexity.`
      break
    case 'Aspiration':
      base = `${sentence(companyName)} helps ${audience} spend less time on coordination and more time on outcomes. The offer is ${decapitalize(primaryOffer)}, with a clear path to ${decapitalize(benefit)} and ${decapitalize(secondaryBenefit)}.`
      break
    case 'Proof-led':
      base = `${sentence(proof)}. ${companyName} makes that proof easier to trust by helping ${audience} ${decapitalize(benefit)}.`
      break
    case 'Contrarian':
      base = `More features rarely fix ${decapitalize(pain)}. ${companyName} leans on ${decapitalize(differentiator)} so teams can ${decapitalize(benefit)}.`
      break
    case 'Feature-led':
      base = `${companyName} gives ${audience} ${decapitalize(primaryOffer)} with ${decapitalize(differentiator)}. The result is ${decapitalize(benefit)} and ${decapitalize(secondaryBenefit)}.`
      break
    case 'Founder-led':
      base = `We kept seeing ${decapitalize(pain)} slow strong teams down. ${companyName} was built to ${decapitalize(benefit)} with ${decapitalize(differentiator)}.`
      break
    case 'Urgency-led':
      base = `${choose(urgencyPhrases, variant)} weak workflows start to show. If ${audience} need ${decapitalize(benefit)} before the next push, ${companyName} is built for that.`
      break
    case 'Curiosity-led':
      base = `What changes when ${audience} stop tolerating ${decapitalize(pain)}? Usually: ${decapitalize(benefit)}. ${companyName} makes that shift easier.`
      break
    case 'Comparison':
      base = `If the alternative is another tool that adds layers, ${companyName} is the cleaner move. It focuses on ${decapitalize(benefit)} with ${decapitalize(differentiator)}.`
      break
    default:
      base = `${companyName} helps ${audience} ${decapitalize(benefit)}.`
  }

  const withTone = applyTone(base, brief, controls, variant)
  const withCta = appendCta(withTone, ctaForControl(brief, controls))
  const limit = controls.postFormat === 'Single post' ? 280 : 260
  return shortenToLimit(withCta, limit)
}

function whyItWorks(angle: string, brief: BrandBrief) {
  switch (angle) {
    case 'Pain-point':
      return `Leads with a concrete problem and quickly positions ${brief.companyName} as relief.`
    case 'Aspiration':
      return 'Frames the offer around a better future state instead of a feature list.'
    case 'Proof-led':
      return 'Uses credibility before the pitch, which reduces skepticism fast.'
    case 'Contrarian':
      return 'Creates scroll-stopping tension by disagreeing with the obvious play.'
    case 'Feature-led':
      return 'Makes the offer tangible with specifics instead of vague promise language.'
    case 'Founder-led':
      return 'Feels human and origin-driven, which is useful for trust and memorability.'
    case 'Urgency-led':
      return 'Introduces timing pressure without relying on fake scarcity.'
    case 'Curiosity-led':
      return 'Opens a loop that invites the reader to stay for the payoff.'
    case 'Comparison':
      return 'Positions the product against the default alternative in the buyer’s head.'
    default:
      return 'Balanced structure with a clear hook, value proposition, and CTA.'
  }
}

function createAd(angle: string, brief: BrandBrief, controls: GenerationControls, variant: number, audienceLabel?: string): GeneratedAd {
  const body = buildSingleBody(angle, brief, controls, variant)
  const proof = choose(proofs(brief), variant) ?? ''
  const scores = scoreCopy(body, proof, body.includes('?'), ctaForControl(brief, controls))

  return {
    id: `${slugify(angle)}-${variant}-${slugify(audienceLabel ?? 'core')}`,
    body,
    characterCount: body.length,
    tone: controls.tone,
    objective: controls.objective,
    angle,
    whyItWorks: whyItWorks(angle, brief),
    scores,
    audienceLabel,
  }
}

function createShortVariant(source: GeneratedAd, index: number, brief: BrandBrief, controls: GenerationControls): GeneratedAd {
  let body = source.body
    .replace(/\bwithout adding another bloated workflow\b/gi, 'without extra drag')
    .replace(/\bhelps you\b/gi, '')
    .replace(/\bthat\b/gi, '')

  body = shortenToLimit(trimFiller(body), 150)

  if (!body.endsWith('.')) {
    body = `${body}.`
  }

  return {
    ...source,
    id: `${source.id}-short-${index}`,
    body,
    characterCount: body.length,
    angle: `${source.angle} / Short`,
    whyItWorks: 'Built for fast-scrolling attention with the same core point compressed harder.',
    scores: scoreCopy(body, brief.proofPoints[0] ?? '', body.includes('?'), ctaForControl(brief, controls)),
  }
}

function createThread(angle: string, brief: BrandBrief, controls: GenerationControls, variant: number): ThreadAd {
  const audience = audienceForControl(brief, controls.audienceType)
  const benefit = choose(benefits(brief), variant)
  const pain = choose(pains(brief), variant)
  const differentiator = choose(differentiators(brief), variant)
  const proof = choose(proofs(brief), variant)
  const cta = ctaForControl(brief, controls)
  const companyName = brief.companyName || 'Your product'
  const primaryOffer = (brief.primaryOffer || brief.oneLiner || 'a clearer offer').toLowerCase()

  const posts = [
    shortenToLimit(`A lot of ${audience} still accept ${decapitalize(pain)} as normal. That is usually the real drag on performance.`, 220),
    shortenToLimit(`${companyName} exists to ${decapitalize(benefit)}. The difference is ${decapitalize(differentiator)}, not more layers.`, 240),
    shortenToLimit(`${sentence(proof)}. That matters because buyers trust proof faster than polished claims.`, 220),
    shortenToLimit(`If you want ${decapitalize(primaryOffer)} that feels cleaner and easier to trust, ${cta}.`, 220),
  ]

  return {
    id: `thread-${slugify(angle)}-${variant}`,
    title: `${angle} thread`,
    angle,
    whyItWorks: `Turns the ${angle.toLowerCase()} angle into a clearer narrative arc with room for proof and CTA.`,
    posts,
  }
}

function rewriteForAudience(source: GeneratedAd, audience: string, index: number, brief: BrandBrief): AudienceRewrite {
  let body = source.body
  const companyName = brief.companyName || 'Your product'
  const desiredCta = brief.desiredCta || 'Learn more'
  const differentiator = differentiators(brief)[0].toLowerCase()
  const primaryBenefit = benefits(brief)[0].toLowerCase()
  const secondaryBenefit = benefits(brief)[1].toLowerCase()

  switch (audience) {
    case 'Technical buyer':
      body = compact(`${companyName} gives teams clearer execution, less coordination drag, and a more reliable path to ${primaryBenefit}. ${desiredCta}.`)
      break
    case 'Skeptical buyer':
      body = compact(`If you are tired of vague promises, start here: ${companyName} focuses on ${differentiator} and ${primaryBenefit}. ${desiredCta}.`)
      break
    case 'Beginner':
      body = compact(`${companyName} makes it easier to understand what to do next, stay organized, and move faster without the usual complexity. ${desiredCta}.`)
      break
    case 'Founder':
      body = compact(`Founders do not need more tool overhead. They need a system that helps the team ${primaryBenefit} and ${secondaryBenefit}. ${desiredCta}.`)
      break
    case 'Enterprise decision-maker':
      body = compact(`${companyName} gives teams a more reliable workflow with better visibility, less process friction, and stronger execution confidence. ${desiredCta}.`)
      break
    case 'Crypto-native audience':
      body = compact(`Most tools feel heavier than they need to. ${companyName} keeps the workflow sharp so fast-moving teams can execute with less drag. ${desiredCta}.`)
      break
    case 'Casual mainstream user':
      body = compact(`${companyName} helps teams stay on top of work, move faster, and avoid the usual mess. ${desiredCta}.`)
      break
  }

  return {
    id: `rewrite-${index}-${slugify(audience)}`,
    audience,
    body: shortenToLimit(body, 260),
    whyItWorks: `Recasts the same offer for ${audience.toLowerCase()} language, expectations, and decision criteria.`,
  }
}

function createAngleExplorer(brief: BrandBrief, controls: GenerationControls) {
  return anglePool.map((angle, index) => ({
    id: `angle-${slugify(angle)}`,
    angle,
    sample: buildSingleBody(angle, brief, controls, index),
    rationale: whyItWorks(angle, brief),
  }))
}

function createModularLines(brief: BrandBrief, controls: GenerationControls): ModularLine[] {
  const hooks = Array.from({ length: 10 }, (_, index) => ({
    id: `hook-${index}`,
    text: shortenToLimit(
      choose(
        [
          `The category is crowded. The message does not have to be.`,
          `Most buyers are not ignoring you. They are ignoring vague value.`,
          `What if the better ad is the clearer one?`,
          `The fastest route to response is usually sharper positioning.`,
          `${brief.companyName} is built for teams done with ${decapitalize(brief.painPoints[0] || 'unnecessary friction')}.`,
        ],
        index,
      ),
      120,
    ),
    category: 'Hook' as const,
  }))

  const ctas = Array.from({ length: 10 }, (_, index) => ({
    id: `cta-${index}`,
    text: choose(
      [
        `See how ${brief.companyName} fits your workflow.`,
        `${controls.ctaType} if you want less drag and more momentum.`,
        `Take a closer look before your next campaign window.`,
        `Try the workflow that keeps the value clear from the first click.`,
        `Start with the version that feels easier to trust.`,
      ],
      index,
    ),
    category: 'CTA' as const,
  }))

  const closers = Array.from({ length: 10 }, (_, index) => ({
    id: `closer-${index}`,
    text: choose(
      [
        `Clearer message. Better click quality.`,
        `Less fluff. More signal.`,
        `Built for teams that move on conviction, not clutter.`,
        `The offer gets stronger when the message gets tighter.`,
        `Better positioning shows up fast on X.`,
      ],
      index,
    ),
    category: 'Closer' as const,
  }))

  return [...hooks, ...ctas, ...closers]
}

function createCreativeSuggestions(brief: BrandBrief): CreativeSuggestion[] {
  const primaryOffer = (brief.primaryOffer || brief.oneLiner || 'the product experience').toLowerCase()
  const benefit = benefits(brief)[0].toLowerCase()
  const differentiator = differentiators(brief)[0].toLowerCase()
  const pain = pains(brief)[0].toLowerCase()
  const proof = proofs(brief)[0].toLowerCase()
  const audience = (brief.targetAudience || 'the target audience').toLowerCase()
  const companyName = brief.companyName || 'Your product'
  const ideas: Omit<CreativeSuggestion, 'id'>[] = [
    {
      title: 'Screenshot-focused',
      description: 'Lead with the product surface and a sharp overlay headline that mirrors the ad hook.',
      prompt: `Show the ${primaryOffer} interface with a single bold caption around ${benefit}.`,
    },
    {
      title: 'UI close-up',
      description: 'Zoom in on one moment of value instead of trying to explain the full product.',
      prompt: `Highlight the product area that best conveys ${differentiator} and pair it with one line of proof.`,
    },
    {
      title: 'Before / after',
      description: 'Frame the contrast between the old workflow and the cleaner future state.',
      prompt: `Left side: ${pain}. Right side: ${benefit}. Keep the layout minimal and crisp.`,
    },
    {
      title: 'Testimonial style',
      description: 'Use a quote card with one proof point and one simple product shot.',
      prompt: `Combine a short customer-style quote with ${proof} and a muted product frame.`,
    },
    {
      title: 'Founder face / quote',
      description: 'Useful when the copy leans founder-led or contrarian.',
      prompt: `Use a portrait with a one-sentence opinion on why ${pain} is the wrong default.`,
    },
    {
      title: 'Product in use',
      description: 'Show context, not a floating UI fragment.',
      prompt: `Display the product inside an actual working setup, emphasizing ${audience}.`,
    },
    {
      title: 'Bold text graphic',
      description: 'A strong text-only frame can win when the angle itself is the asset.',
      prompt: `Set one contrarian line in oversized type against a dark background with a small ${companyName} lockup.`,
    },
  ]

  return ideas.map((idea, index) => ({ id: `creative-${index}`, ...idea }))
}

export function generateWorkspace(brief: BrandBrief, controls: GenerationControls, seed = 0): GeneratedWorkspace {
  const singlePosts = Array.from({ length: controls.outputCount }, (_, index) => {
    const angle = choose([...anglePool], seed + index)
    return createAd(angle, brief, controls, seed + index)
  })

  const shortVariants = singlePosts.slice(0, Math.min(4, singlePosts.length)).map((item, index) => createShortVariant(item, index, brief, controls))

  const threads = Array.from({ length: 3 }, (_, index) => createThread(choose([...anglePool], seed + index), brief, controls, seed + index))

  const rewrites = audienceRewrites.map((audience, index) => rewriteForAudience(singlePosts[0], audience, index, brief))

  return {
    singlePosts,
    shortVariants,
    threads,
    audienceRewrites: rewrites,
    angleExplorer: createAngleExplorer(brief, controls),
    modularLines: createModularLines(brief, controls),
    creativeSuggestions: createCreativeSuggestions(brief),
  }
}

export function remixAd(source: GeneratedAd, brief: BrandBrief, controls: GenerationControls, remix: RemixKind): GeneratedAd {
  let body = source.body
  let angle = source.angle

  switch (remix) {
    case 'Shorter':
      body = shortenToLimit(trimFiller(body), 150)
      break
    case 'Sharper':
      body = shortenToLimit(body.replace(/\bhelps\b/gi, 'gives').replace(/\bshould\b/gi, 'need to'), 210)
      break
    case 'More premium':
      body = shortenToLimit(body.replace(/\bfast\b/gi, 'polished').replace(/\bbetter\b/gi, 'stronger').replace(/\bTry\b/gi, 'Explore'), 240)
      break
    case 'More casual':
      body = shortenToLimit(body.replace(/\bMost\b/gi, 'A lot of').replace(/\bteams\b/gi, 'people'), 230)
      break
    case 'More technical':
      body = shortenToLimit(compact(`${body} Built for teams that care about clear ownership, faster execution, and fewer coordination gaps.`), 260)
      break
    case 'More direct-response':
      body = shortenToLimit(compact(`${trimFiller(body)} ${formatCta(ctaForControl(brief, controls))}`), 240)
      break
    case 'Less hype':
      body = shortenToLimit(body.replace(/\bHot take:\s*/gi, '').replace(/\bwin\b/gi, 'work').replace(/\bbest\b/gi, 'strong'), 240)
      break
    case 'More specific':
      body = shortenToLimit(compact(`${body} Focus on ${decapitalize(brief.benefits[0] || 'a clearer outcome')} and ${decapitalize(brief.proofPoints[0] || 'a stronger proof point')}.`), 260)
      break
    case 'More founder voice':
      body = shortenToLimit(compact(`We built ${brief.companyName} because ${decapitalize(brief.painPoints[0] || 'the problem')} kept showing up. ${trimFiller(body)}`), 250)
      angle = 'Founder-led'
      break
    case 'More contrarian':
      body = shortenToLimit(compact(`Most teams are solving the wrong problem. ${trimFiller(body)}`), 240)
      angle = 'Contrarian'
      break
  }

  return {
    ...source,
    id: `${source.id}-${slugify(remix)}`,
    body,
    characterCount: body.length,
    angle,
    remixOf: source.id,
    whyItWorks: `${source.whyItWorks} Remixed to feel ${remix.toLowerCase()}.`,
    scores: scoreCopy(body, brief.proofPoints[0] ?? '', body.includes('?'), ctaForControl(brief, controls)),
  }
}

export function formatExport(snapshot: {
  brief: BrandBrief
  selectedAds: GeneratedAd[]
  selectedThreads: ThreadAd[]
}) {
  const adBlocks = snapshot.selectedAds.map(
    (ad, index) =>
      `${index + 1}. [${ad.angle}] ${ad.body}\nWhy it works: ${ad.whyItWorks}\nScore: ${ad.scores.overall}/100`,
  )

  const threadBlocks = snapshot.selectedThreads.map(
    (thread, index) =>
      `${index + 1}. [${thread.title}]\n${thread.posts.map((post, postIndex) => `Post ${postIndex + 1}: ${post}`).join('\n')}`,
  )

  return [
    `X Ad Copy Studio export`,
    `Company: ${snapshot.brief.companyName}`,
    `Offer: ${snapshot.brief.primaryOffer}`,
    '',
    'Selected ads',
    ...adBlocks,
    '',
    'Selected threads',
    ...threadBlocks,
  ]
    .filter(Boolean)
    .join('\n')
}
