import type { AnalysisResult, GenerationControls } from '../types'

export const demoUrl = 'https://linear.app'

export const demoAnalysis: AnalysisResult = {
  mode: 'analyzed',
  url: demoUrl,
  extractionScore: 92,
  brief: {
    companyName: 'Linear',
    oneLiner: 'A fast product management system for teams that want to plan, build, and ship without the usual process drag.',
    targetAudience: 'Product teams, engineering leaders, founders, and operators who care about speed and clarity.',
    primaryOffer: 'Issue tracking, project planning, and product workflows in one tight operating system.',
    benefits: [
      'Ship faster with cleaner planning and execution',
      'Keep roadmap, bugs, cycles, and collaboration in one place',
      'Reduce process overhead without losing visibility',
    ],
    painPoints: [
      'Slow, cluttered project tools',
      'Disconnected product and engineering workflows',
      'Status meetings that exist because no one trusts the system',
    ],
    differentiators: [
      'Exceptionally fast UX',
      'Minimal, opinionated workflows',
      'Built for teams that already move quickly',
    ],
    proofPoints: [
      'Loved by modern product and engineering teams',
      'Used for cycles, roadmaps, issues, and triage in one workflow',
      'Strong design reputation and premium product feel',
    ],
    desiredCta: 'Try Linear free',
    brandTone: 'Confident, polished, product-forward, and slightly understated.',
    wordsToAvoid: 'Revolutionary, game-changing, cheapest',
    regionContext: 'Global SaaS, English-speaking product teams',
  },
  evidence: {
    pageTitle: 'Linear | Plan and build products',
    metaDescription:
      'Linear streamlines issues, projects, and product roadmaps. Built for modern product teams.',
    headlines: [
      'Plan and build products',
      'Purpose-built for product development',
      'Fast software for fast-moving teams',
    ],
    snippets: [
      'Streamline issues, sprints, and product roadmaps.',
      'Keep product and engineering aligned without slowing the team down.',
      'A premium workflow for planning, building, and shipping.',
    ],
    ctas: ['Start building', 'Get started', 'Try free'],
  },
}

export const defaultControls: GenerationControls = {
  objective: 'Conversions',
  tone: 'Direct response',
  audienceType: 'B2B operators',
  aggressiveness: 58,
  outputCount: 6,
  ctaType: 'Try free',
  styleConstraints: ['No emojis', 'No hashtags', 'Punchier', 'More specificity'],
  postFormat: 'Single post',
}
