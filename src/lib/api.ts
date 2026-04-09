import type { AnalysisResult, BrandBrief, CompetitorResearchResult, Tone } from '../types'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export function analyzeWebsite(url: string) {
  return postJson<AnalysisResult>('/.netlify/functions/analyze', { url })
}

export function generateCompetitorResearch(input: {
  competitorName: string
  brief: BrandBrief
  tone: Tone
}) {
  return postJson<CompetitorResearchResult>('/.netlify/functions/competitor-ads', input)
}
