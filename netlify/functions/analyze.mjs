import * as cheerio from 'cheerio'

const defaultHeaders = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  }
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
  return value.replace(/\s+/g, ' ').trim()
}

function uniq(items) {
  return [...new Set(items.filter(Boolean).map(clean))].filter(Boolean)
}

function first(items, fallback = '') {
  return items.find(Boolean) || fallback
}

function takeBest(items, limit) {
  return uniq(items)
    .filter((item) => item.length > 22 && item.length < 180)
    .slice(0, limit)
}

function sentenceCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

function guessCompanyName($, pageTitle, hostname) {
  return (
    clean($('meta[property="og:site_name"]').attr('content') || '') ||
    clean($('meta[name="application-name"]').attr('content') || '') ||
    pageTitle.split('|')[0].split('-')[0].trim() ||
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
    ...ctas,
    ...bodyText.match(/\b(book demo|try free|get started|learn more|join waitlist|sign up|start free)\b/gi) ?? [],
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
  const candidates = [
    ...snippets.filter((item) => /\bslow|manual|fragmented|messy|bloated|complex|hard|spend too much time|waste\b/i.test(item)),
  ]

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
  const metaDescription =
    clean($('meta[name="description"]').attr('content') || '') ||
    clean($('meta[property="og:description"]').attr('content') || '')

  const headlines = takeBest(
    $('h1, h2, h3')
      .toArray()
      .map((node) => $(node).text()),
    8,
  )

  const snippets = takeBest(
    $('p, li')
      .toArray()
      .map((node) => $(node).text()),
    12,
  )

  const ctas = uniq(
    $('a, button')
      .toArray()
      .map((node) => $(node).text())
      .filter((item) => /\b(book|try|get started|learn|join|sign|start|request|contact|talk)\b/i.test(item)),
  ).slice(0, 8)

  return { pageTitle, metaDescription, headlines, snippets, ctas }
}

export default async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  let payload = {}
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const normalizedUrl = normalizeUrl(payload.url)
  if (!normalizedUrl) {
    return json(400, { error: 'Invalid URL' })
  }

  try {
    const response = await fetch(normalizedUrl, { headers: defaultHeaders, redirect: 'follow' })
    if (!response.ok) {
      throw new Error(`Upstream response ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const evidence = extractEvidence($)
    const hostname = new URL(normalizedUrl).hostname
    const bodyText = clean($('body').text().slice(0, 6000))

    const oneLiner = first(
      [
        evidence.metaDescription,
        evidence.headlines[0],
        evidence.snippets[0],
      ],
      'Modern software product with a clear offer and marketable value proposition',
    )

    const benefits = inferBenefits(evidence.headlines, evidence.snippets)
    const proofPoints = inferProofPoints(evidence.snippets, bodyText)
    const painPoints = inferPainPoints(evidence.snippets, bodyText)
    const differentiators = inferDifferentiators(evidence.snippets, evidence.headlines, bodyText)
    const audience = inferAudience(`${evidence.headlines.join(' ')} ${evidence.snippets.join(' ')} ${bodyText}`)
    const extractionScore = Math.min(
      96,
      44 +
        evidence.headlines.length * 5 +
        evidence.snippets.length * 2 +
        (evidence.metaDescription ? 12 : 0) +
        (evidence.ctas.length ? 6 : 0),
    )

    const brief = {
      companyName: guessCompanyName($, evidence.pageTitle, hostname),
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

    if (extractionScore < 58 || (!evidence.pageTitle && !evidence.metaDescription && evidence.headlines.length < 2)) {
      return json(200, {
        mode: 'manual',
        url: normalizedUrl,
        brief,
        evidence,
        extractionScore,
        notice:
          'We could not extract enough detail from that URL. You can still generate strong copy by filling in a few fields manually.',
      })
    }

    return json(200, {
      mode: 'analyzed',
      url: normalizedUrl,
      brief,
      evidence,
      extractionScore,
    })
  } catch {
    return json(200, {
      mode: 'manual',
      url: normalizedUrl,
      brief: {
        companyName: '',
        oneLiner: '',
        targetAudience: '',
        primaryOffer: '',
        benefits: ['', '', ''],
        painPoints: ['', '', ''],
        differentiators: ['', '', ''],
        proofPoints: ['', '', ''],
        desiredCta: '',
        brandTone: '',
        wordsToAvoid: 'Generic hype, empty superlatives',
        regionContext: '',
      },
      evidence: {
        pageTitle: '',
        metaDescription: '',
        headlines: [],
        snippets: [],
        ctas: [],
      },
      extractionScore: 24,
      notice:
        'We could not extract enough detail from that URL. You can still generate strong copy by filling in a few fields manually.',
    })
  }
}
