import { startTransition, useEffect, useEffectEvent, useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import { defaultControls, demoAnalysis, demoUrl } from './data/demo'
import { formatExport, generateWorkspace, remixAd } from './lib/generator'
import type {
  AnalysisResult,
  BrandBrief,
  GeneratedAd,
  GeneratedWorkspace,
  HistorySnapshot,
  ModularLine,
  RemixKind,
  SourceEvidence,
  StyleConstraint,
  TabKey,
} from './types'

const analysisSteps = [
  'Fetching website',
  'Extracting messaging',
  'Identifying audience and offer',
  'Generating X ad angles',
]

const remixKinds: RemixKind[] = [
  'Shorter',
  'Sharper',
  'More premium',
  'More casual',
  'More technical',
  'More direct-response',
  'Less hype',
  'More specific',
  'More founder voice',
  'More contrarian',
]

const styleConstraints: StyleConstraint[] = [
  'No emojis',
  'No hashtags',
  'Punchier',
  'More curiosity',
  'More specificity',
  'Less hype',
]

const storageKeys = {
  history: 'x-ad-copy-studio-history',
  onboarding: 'x-ad-copy-studio-onboarding-dismissed',
}

const tabLabels: Record<TabKey, string> = {
  single: 'Single-post ads',
  short: 'Short-form variants',
  thread: 'Thread-style ads',
  rewrites: 'Audience-specific rewrites',
  angles: 'Angle explorer',
  modules: 'Hooks and CTAs',
  creative: 'Creative suggestions',
}

type PreviewState =
  | { kind: 'ad'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'rewrite'; id: string }

type LockState = Record<keyof BrandBrief, boolean>

function createEmptyBrief(): BrandBrief {
  return {
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
    wordsToAvoid: '',
    regionContext: '',
  }
}

function createEmptyEvidence(): SourceEvidence {
  return {
    pageTitle: '',
    metaDescription: '',
    headlines: [],
    snippets: [],
    ctas: [],
  }
}

function createLockState(): LockState {
  return {
    companyName: false,
    oneLiner: false,
    targetAudience: false,
    primaryOffer: false,
    benefits: false,
    painPoints: false,
    differentiators: false,
    proofPoints: false,
    desiredCta: false,
    brandTone: false,
    wordsToAvoid: false,
    regionContext: false,
  }
}

function parseLines(value: string) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length ? lines : ['', '', '']
}

function joinLines(value: string[]) {
  return value.filter(Boolean).join('\n')
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function mapFormatToTab(format: string): TabKey {
  switch (format) {
    case 'Thread':
      return 'thread'
    case 'Hook bank':
    case 'CTA bank':
      return 'modules'
    case 'Angle bank':
      return 'angles'
    default:
      return 'single'
  }
}

function mergeWithLocks(current: BrandBrief, incoming: BrandBrief, locks: LockState) {
  const next = { ...incoming } as BrandBrief
  ;(Object.keys(locks) as (keyof BrandBrief)[]).forEach((key) => {
    if (locks[key]) {
      next[key] = current[key] as never
    }
  })
  return next
}

function flattenAds(outputs: GeneratedWorkspace | null) {
  if (!outputs) return []
  return [...outputs.singlePosts, ...outputs.shortVariants]
}

function findAd(outputs: GeneratedWorkspace | null, id: string) {
  return flattenAds(outputs).find((ad) => ad.id === id) ?? null
}

function findThread(outputs: GeneratedWorkspace | null, id: string) {
  return outputs?.threads.find((thread) => thread.id === id) ?? null
}

function findRewrite(outputs: GeneratedWorkspace | null, id: string) {
  return outputs?.audienceRewrites.find((rewrite) => rewrite.id === id) ?? null
}

function scoreToneClass(score: number) {
  if (score >= 88) return 'excellent'
  if (score >= 76) return 'strong'
  return 'steady'
}

function App() {
  const [urlInput, setUrlInput] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [brief, setBrief] = useState<BrandBrief>(createEmptyBrief)
  const [controls, setControls] = useState(defaultControls)
  const [outputs, setOutputs] = useState<GeneratedWorkspace | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('single')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([])
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [seed, setSeed] = useState(0)
  const [expandedRemixId, setExpandedRemixId] = useState('')
  const [locks, setLocks] = useState<LockState>(createLockState)
  const [history, setHistory] = useState<HistorySnapshot[]>([])
  const [onboardingStep, setOnboardingStep] = useState(0)

  const selectedAds = flattenAds(outputs).filter((ad) => selectedAdIds.includes(ad.id))
  const compareAds = selectedAds.slice(0, 2)
  const selectedThreads = outputs?.threads.filter((thread) => selectedThreadIds.includes(thread.id)) ?? []
  const favoriteAds = flattenAds(outputs).filter((ad) => favoriteIds.includes(ad.id))

  useEffect(() => {
    const savedHistory = localStorage.getItem(storageKeys.history)
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory) as HistorySnapshot[])
      } catch {
        localStorage.removeItem(storageKeys.history)
      }
    }

    if (localStorage.getItem(storageKeys.onboarding) !== 'dismissed') {
      setOnboardingStep(1)
    }
  }, [])

  useEffect(() => {
    if (!isAnalyzing) return
    const interval = window.setInterval(() => {
      setAnalysisStep((step) => (step < analysisSteps.length - 1 ? step + 1 : step))
    }, 800)

    return () => window.clearInterval(interval)
  }, [isAnalyzing])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!analysis || !outputs) return

    const nextId = workspaceId || crypto.randomUUID()
    if (!workspaceId) {
      setWorkspaceId(nextId)
    }

    const snapshot: HistorySnapshot = {
      id: nextId,
      createdAt: new Date().toISOString(),
      url: analysis.url,
      brief,
      evidence: analysis.evidence,
      controls,
      outputs,
      favoriteIds,
    }

    setHistory((current) => {
      const next = [snapshot, ...current.filter((item) => item.id !== nextId)].slice(0, 8)
      localStorage.setItem(storageKeys.history, JSON.stringify(next))
      return next
    })
  }, [analysis, brief, controls, outputs, favoriteIds, workspaceId])

  const handleKeyboardActions = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    if (typing || !preview || preview.kind !== 'ad') return

    const current = findAd(outputs, preview.id)
    if (!current) return

    if (event.key === 'c') {
      event.preventDefault()
      void copyText(current.body)
    }
    if (event.key === 'f') {
      event.preventDefault()
      toggleFavorite(current.id)
    }
    if (event.key === 's') {
      event.preventDefault()
      applyRemix(current, 'Shorter')
    }
    if (event.key === 'x') {
      event.preventDefault()
      applyRemix(current, 'Sharper')
    }
  })

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      handleKeyboardActions(event)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setToast('Copied to clipboard')
  }

  function generateFromBrief(nextBrief = brief, nextControls = controls, nextSeed = seed) {
    const generated = generateWorkspace(nextBrief, nextControls, nextSeed)
    startTransition(() => {
      setOutputs(generated)
      setPreview({ kind: 'ad', id: generated.singlePosts[0].id })
      setActiveTab(mapFormatToTab(nextControls.postFormat))
    })
  }

  function hydrateWorkspace(result: AnalysisResult, nextBrief = result.brief, nextControls = controls, nextSeed = 0) {
    setAnalysis(result)
    setBrief(nextBrief)
    setSeed(nextSeed)
    setWorkspaceId('')
    const generated = generateWorkspace(nextBrief, nextControls, nextSeed)
    setOutputs(generated)
    setPreview({ kind: 'ad', id: generated.singlePosts[0].id })
    setActiveTab(mapFormatToTab(nextControls.postFormat))
  }

  async function analyzeUrl(url: string, useDemo = false) {
    setIsAnalyzing(true)
    setAnalysisStep(0)
    setExpandedRemixId('')

    try {
      if (useDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200))
        hydrateWorkspace(demoAnalysis, demoAnalysis.brief)
        setUrlInput(demoUrl)
        setFavoriteIds([])
        setSelectedAdIds([])
        setSelectedThreadIds([])
        return
      }

      const response = await fetch('/.netlify/functions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const result = (await response.json()) as AnalysisResult
      const mergedBrief = analysis ? mergeWithLocks(brief, result.brief, locks) : result.brief
      hydrateWorkspace(result, mergedBrief, controls, 0)
      setFavoriteIds([])
      setSelectedAdIds([])
      setSelectedThreadIds([])
    } catch {
      const manualResult: AnalysisResult = {
        mode: 'manual',
        url,
        extractionScore: 30,
        notice: 'We could not extract enough detail from that URL. You can still generate strong copy by filling in the brand brief manually.',
        brief: mergeWithLocks(
          brief,
          {
            ...createEmptyBrief(),
            companyName: brief.companyName,
            oneLiner: brief.oneLiner,
            targetAudience: brief.targetAudience,
            primaryOffer: brief.primaryOffer,
            desiredCta: brief.desiredCta,
          },
          locks,
        ),
        evidence: createEmptyEvidence(),
      }

      hydrateWorkspace(manualResult, manualResult.brief)
      setToast('Switched to manual mode')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function updateBriefField<K extends keyof BrandBrief>(key: K, value: BrandBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }))
  }

  function toggleLock(key: keyof BrandBrief) {
    setLocks((current) => ({ ...current, [key]: !current[key] }))
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]
      setToast(next.includes(id) ? 'Added to favorites' : 'Removed from favorites')
      return next
    })
  }

  function toggleAdSelection(id: string) {
    setSelectedAdIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
  }

  function toggleThreadSelection(id: string) {
    setSelectedThreadIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
  }

  function replaceAdInWorkspace(id: string, nextAd: GeneratedAd) {
    setOutputs((current) => {
      if (!current) return current
      return {
        ...current,
        singlePosts: current.singlePosts.map((ad) => (ad.id === id ? nextAd : ad)),
        shortVariants: current.shortVariants.map((ad) => (ad.id === id ? nextAd : ad)),
      }
    })
    setPreview({ kind: 'ad', id: nextAd.id })
  }

  function applyRemix(source: GeneratedAd, remix: RemixKind) {
    const nextAd = remixAd(source, brief, controls, remix)
    replaceAdInWorkspace(source.id, nextAd)
    setToast(`${remix} applied`)
  }

  function regenerateSingle(id: string, index: number, collection: 'single' | 'short') {
    const nextSeed = seed + index + 1
    const generated = generateWorkspace(brief, controls, nextSeed)
    const source = collection === 'single' ? generated.singlePosts[index] : generated.shortVariants[index]
    setSeed(nextSeed)
    replaceAdInWorkspace(id, source)
    setToast('Variation regenerated')
  }

  function regenerateAll() {
    const nextSeed = seed + 1
    setSeed(nextSeed)
    generateFromBrief(brief, controls, nextSeed)
    setPreview(null)
    setToast('Fresh variations generated')
  }

  function restoreHistoryItem(item: HistorySnapshot) {
    setAnalysis({
      mode: 'analyzed',
      url: item.url,
      brief: item.brief,
      evidence: item.evidence,
      extractionScore: 78,
    })
    setUrlInput(item.url)
    setBrief(item.brief)
    setControls(item.controls)
    setOutputs(item.outputs)
    setFavoriteIds(item.favoriteIds)
    setWorkspaceId(item.id)
    setPreview({ kind: 'ad', id: item.outputs.singlePosts[0].id })
    setActiveTab(mapFormatToTab(item.controls.postFormat))
    setToast('Workspace restored')
  }

  function exportSelected() {
    const text = formatExport({ brief, selectedAds, selectedThreads })
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${(brief.companyName || 'x-ad-copy').toLowerCase().replace(/\s+/g, '-')}-export.txt`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    setToast('Export created')
  }

  function dismissOnboarding() {
    setOnboardingStep(0)
    localStorage.setItem(storageKeys.onboarding, 'dismissed')
  }

  function renderAdCard(ad: GeneratedAd, index: number, collection: 'single' | 'short') {
    const selected = selectedAdIds.includes(ad.id)
    const favorite = favoriteIds.includes(ad.id)

    return (
      <article
        key={ad.id}
        className={clsx('output-card', selected && 'selected', preview?.kind === 'ad' && preview.id === ad.id && 'active')}
        onClick={() => setPreview({ kind: 'ad', id: ad.id })}
      >
        <div className="card-topline">
          <div className="card-tags">
            <span>{ad.tone}</span>
            <span>{ad.objective}</span>
            <span>{ad.angle}</span>
          </div>
          <button
            className={clsx('favorite-button', favorite && 'active')}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              toggleFavorite(ad.id)
            }}
            aria-label="Favorite variation"
          >
            {favorite ? '★' : '☆'}
          </button>
        </div>

        <p className="ad-body">{ad.body}</p>

        <div className="card-meta">
          <span>{ad.characterCount} chars</span>
          <span className={`score-pill ${scoreToneClass(ad.scores.overall)}`}>Strength {ad.scores.overall}</span>
        </div>

        <p className="why-it-works">{ad.whyItWorks}</p>

        <div className="score-grid">
          {Object.entries(ad.scores)
            .filter(([key]) => key !== 'overall')
            .map(([key, value]) => (
              <div key={key} className="score-row">
                <span>{key}</span>
                <div className="score-bar">
                  <div style={{ width: `${value}%` }} />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
        </div>

        <div className="card-actions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void copyText(ad.body)
            }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              toggleAdSelection(ad.id)
            }}
          >
            {selected ? 'Selected' : 'Select'}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              regenerateSingle(ad.id, index, collection)
            }}
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setExpandedRemixId((current) => (current === ad.id ? '' : ad.id))
            }}
          >
            Remix
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              applyRemix(ad, 'Shorter')
            }}
          >
            Shorten
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              applyRemix(ad, 'Sharper')
            }}
          >
            Make sharper
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              applyRemix(ad, 'Less hype')
            }}
          >
            Make less salesy
          </button>
        </div>

        {expandedRemixId === ad.id ? (
          <div className="remix-grid">
            {remixKinds.map((remix) => (
              <button
                key={remix}
                type="button"
                className="ghost-chip"
                onClick={(event) => {
                  event.stopPropagation()
                  applyRemix(ad, remix)
                }}
              >
                {remix}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    )
  }

  function renderModuleLine(item: ModularLine) {
    return (
      <div key={item.id} className="module-line">
        <span className="line-tag">{item.category}</span>
        <p>{item.text}</p>
        <button type="button" onClick={() => void copyText(item.text)}>
          Copy
        </button>
      </div>
    )
  }

  const previewAd = preview?.kind === 'ad' ? findAd(outputs, preview.id) : null
  const previewThread = preview?.kind === 'thread' ? findThread(outputs, preview.id) : null
  const previewRewrite = preview?.kind === 'rewrite' ? findRewrite(outputs, preview.id) : null

  function renderBriefField(
    label: string,
    key: keyof BrandBrief,
    type: 'input' | 'textarea' | 'list' = 'input',
    placeholder = '',
  ) {
    const locked = locks[key]

    return (
      <label className="field">
        <span className="field-head">
          <span>{label}</span>
          <button type="button" className={clsx('lock-button', locked && 'locked')} onClick={() => toggleLock(key)}>
            {locked ? 'Locked' : 'Lock'}
          </button>
        </span>
        {type === 'input' ? (
          <input
            value={brief[key] as string}
            placeholder={placeholder}
            onChange={(event) => updateBriefField(key, event.target.value as BrandBrief[typeof key])}
          />
        ) : null}
        {type === 'textarea' ? (
          <textarea
            value={brief[key] as string}
            placeholder={placeholder}
            rows={3}
            onChange={(event) => updateBriefField(key, event.target.value as BrandBrief[typeof key])}
          />
        ) : null}
        {type === 'list' ? (
          <textarea
            value={joinLines(brief[key] as string[])}
            placeholder={placeholder}
            rows={4}
            onChange={(event) => updateBriefField(key, parseLines(event.target.value) as BrandBrief[typeof key])}
          />
        ) : null}
      </label>
    )
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />

      <header className="hero-panel">
        <div className="nav-row">
          <div className="brand-lockup">
            <div className="brand-mark">X</div>
            <div>
              <p className="eyebrow">Website to X performance copy</p>
              <h1>X Ad Copy Studio</h1>
            </div>
          </div>
          <div className="status-cluster">
            <span className="status-badge">Brand brief extraction</span>
            <span className="status-badge muted">X-native outputs</span>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="lead">
              Turn a website URL into a structured brand brief, angle library, and usable X ads without starting from a blank page.
            </p>
            <div className="hero-metrics">
              <div>
                <strong>7</strong>
                <span>output modes</span>
              </div>
              <div>
                <strong>9</strong>
                <span>angle families</span>
              </div>
              <div>
                <strong>1-click</strong>
                <span>remix workflow</span>
              </div>
            </div>
          </div>

          <form
            className="url-panel"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              if (!urlInput.trim()) return
              void analyzeUrl(urlInput.trim())
            }}
          >
            <label>
              <span>Website URL</span>
              <input
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://yourcompany.com"
              />
            </label>
            <div className="hero-actions">
              <button className="primary-button" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? 'Analyzing…' : 'Analyze website'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void analyzeUrl(demoUrl, true)}
                disabled={isAnalyzing}
              >
                Try demo
              </button>
            </div>
            <p className="hero-note">Best for SaaS, apps, newsletters, products, and founder-led landing pages.</p>
          </form>
        </div>
      </header>

      {onboardingStep ? (
        <aside className="onboarding-card">
          <p className="eyebrow">Quick tour {onboardingStep}/3</p>
          {onboardingStep === 1 ? <p>Start with a URL or the demo mode. The app pulls evidence before it generates copy.</p> : null}
          {onboardingStep === 2 ? <p>Lock any brand brief field you trust so later analyses or regenerations do not overwrite it.</p> : null}
          {onboardingStep === 3 ? <p>Select two versions to compare side by side, then export the best ones as plain text.</p> : null}
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={dismissOnboarding}>
              Dismiss
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                if (onboardingStep === 3) {
                  dismissOnboarding()
                  return
                }
                setOnboardingStep((current) => current + 1)
              }}
            >
              {onboardingStep === 3 ? 'Done' : 'Next'}
            </button>
          </div>
        </aside>
      ) : null}

      {isAnalyzing ? (
        <section className="analysis-state">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Analysis in progress</p>
              <h2>Building the brand brief</h2>
            </div>
            <span className="status-badge">Live scrape</span>
          </div>
          <div className="step-list">
            {analysisSteps.map((step, index) => (
              <div key={step} className={clsx('step-item', index <= analysisStep && 'active', index < analysisStep && 'done')}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!analysis || !outputs ? (
        <section className="empty-state-grid">
          <div className="panel feature-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">What you get</p>
                <h2>A serious operator workflow</h2>
              </div>
            </div>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>Structured extraction</h3>
                <p>Pulls product positioning, audience, value proposition, proof, CTA language, and source evidence into one editable brief.</p>
              </div>
              <div className="feature-card">
                <h3>X-native generation</h3>
                <p>Generates hooks, single posts, short variants, thread sequences, rewrite sets, modular CTAs, and creative directions.</p>
              </div>
              <div className="feature-card">
                <h3>Real workflow controls</h3>
                <p>Objective, tone, audience, aggressiveness, style constraints, and lockable brief fields keep output usable instead of generic.</p>
              </div>
            </div>
          </div>

          <div className="panel feature-panel preview-mock">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Example output</p>
                <h2>What a generated card feels like</h2>
              </div>
            </div>
            <div className="mock-card">
              <div className="card-tags">
                <span>Direct response</span>
                <span>Conversions</span>
                <span>Pain-point</span>
              </div>
              <p className="ad-body">Most product teams do not need more process. They need a tighter system for planning and shipping. Try the workflow that removes drag before the next launch.</p>
              <div className="card-meta">
                <span>176 chars</span>
                <span className="score-pill strong">Strength 86</span>
              </div>
              <p className="why-it-works">Tight, clear, and shaped for X instead of generic social media filler.</p>
            </div>
          </div>
        </section>
      ) : (
        <main className="workspace-grid">
          <section className="left-column">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Analysis summary</p>
                  <h2>{analysis.mode === 'manual' ? 'Manual fallback ready' : 'Brand brief extracted'}</h2>
                </div>
                <span className="status-badge">Score {analysis.extractionScore}</span>
              </div>
              <div className="summary-row">
                <span>{analysis.url}</span>
                <button className="text-button" type="button" onClick={() => void analyzeUrl(analysis.url)}>
                  Re-analyze
                </button>
              </div>
              {analysis.notice ? <div className="alert-banner">{analysis.notice}</div> : null}
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Editable brief</p>
                  <h2>Brand Brief</h2>
                </div>
                <span className="status-badge muted">Locks persist during re-analysis</span>
              </div>
              <div className="field-grid">
                {renderBriefField('Product / company name', 'companyName', 'input', 'Acme')}
                {renderBriefField('One-line description', 'oneLiner', 'textarea', 'What the company appears to offer')}
                {renderBriefField('Target audience', 'targetAudience', 'textarea', 'Who this is for')}
                {renderBriefField('Primary offer', 'primaryOffer', 'textarea', 'Core offer or product')}
                {renderBriefField('Top 3 benefits', 'benefits', 'list', 'One benefit per line')}
                {renderBriefField('Top 3 pain points solved', 'painPoints', 'list', 'One pain point per line')}
                {renderBriefField('Differentiators', 'differentiators', 'list', 'Why it is different')}
                {renderBriefField('Proof / trust signals', 'proofPoints', 'list', 'Social proof, numbers, trust markers')}
                {renderBriefField('Desired CTA', 'desiredCta', 'input', 'Try free')}
                {renderBriefField('Brand tone', 'brandTone', 'textarea', 'How the brand tends to sound')}
                {renderBriefField('Words to avoid', 'wordsToAvoid', 'textarea', 'Words or phrases to avoid')}
                {renderBriefField('Region / market context', 'regionContext', 'textarea', 'Region, market, language context')}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Generation controls</p>
                  <h2>Dial the output</h2>
                </div>
              </div>
              <div className="control-grid">
                <label className="field">
                  <span>Campaign objective</span>
                  <select value={controls.objective} onChange={(event) => setControls((current) => ({ ...current, objective: event.target.value as typeof current.objective }))}>
                    {['Awareness', 'Traffic', 'Conversions', 'Signups', 'App installs', 'Waitlist', 'Newsletter', 'Product launch'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Tone</span>
                  <select value={controls.tone} onChange={(event) => setControls((current) => ({ ...current, tone: event.target.value as typeof current.tone }))}>
                    {['Direct response', 'Witty', 'Premium', 'Technical', 'Founder-led', 'Minimal', 'Bold', 'Friendly', 'Contrarian'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Audience type</span>
                  <select value={controls.audienceType} onChange={(event) => setControls((current) => ({ ...current, audienceType: event.target.value as typeof current.audienceType }))}>
                    {['Founders', 'Developers', 'Consumers', 'Ecommerce buyers', 'Crypto users', 'B2B operators', 'Creators', 'Agencies', 'Enterprise buyers', 'Growth teams'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Output count</span>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={controls.outputCount}
                    onChange={(event) => setControls((current) => ({ ...current, outputCount: Number(event.target.value) }))}
                  />
                </label>
                <label className="field">
                  <span>CTA type</span>
                  <select value={controls.ctaType} onChange={(event) => setControls((current) => ({ ...current, ctaType: event.target.value as typeof current.ctaType }))}>
                    {['Learn more', 'Sign up', 'Buy now', 'Join waitlist', 'Try free', 'Book demo'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Post format focus</span>
                  <select value={controls.postFormat} onChange={(event) => setControls((current) => ({ ...current, postFormat: event.target.value as typeof current.postFormat }))}>
                    {['Single post', 'Thread', 'Reply-style ad', 'Hook bank', 'CTA bank', 'Angle bank'].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-span">
                  <span>Aggressiveness</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={controls.aggressiveness}
                    onChange={(event) => setControls((current) => ({ ...current, aggressiveness: Number(event.target.value) }))}
                  />
                  <div className="slider-labels">
                    <span>Safe</span>
                    <span>Balanced</span>
                    <span>Bold</span>
                  </div>
                </label>
                <div className="field field-span">
                  <span>Style constraints</span>
                  <div className="chip-row">
                    {styleConstraints.map((constraint) => {
                      const active = controls.styleConstraints.includes(constraint)
                      return (
                        <button
                          key={constraint}
                          type="button"
                          className={clsx('ghost-chip', active && 'active')}
                          onClick={() =>
                            setControls((current) => ({
                              ...current,
                              styleConstraints: active
                                ? current.styleConstraints.filter((item) => item !== constraint)
                                : [...current.styleConstraints, constraint],
                            }))
                          }
                        >
                          {constraint}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="hero-actions stretch">
                <button className="primary-button" type="button" onClick={() => generateFromBrief()}>
                  Generate copy
                </button>
                <button className="secondary-button" type="button" onClick={regenerateAll}>
                  Regenerate all
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Source evidence</p>
                  <h2>What the app pulled from the site</h2>
                </div>
              </div>
              <div className="evidence-list">
                <div className="evidence-block">
                  <span>Page title</span>
                  <p>{analysis.evidence.pageTitle || 'No page title extracted'}</p>
                </div>
                <div className="evidence-block">
                  <span>Meta description</span>
                  <p>{analysis.evidence.metaDescription || 'No meta description extracted'}</p>
                </div>
                <div className="evidence-block">
                  <span>Headlines</span>
                  <ul>
                    {(analysis.evidence.headlines.length ? analysis.evidence.headlines : ['No headlines extracted']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="evidence-block">
                  <span>Key snippets</span>
                  <ul>
                    {(analysis.evidence.snippets.length ? analysis.evidence.snippets : ['No strong value snippets extracted']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="evidence-block">
                  <span>CTA text found</span>
                  <ul>
                    {(analysis.evidence.ctas.length ? analysis.evidence.ctas : ['No CTA text extracted']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Workspace</p>
                  <h2>History, favorites, and compare</h2>
                </div>
              </div>
              <div className="workspace-summary">
                <div>
                  <strong>{history.length}</strong>
                  <span>recent analyses</span>
                </div>
                <div>
                  <strong>{favoriteAds.length}</strong>
                  <span>favorites</span>
                </div>
                <div>
                  <strong>{selectedAds.length + selectedThreads.length}</strong>
                  <span>selected for export</span>
                </div>
              </div>
              <div className="hero-actions stretch">
                <button className="secondary-button" type="button" onClick={exportSelected} disabled={!selectedAds.length && !selectedThreads.length}>
                  Export selected
                </button>
              </div>
              <div className="history-list">
                {history.map((item) => (
                  <button key={item.id} type="button" className="history-item" onClick={() => restoreHistoryItem(item)}>
                    <div>
                      <strong>{item.brief.companyName || 'Untitled workspace'}</strong>
                      <span>{item.url}</span>
                    </div>
                    <span>{formatTime(item.createdAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="right-column">
            <div className="panel preview-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Selected output preview</p>
                  <h2>X Post Preview</h2>
                </div>
                <div className="preview-hints">
                  <span className="status-badge muted">Keyboard: C copy</span>
                  <span className="status-badge muted">F favorite</span>
                  <span className="status-badge muted">S shorten</span>
                </div>
              </div>
              <div className="x-preview">
                <div className="x-header">
                  <div className="avatar">XA</div>
                  <div>
                    <strong>{brief.companyName || 'Brand name'}</strong>
                    <p>@brandhandle · now</p>
                  </div>
                </div>

                {previewAd ? <p className="x-body">{previewAd.body}</p> : null}

                {previewRewrite ? <p className="x-body">{previewRewrite.body}</p> : null}

                {previewThread ? (
                  <div className="thread-stack">
                    {previewThread.posts.map((post, index) => (
                      <div key={post} className="thread-post">
                        <span>{index + 1}</span>
                        <p>{post}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!previewAd && !previewThread && !previewRewrite ? (
                  <p className="placeholder-copy">Select a card to preview it here.</p>
                ) : null}
              </div>
            </div>

            {compareAds.length === 2 ? (
              <div className="panel compare-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">A/B compare</p>
                    <h2>Side-by-side</h2>
                  </div>
                </div>
                <div className="compare-grid">
                  {compareAds.map((ad) => (
                    <div key={ad.id} className="compare-card">
                      <div className="card-tags">
                        <span>{ad.angle}</span>
                        <span>{ad.characterCount} chars</span>
                      </div>
                      <p>{ad.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Generated outputs</p>
                  <h2>Copy workspace</h2>
                </div>
              </div>
              <div className="tab-row">
                {(Object.keys(tabLabels) as TabKey[]).map((tab) => (
                  <button key={tab} type="button" className={clsx('tab-button', activeTab === tab && 'active')} onClick={() => setActiveTab(tab)}>
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>

              {activeTab === 'single' ? <div className="card-grid">{outputs.singlePosts.map((ad, index) => renderAdCard(ad, index, 'single'))}</div> : null}

              {activeTab === 'short' ? <div className="card-grid">{outputs.shortVariants.map((ad, index) => renderAdCard(ad, index, 'short'))}</div> : null}

              {activeTab === 'thread' ? (
                <div className="thread-grid">
                  {outputs.threads.map((thread) => {
                    const selected = selectedThreadIds.includes(thread.id)
                    return (
                      <article key={thread.id} className={clsx('thread-card', selected && 'selected')} onClick={() => setPreview({ kind: 'thread', id: thread.id })}>
                        <div className="card-topline">
                          <div className="card-tags">
                            <span>{thread.title}</span>
                            <span>{thread.angle}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleThreadSelection(thread.id)
                            }}
                          >
                            {selected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                        <div className="thread-post-list">
                          {thread.posts.map((post, index) => (
                            <div key={post} className="thread-line">
                              <span>{index + 1}</span>
                              <p>{post}</p>
                            </div>
                          ))}
                        </div>
                        <p className="why-it-works">{thread.whyItWorks}</p>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {activeTab === 'rewrites' ? (
                <div className="rewrite-grid">
                  {outputs.audienceRewrites.map((rewrite) => (
                    <article key={rewrite.id} className="rewrite-card" onClick={() => setPreview({ kind: 'rewrite', id: rewrite.id })}>
                      <div className="card-tags">
                        <span>{rewrite.audience}</span>
                      </div>
                      <p className="ad-body">{rewrite.body}</p>
                      <p className="why-it-works">{rewrite.whyItWorks}</p>
                    </article>
                  ))}
                </div>
              ) : null}

              {activeTab === 'angles' ? (
                <div className="angle-grid">
                  {outputs.angleExplorer.map((item) => (
                    <article key={item.id} className="angle-card">
                      <div className="card-tags">
                        <span>{item.angle}</span>
                      </div>
                      <p className="ad-body">{item.sample}</p>
                      <p className="why-it-works">{item.rationale}</p>
                    </article>
                  ))}
                </div>
              ) : null}

              {activeTab === 'modules' ? (
                <div className="module-columns">
                  <div>
                    <h3>Hooks</h3>
                    {outputs.modularLines.filter((item) => item.category === 'Hook').map(renderModuleLine)}
                  </div>
                  <div>
                    <h3>CTAs</h3>
                    {outputs.modularLines.filter((item) => item.category === 'CTA').map(renderModuleLine)}
                  </div>
                  <div>
                    <h3>Closers</h3>
                    {outputs.modularLines.filter((item) => item.category === 'Closer').map(renderModuleLine)}
                  </div>
                </div>
              ) : null}

              {activeTab === 'creative' ? (
                <div className="creative-grid">
                  {outputs.creativeSuggestions.map((idea) => (
                    <article key={idea.id} className="creative-card">
                      <div className="card-tags">
                        <span>{idea.title}</span>
                      </div>
                      <p>{idea.description}</p>
                      <div className="prompt-block">{idea.prompt}</div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </main>
      )}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

export default App
