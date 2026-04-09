export type Objective =
  | 'Awareness'
  | 'Traffic'
  | 'Conversions'
  | 'Signups'
  | 'App installs'
  | 'Waitlist'
  | 'Newsletter'
  | 'Product launch'

export type Tone =
  | 'Direct response'
  | 'Witty'
  | 'Premium'
  | 'Technical'
  | 'Founder-led'
  | 'Minimal'
  | 'Bold'
  | 'Friendly'
  | 'Contrarian'

export type AudienceType =
  | 'Founders'
  | 'Developers'
  | 'Consumers'
  | 'Ecommerce buyers'
  | 'Crypto users'
  | 'B2B operators'
  | 'Creators'
  | 'Agencies'
  | 'Enterprise buyers'
  | 'Growth teams'

export type CtaType =
  | 'Learn more'
  | 'Sign up'
  | 'Buy now'
  | 'Join waitlist'
  | 'Try free'
  | 'Book demo'

export type StyleConstraint =
  | 'No emojis'
  | 'No hashtags'
  | 'Punchier'
  | 'More curiosity'
  | 'More specificity'
  | 'Less hype'

export type PostFormat =
  | 'Single post'
  | 'Thread'
  | 'Reply-style ad'
  | 'Hook bank'
  | 'CTA bank'
  | 'Angle bank'

export type TabKey =
  | 'single'
  | 'short'
  | 'thread'
  | 'rewrites'
  | 'angles'
  | 'modules'
  | 'creative'

export type RemixKind =
  | 'Shorter'
  | 'Sharper'
  | 'More premium'
  | 'More casual'
  | 'More technical'
  | 'More direct-response'
  | 'Less hype'
  | 'More specific'
  | 'More founder voice'
  | 'More contrarian'

export interface BrandBrief {
  companyName: string
  oneLiner: string
  targetAudience: string
  primaryOffer: string
  benefits: string[]
  painPoints: string[]
  differentiators: string[]
  proofPoints: string[]
  desiredCta: string
  brandTone: string
  wordsToAvoid: string
  regionContext: string
}

export interface SourceEvidence {
  pageTitle: string
  metaDescription: string
  headlines: string[]
  snippets: string[]
  ctas: string[]
}

export interface AnalysisResult {
  mode: 'analyzed' | 'manual'
  url: string
  brief: BrandBrief
  evidence: SourceEvidence
  extractionScore: number
  notice?: string
}

export interface GenerationControls {
  objective: Objective
  tone: Tone
  audienceType: AudienceType
  aggressiveness: number
  outputCount: number
  ctaType: CtaType
  styleConstraints: StyleConstraint[]
  postFormat: PostFormat
}

export interface ScoreBreakdown {
  clarity: number
  specificity: number
  curiosity: number
  credibility: number
  urgency: number
  overall: number
}

export interface GeneratedAd {
  id: string
  body: string
  characterCount: number
  tone: Tone
  objective: Objective
  angle: string
  whyItWorks: string
  scores: ScoreBreakdown
  audienceLabel?: string
  remixOf?: string
}

export interface ThreadAd {
  id: string
  title: string
  angle: string
  whyItWorks: string
  posts: string[]
}

export interface AudienceRewrite {
  id: string
  audience: string
  body: string
  whyItWorks: string
}

export interface AngleInsight {
  id: string
  angle: string
  sample: string
  rationale: string
}

export interface ModularLine {
  id: string
  text: string
  category: 'Hook' | 'CTA' | 'Closer'
}

export interface CreativeSuggestion {
  id: string
  title: string
  description: string
  prompt: string
}

export interface CompetitorAd {
  id: string
  competitorName: string
  angle: string
  headline: string
  body: string
  cta: string
  rationale: string
}

export interface CompetitorAlternative {
  id: string
  sourceId: string
  angle: string
  headline: string
  body: string
  cta: string
  rationale: string
}

export interface CompetitorResearchResult {
  competitorName: string
  mode: 'ai' | 'fallback'
  notice: string
  ads: CompetitorAd[]
  alternatives: CompetitorAlternative[]
}

export interface GeneratedWorkspace {
  singlePosts: GeneratedAd[]
  shortVariants: GeneratedAd[]
  threads: ThreadAd[]
  audienceRewrites: AudienceRewrite[]
  angleExplorer: AngleInsight[]
  modularLines: ModularLine[]
  creativeSuggestions: CreativeSuggestion[]
}

export interface HistorySnapshot {
  id: string
  createdAt: string
  url: string
  brief: BrandBrief
  evidence: SourceEvidence
  controls: GenerationControls
  outputs: GeneratedWorkspace
  favoriteIds: string[]
  competitorResearch: CompetitorResearchResult | null
}
