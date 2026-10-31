import { useCallback, useEffect, useState } from 'react'
import { createClient } from './api'
import Auth from './Auth'
import Dashboard from './Dashboard'
import ResourcePage from './ResourcePage'
import SubscriptionForm from './SubscriptionForm'
import Detail from './Detail'
import { Brand, Icon } from './icons'
import { ResourceForm } from './components'
import { resources, canCreate, formPayload } from './resources'

const groups = [
  { name: 'WORKSPACE', pages: ['overview', 'subscriptions', 'invoices', 'payments', 'customers'] },
  { name: 'YOUR OFFERING', pages: ['products', 'plans', 'quotations', 'taxes', 'discounts'] },
  { name: 'ADMINISTRATION', pages: ['users'] },
]
function allowed(page, user) {
  if (user.role === 'customer') return ['overview', 'subscriptions', 'invoices'].includes(page)
  if (page === 'users') return user.role === 'admin'
  return page === 'overview' || Boolean(resources[page])
}

export default function App() {
  const [user, setUser] = useState(null)
  const [api] = useState(() => createClient({ onUnauthorized: () => { setUser(null); setChecking(false) } }))
  const [checking, setChecking] = useState(api.hasToken())
  const [sessionError, setSessionError] = useState(null)
  const [sessionRetry, setSessionRetry] = useState(0)
  const [page, setPage] = useState(window.location.hash.slice(2) || 'overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(null)
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState('')
  const [health, setHealth] = useState('checking')
  useEffect(() => {
    const controller = new AbortController()
    if (api.hasToken()) {
      setChecking(true); setSessionError(null)
      api.request('/auth/me', { signal: controller.signal }).then(setUser).catch(err => {
        if (!controller.signal.aborted && err.status !== 401) setSessionError(err)
      }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    }
    return () => controller.abort()
  }, [api, sessionRetry])
  useEffect(() => {
    const handler = () => { setPage(window.location.hash.slice(2) || 'overview'); setSelected(null); setCreating(null) }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  useEffect(() => {
    let disposed = false
    const controller = new AbortController()
    const check = () => api.request('/health/ready', { authenticated: false, signal: controller.signal }).then(() => { if (!disposed) setHealth('ready') }).catch(() => { if (!disposed) setHealth('offline') })
    check(); const interval = setInterval(check, 60000)
    return () => { disposed = true; controller.abort(); clearInterval(interval) }
  }, [api])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer) } }, [toast])
  const saved = useCallback(message => { setVersion(old => old + 1); setToast(message) }, [])
  const navigate = next => { window.location.hash = `/${next}`; setMobileNav(false); setSelected(null) }
  const signedIn = account => { setUser(account); setSessionError(null); window.history.replaceState({}, '', '/#/overview'); setPage('overview') }
  if (checking) return <div className="startup"><Brand/><span className="spinner"/><p>Opening your workspace…</p></div>
  if (!user) return <Auth api={api} signedIn={signedIn} connectionError={sessionError} retrySession={() => setSessionRetry(old => old + 1)}/>
  const current = allowed(page, user) ? page : 'overview'
  const resource = resources[current]
  const staff = user.role !== 'customer'
  const heading = current === 'overview' ? 'Overview' : resource.title
  const create = (kind = 'subscriptions') => setCreating(kind)
  const selectedKind = creating && resources[creating]
  return <div className="app-layout">
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><Brand/><div className="workspace-selector"><span className="workspace-avatar">B</span><span><strong>{user.role === 'customer' ? 'Customer portal' : 'Billing workspace'}</strong><small>Brightloop Software</small></span><span className="workspace-chevron">⌄</span></div>
      <nav aria-label="Main navigation">{groups.map(group => { const pages = group.pages.filter(key => allowed(key, user)); return pages.length ? <div className="nav-group" key={group.name}><span className="nav-label">{group.name}</span>{pages.map(key => <a key={key} href={`#/${key}`} className={`nav-item ${current === key ? 'selected' : ''}`} aria-current={current === key ? 'page' : undefined} onClick={() => setMobileNav(false)}><Icon name={key}/><span>{key === 'overview' ? 'Overview' : key === 'quotations' ? 'Quotations' : key === 'users' ? 'Team & access' : resources[key].title}</span>{current === key && <span className="nav-active-dot"/>}</a>)}</div> : null })}</nav>
      <div className="sidebar-footer"><div className="sidebar-note"><Icon name="subscriptions" size={25}/><strong>Built for the long run.</strong><p>A little less busywork.<br/>A little more possibility.</p></div><div className="account-row"><span className="account-avatar">{user.email.charAt(0).toUpperCase()}</span><div><strong title={user.email}>{user.email.split('@')[0]}</strong><small>{user.role === 'customer' ? 'Customer' : user.role === 'admin' ? 'Administrator' : 'Staff member'}</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => { api.logout(); setUser(null); setSelected(null); setCreating(null); navigate('overview') }}><Icon name="logout" size={18}/></button></div></div>
    </aside>
    <div className="main-area"><header className="topbar"><div><button className="icon-button menu-toggle" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Icon name="menu"/></button><span className="breadcrumb">Workspace <span>/</span><strong>{heading}</strong></span></div><div className="topbar-right"><span className={`connection connection-${health}`} title={health === 'ready' ? 'Your workspace is connected' : 'Checking the server connection'}><i/>{health === 'ready' ? 'Connected' : health === 'offline' ? 'Connection issue' : 'Connecting'}</span><span className="topbar-date"><Icon name="calendar" size={15}/>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></header>
      <main className="page-content" id="main-content"><div className="page-heading"><div><div className="page-eyebrow">{current === 'overview' ? 'THE BIG PICTURE' : 'ALL THE DETAILS, IN ONE PLACE'}</div><h1>{heading}<span className="heading-dot">.</span></h1><p>{current === 'overview' ? `Welcome back. Here’s what’s happening with ${staff ? 'your business' : 'your account'}.` : resource.subtitle}</p></div>{(current === 'overview' && staff) || (resource && canCreate(resource, user)) ? <button className="button" onClick={() => create(current === 'overview' ? 'subscriptions' : current)}><Icon name="plus" size={17}/> New {current === 'overview' ? 'subscription' : resource.singular}</button> : null}</div>
        {current === 'overview' ? <Dashboard api={api} user={user} version={version} navigate={navigate} select={(kind, record) => setSelected({ kind, record })} create={() => create()}/> : <ResourcePage key={current} kind={current} api={api} user={user} version={version} select={(kind, record) => setSelected({ kind, record })} create={create}/>}
        <footer className="page-footer"><span>Brightloop Software</span><span>Made for a little more peace of mind.</span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><span><Icon name="check" size={18}/></span>{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={16}/></button></div>}
    {selected && <Detail key={`${selected.kind}-${selected.record.id}`} {...selected} api={api} user={user} close={() => setSelected(null)} saved={saved}/>}
    {creating && ['subscriptions', 'quotations'].includes(creating) ? <SubscriptionForm api={api} template={creating === 'quotations'} close={() => setCreating(null)} saved={saved}/>
      : creating && selectedKind?.fields && <ResourceForm title={`New ${selectedKind.singular}`} fields={selectedKind.fields} initial={selectedKind.defaults} close={() => setCreating(null)} submit={async values => { await api.request(selectedKind.createPath || `/${creating}`, { method: 'POST', body: formPayload(selectedKind, values) }); saved(`${selectedKind.singular.charAt(0).toUpperCase() + selectedKind.singular.slice(1)} created`) }}/>}</div>
}
