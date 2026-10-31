import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { DataTable, Empty, ErrorBanner, Pager } from './components'
import { resources, canCreate } from './resources'
import { title } from './format'

export default function ResourcePage({ kind, api, user, version, select, create }) {
  const resource = resources[kind]
  const [data, setData] = useState({ items: [], total: 0 })
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)
  const limit = 25
  const states = kind === 'subscriptions' ? ['draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'] : kind === 'invoices' ? ['draft', 'confirmed', 'partially_paid', 'paid', 'cancelled'].filter(state => user.role !== 'customer' || state !== 'draft') : []
  useEffect(() => {
    const controller = new AbortController()
    const prefix = user.role === 'customer' && ['subscriptions', 'invoices'].includes(kind) ? '/portal' : ''
    const params = new URLSearchParams({ offset, limit, ...(status ? { status } : {}) })
    setBusy(true); setError(null)
    api.request(`${prefix}${resource.path || `/${kind}`}?${params}`, { signal: controller.signal }).then(result => {
      if (offset && offset >= result.total) setOffset(Math.max(0, Math.floor((result.total - 1) / limit) * limit))
      else setData(result)
    }).catch(err => { if (!controller.signal.aborted) setError(err) }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [api, kind, resource.path, user.role, version, offset, status, reload])
  const items = data.items.filter(item => Object.values(item).some(value => typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())))
  return <section className="panel resource-panel"><div className="resource-toolbar"><div className="search-box"><Icon name="search" size={18}/><input type="search" aria-label="Search this page" placeholder={`Search this page…`} value={query} onChange={event => setQuery(event.target.value)}/></div><div className="table-filters">{states.length > 0 && <select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}><option value="">All statuses</option>{states.map(value => <option key={value} value={value}>{title(value)}</option>)}</select>}<button className="icon-button" aria-label="Refresh records" disabled={busy} onClick={() => setReload(old => old + 1)}><Icon name="refresh" size={18}/></button></div></div>
    {error && <ErrorBanner error={error} retry={() => setReload(old => old + 1)}/>}
    {busy && !data.items.length ? <div className="loading-state" role="status"><span className="spinner"/>Loading {resource.title.toLowerCase()}…</div> : <DataTable columns={resource.columns} items={items} busy={busy} rowClick={record => select(kind, record)} empty={<Empty icon={kind} title={query ? 'No matches on this page' : `No ${resource.title.toLowerCase()} yet`} action={!query && canCreate(resource, user) && <button className="button" onClick={() => create(kind)}><Icon name="plus" size={16}/> New {resource.singular}</button>}>{query ? 'Try another search, or move to another page.' : kind === 'invoices' ? 'Activate a subscription to generate its first invoice.' : kind === 'payments' ? 'Open a confirmed invoice to record a payment.' : kind === 'customers' ? 'Customers appear here after creating their accounts.' : 'Your records will appear here as you get started.'}</Empty>}/>}
    <Pager offset={offset} limit={limit} total={data.total} busy={busy} setOffset={value => { setOffset(value); setQuery('') }}/>
  </section>
}
