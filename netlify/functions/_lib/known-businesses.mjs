const knownBusinesses = [
  {
    name: 'Notion',
    aliases: ['notion'],
    category: 'workspace software',
    audience: 'knowledge workers, startups, and cross-functional teams',
    offer: 'docs, projects, wikis, and AI workflows in one workspace',
    tone: 'clean, flexible, and possibility-driven',
    differentiators: ['all-in-one workspace', 'template-led onboarding', 'AI built into the workspace'],
    proof: ['widely adopted by startups and creative teams', 'recognized for flexible workflows'],
    ctas: ['Get Notion free', 'Try Notion AI', 'See the templates'],
  },
  {
    name: 'Linear',
    aliases: ['linear'],
    category: 'product development software',
    audience: 'product teams, engineering leaders, and founders',
    offer: 'issue tracking and product planning for fast-moving teams',
    tone: 'sharp, premium, and understated',
    differentiators: ['fast UX', 'opinionated workflows', 'tight engineering-product alignment'],
    proof: ['popular with modern product teams', 'known for premium product craft'],
    ctas: ['Try Linear free', 'See the workflow', 'Start building'],
  },
  {
    name: 'Figma',
    aliases: ['figma'],
    category: 'design collaboration software',
    audience: 'designers, product teams, and agencies',
    offer: 'collaborative design, prototyping, and dev handoff in the browser',
    tone: 'creative, collaborative, and momentum-heavy',
    differentiators: ['multiplayer editing', 'browser-native collaboration', 'shared design system workflows'],
    proof: ['standard tool across many product organizations', 'used from ideation through handoff'],
    ctas: ['Start designing', 'Try Figma', 'Explore Dev Mode'],
  },
  {
    name: 'Canva',
    aliases: ['canva'],
    category: 'visual content software',
    audience: 'marketers, creators, educators, and small businesses',
    offer: 'fast design creation for social, presentations, docs, and branded assets',
    tone: 'accessible, upbeat, and outcome-focused',
    differentiators: ['easy templates', 'brand kit workflows', 'simple team collaboration'],
    proof: ['mass-market adoption', 'used by individuals and teams worldwide'],
    ctas: ['Start designing', 'Try Canva Pro', 'Create faster'],
  },
  {
    name: 'Shopify',
    aliases: ['shopify'],
    category: 'commerce platform',
    audience: 'commerce brands, founders, and retail operators',
    offer: 'commerce infrastructure for storefronts, payments, and growth',
    tone: 'confident, practical, and growth-oriented',
    differentiators: ['commerce-native operating system', 'broad app ecosystem', 'strong checkout and payments'],
    proof: ['trusted by brands at multiple scales', 'recognized ecommerce platform'],
    ctas: ['Start free trial', 'Sell everywhere', 'Launch your store'],
  },
  {
    name: 'Slack',
    aliases: ['slack'],
    category: 'team communication software',
    audience: 'knowledge teams, operators, and enterprises',
    offer: 'team communication and coordination across projects and functions',
    tone: 'friendly, productive, and team-centric',
    differentiators: ['channel-based communication', 'searchable team context', 'deep integrations'],
    proof: ['used widely across modern workplaces', 'embedded into daily team workflows'],
    ctas: ['Try Slack', 'See Slack in action', 'Bring your team together'],
  },
  {
    name: 'HubSpot',
    aliases: ['hubspot'],
    category: 'CRM and marketing platform',
    audience: 'sales, marketing, and customer teams',
    offer: 'CRM, automation, and go-to-market tools in one platform',
    tone: 'helpful, educational, and conversion-minded',
    differentiators: ['all-in-one GTM stack', 'strong educational brand', 'broad funnel coverage'],
    proof: ['large customer base across SMB and mid-market', 'strong category recognition'],
    ctas: ['Get a demo', 'Start free', 'See the platform'],
  },
  {
    name: 'Webflow',
    aliases: ['webflow'],
    category: 'website experience platform',
    audience: 'designers, marketers, and web teams',
    offer: 'visual web development, CMS, and site management without heavy engineering overhead',
    tone: 'design-forward, capable, and modern',
    differentiators: ['visual development', 'CMS flexibility', 'marketing-owned site velocity'],
    proof: ['strong reputation with design and marketing teams', 'widely used for high-polish websites'],
    ctas: ['Build with Webflow', 'Start for free', 'See what is possible'],
  },
  {
    name: 'Loom',
    aliases: ['loom'],
    category: 'async video communication',
    audience: 'remote teams, support, sales, and internal operators',
    offer: 'quick async video messaging for clarity and speed',
    tone: 'clear, human, and practical',
    differentiators: ['asynchronous video-first communication', 'fast recording workflow', 'easy sharing'],
    proof: ['common async tool across remote teams', 'popular for internal updates and walkthroughs'],
    ctas: ['Record with Loom', 'Try Loom', 'Share an update'],
  },
  {
    name: 'Stripe',
    aliases: ['stripe'],
    category: 'payments infrastructure',
    audience: 'developers, founders, and internet businesses',
    offer: 'payments, billing, and financial infrastructure for internet companies',
    tone: 'technical, credible, and high-trust',
    differentiators: ['developer-first APIs', 'global payments coverage', 'broad financial tooling'],
    proof: ['used by startups and major internet businesses', 'strong developer brand recognition'],
    ctas: ['Start with Stripe', 'Talk to sales', 'See the docs'],
  },
  {
    name: 'Duolingo',
    aliases: ['duolingo'],
    category: 'consumer learning app',
    audience: 'language learners and casual mobile users',
    offer: 'habit-forming language learning through short lessons and gamification',
    tone: 'playful, motivational, and mainstream-friendly',
    differentiators: ['gamified progress loops', 'short daily lessons', 'strong mascot-led brand'],
    proof: ['mass consumer adoption', 'high cultural visibility'],
    ctas: ['Start learning', 'Try Super Duolingo', 'Keep your streak'],
  },
]

function clean(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

export function findKnownBusinessProfile(name) {
  const normalized = clean(name).toLowerCase()
  if (!normalized) return null

  return (
    knownBusinesses.find(
      (item) =>
        item.name.toLowerCase() === normalized ||
        item.aliases.some((alias) => alias === normalized) ||
        normalized.includes(item.name.toLowerCase()),
    ) ?? null
  )
}

export function createGenericBusinessProfile(name) {
  const businessName = clean(name) || 'This business'

  return {
    name: businessName,
    aliases: [businessName.toLowerCase()],
    category: 'modern digital business',
    audience: 'buyers already comparing options in the category',
    offer: `a more polished customer-facing experience from ${businessName}`,
    tone: 'clear, modern, and benefit-led',
    differentiators: ['cleaner positioning', 'stronger perceived ease of use', 'sharper message-to-offer fit'],
    proof: ['recognizable market presence', 'enough brand familiarity to anchor realistic ad copy'],
    ctas: [`Explore ${businessName}`, `See ${businessName}`, `Learn more about ${businessName}`],
  }
}
