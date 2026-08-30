import { Check, ChevronRight, Clipboard, Menu, Search, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { f1Catalog, f1PitScene, scifiCatalog, type CatalogModel } from './catalog.ts'

const navigation: ReadonlyArray<{
  label: string
  items: ReadonlyArray<readonly [label: string, path: string]>
}> = [
  {
    label: 'Getting Started',
    items: [
      ['Introduction', '/docs'],
      ['Installation', '/docs/installation'],
      ['Project configuration', '/docs/configuration'],
    ],
  },
  {
    label: 'Core Concepts',
    items: [
      ['Materials', '/docs/materials'],
      ['Model contract', '/docs/models'],
      ['Publishing a kit', '/docs/registries'],
    ],
  },
  {
    label: 'Authoring',
    items: [
      ['Model authoring skill', '/docs/model-authoring'],
      ['Terrain authoring skill', '/docs/terrain-authoring'],
    ],
  },
  {
    label: 'Terrain',
    items: [
      ['Runtime and caches', '/docs/terrain'],
    ],
  },
]

function libraryCategories(models: readonly CatalogModel[]): string[] {
  return [...new Set(models.map((model) => model.category))].sort()
}

function KitTree({
  title,
  overviewPath,
  allModelsPath,
  kitSlug,
  models,
  activeModel,
  open,
  extra,
}: {
  title: string
  overviewPath: string
  allModelsPath: string
  kitSlug: 'scifi' | 'f1'
  models: readonly CatalogModel[]
  activeModel: CatalogModel | undefined
  open: boolean
  extra?: ReactNode
}) {
  const categories = libraryCategories(models)
  return (
    <details open={open || undefined}>
      <summary><ChevronRight />{title}</summary>
      <div className="sidebar-submenu">
        <NavLink to={overviewPath}>Overview</NavLink>
        <NavLink end={allModelsPath === '/models'} to={allModelsPath}>All models</NavLink>
        {extra}
        {categories.map((category) => (
          <details key={category} open={activeModel?.category === category || undefined}>
            <summary><ChevronRight />{category}</summary>
            <div className="sidebar-submenu sidebar-submenu--models">
              <Link to={`/models?kit=${kitSlug}&q=${encodeURIComponent(category)}`}>
                View all {category.toLowerCase()}
              </Link>
              {models.filter((model) => model.category === category).map((model) => (
                <NavLink key={model.id} to={`/models/${model.id}`}>{model.name}</NavLink>
              ))}
            </div>
          </details>
        ))}
      </div>
    </details>
  )
}

export function Logo() {
  return <Link className="logo" to="/"><span>V</span> vibe3d</Link>
}

export function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className="top-nav" aria-label="Main navigation">
          <NavLink to="/docs">Docs</NavLink>
          <NavLink to="/models">Models</NavLink>
          <NavLink to="/docs/terrain">Terrain</NavLink>
          <NavLink to="/kits/scifi-kit">Sci-Fi Kit</NavLink>
          <NavLink to="/kits/f1-kit">F1 Kit</NavLink>
        </nav>
        <div className="header-actions">
          <Link className="search-link" to="/models"><Search size={15} /> Search models</Link>
          <span className="github-link">MIT licensed</span>
          <button className="menu-button" type="button" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && <nav className="mobile-nav">
        {navigation.flatMap((group) => group.items).map(([label, path]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
        <NavLink to="/models" onClick={() => setOpen(false)}>Model library</NavLink>
        <NavLink to="/kits/scifi-kit" onClick={() => setOpen(false)}>Sci-Fi Kit</NavLink>
        <NavLink to="/kits/f1-kit" onClick={() => setOpen(false)}>F1 Kit</NavLink>
      </nav>}
    </header>
  )
}

export function DocsLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isArticle = pathname.startsWith('/docs')
  const isModelDetail = pathname.startsWith('/models/')
  const isWide = pathname === '/models'
  const activeModel = [...scifiCatalog, ...f1Catalog].find((model) => pathname === `/models/${model.id}`)
  const f1Open = activeModel?.kind === 'f1' || pathname.startsWith('/kits/f1-kit') || pathname.startsWith('/scenes/f1-pit')
  const scifiOpen = !f1Open
  return (
    <div className={`docs-shell${isArticle || isModelDetail ? ' docs-shell--article' : ''}${isWide ? ' docs-shell--wide' : ''}`}>
      <aside className="docs-sidebar">
        <Link className="sidebar-search" to="/models"><Search /> <span>Search documentation</span><kbd>⌘ K</kbd></Link>
        {navigation.map((group) => <section className="sidebar-group" key={group.label}>
          <p>{group.label}</p>
          <nav>{group.items.map(([label, path]) => <NavLink end={path === '/docs'} key={path} to={path}>{label}</NavLink>)}</nav>
        </section>)}
        <section className="sidebar-group">
          <p>Model Libraries</p>
          <nav className="sidebar-tree">
            <KitTree
              title="Sci-Fi Kit"
              overviewPath="/kits/scifi-kit"
              allModelsPath="/models?kit=scifi"
              kitSlug="scifi"
              models={scifiCatalog}
              activeModel={activeModel?.kind !== 'f1' ? activeModel : undefined}
              open={scifiOpen}
            />
            <KitTree
              title="F1 Kit"
              overviewPath="/kits/f1-kit"
              allModelsPath="/models?kit=f1"
              kitSlug="f1"
              models={f1Catalog}
              activeModel={activeModel?.kind === 'f1' ? activeModel : undefined}
              open={f1Open}
              extra={<NavLink to={f1PitScene.href}>{f1PitScene.name}</NavLink>}
            />
          </nav>
        </section>
        <footer className="sidebar-footer"><span /> Registry connected</footer>
      </aside>
      <main className="docs-content">{children}</main>
      {isArticle && <aside className="toc"><p>On this page</p><a href="#overview">Overview</a><a href="#how-it-works">How it works</a><a href="#next">Next steps</a></aside>}
      {isModelDetail && <aside className="toc"><p>On this page</p><a href="#preview">Preview</a><a href="#installation">Installation</a><a href="#usage">Usage</a><a href="#factory">Factory</a><a href="#interface">Interface</a><a href="#manual-installation">Manual installation</a></aside>}
    </div>
  )
}

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }
  return (
    <div className="code-block">
      <pre><code>{children}</code></pre>
      <button type="button" onClick={() => void copy()} aria-label="Copy command">{copied ? <Check /> : <Clipboard />}</button>
    </div>
  )
}

export function PageIntro({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return <header className="page-intro" id="overview">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><div className="lead">{children}</div></header>
}
