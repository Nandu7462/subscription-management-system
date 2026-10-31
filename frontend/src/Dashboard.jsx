import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { Badge, DataTable, Empty, ErrorBanner } from './components'
import { resources } from './resources'
import { amount, day, title, today } from './format'

export default function Dashboard({ api, user, version, navigate, select, create }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)
  const [range, setRange] = useState({ start_date: `${today().slice(0, 7)}-01`, end_date: today() })
  const [revenue, setRevenue] = useState(null)
  const [rangeError, setRangeError] = useState(null)
  const [rangeBusy, setRangeBusy] = useState(false)
  const staff = user.role !== 'customer'
  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    const prefix = staff ? '' : '/portal'
    Promise.all([staff ? api.request('/reports/summary', { signal: controller.signal }) : null,
      staff ? api.request('/reports/subscriptions', { signal: controller.signal }) : null,
      api.request(`${prefix}/subscriptions?limit=5`, { signal: controller.signal }),
      api.request(`${prefix}/invoices?limit=5`, { signal: controller.signal })])
      .then(([summary, counts, subscriptions, invoices]) => setData({ summary, counts, subscriptions, invoices }))
      .catch(err => { if (!controller.signal.aborted) setError(err) })
    return () => controller.abort()
  }, [api, staff, version, retry])
  if (error) return <ErrorBanner error={error} retry={() => setRetry(old => old + 1)}/>
  if (!data) return <div className="dashboard-skeleton" role="status"><div/><div/><div/><span className="sr-only">Loading overview…</span></div>
  const cards = staff ? [
    ['subscriptions', 'Active subscriptions', data.summary.active_subscriptions.toLocaleString(), 'Relationships in motion', false],
    ['payments', 'Payments collected', amount(data.summary.collected_payments), 'All time · excludes reversals', true],
    ['invoices', 'Outstanding balance', amount(data.summary.outstanding_amount), `${data.summary.overdue_invoices} overdue invoice${data.summary.overdue_invoices === 1 ? '' : 's'}`, true],
  ] : [
    ['subscriptions', 'Your subscriptions', data.subscriptions.total.toLocaleString(), 'Across all subscription states', false],
    ['invoices', 'Your invoices', data.invoices.total.toLocaleString(), 'Issued invoices in your account', false],
    ['payments', 'Latest invoice balance', data.invoices.items.length ? amount(data.invoices.items[0].outstanding_amount) : '—', 'Most recent billing period', true],
  ]
  const states = ['active', 'confirmed', 'quotation', 'draft', 'paused', 'closed']
  const total = data.counts ? Object.values(data.counts).reduce((sum, value) => sum + value, 0) : 0
  return <div className="dashboard">
    <div className="welcome-strip"><div><span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span><h2>Keep the good things recurring.</h2><p>{staff ? 'Your subscriptions and billing, all in one place.' : 'Everything you need to stay on top of your account.'}</p></div><span className="welcome-symbol" aria-hidden="true"><Icon name="subscriptions" size={45}/></span></div>
    <div className="stat-grid">{cards.map(([icon, label, value, note, financial], index) => <section className={`stat-card ${index === 1 ? 'stat-featured' : ''}`} key={label}><div className="stat-top"><span>{label}</span><Icon name={icon}/></div><strong className={financial ? 'financial-value' : ''}>{value}</strong><p><span className="stat-dot"/>{note}</p></section>)}</div>
    <div className="overview-middle"><section className="panel lifecycle-panel"><div className="panel-heading"><div><h3>{staff ? 'Subscription overview' : 'Your subscriptions'}</h3><p>{staff ? 'A snapshot of where things stand.' : 'Your latest customer relationships.'}</p></div><button className="text-button" onClick={() => navigate('subscriptions')}>View all<Icon name="arrow" size={15}/></button></div>
      {staff ? total > 0 ? <><div className="status-bar" aria-label={`${total} subscriptions by status`}>{states.filter(state => data.counts[state]).map(state => <span className={`bar-${state}`} style={{ flex: data.counts[state] }} key={state} title={`${title(state)}: ${data.counts[state]}`}/>)}</div><div className="status-legend">{states.map(state => <div key={state}><span className={`legend-dot bar-${state}`}/><span>{title(state)}</span><strong>{data.counts[state] || 0}</strong></div>)}</div></> : <Empty title="A fresh start" icon="subscriptions">Create your first subscription to see the bigger picture.</Empty>
        : data.subscriptions.items.length ? <div className="compact-subscriptions">{data.subscriptions.items.map(item => <button key={item.id} onClick={() => select('subscriptions', item)}><span className="compact-icon"><Icon name="subscriptions"/></span><span><strong>{item.number.slice(0, 17)}</strong><small>Next billing {day(item.next_billing_date)}</small></span><Badge value={item.status}/></button>)}</div> : <Empty title="Your next chapter awaits">Your subscriptions will appear here once your team creates them.</Empty>}
    </section><section className="quick-card"><span className="eyebrow">A SMOOTHER WORKDAY</span><h3>{staff ? 'From an idea to a recurring relationship.' : 'Your account, at a glance.'}</h3><p>{staff ? 'Set up a plan, create a subscription, and let each billing cycle fall into place.' : 'Review your invoices, download a copy, or check your next billing date.'}</p><button className="button" onClick={() => staff ? create() : navigate('invoices')}>{staff ? 'New subscription' : 'View your invoices'}<Icon name="arrow" size={17}/></button><div className="quick-loop" aria-hidden="true"/></section></div>
    <section className="panel"><div className="panel-heading"><div><h3>Recent invoices</h3><p>The latest five bills, with their current balances.</p></div><button className="text-button" onClick={() => navigate('invoices')}>All invoices<Icon name="arrow" size={15}/></button></div><DataTable columns={resources.invoices.columns} items={data.invoices.items} rowClick={item => select('invoices', item)} empty={<Empty icon="invoices" title="No invoices just yet">Invoices will appear after a subscription is activated{staff ? '.' : ' and your team confirms them.'}</Empty>}/></section>
    {staff && <section className="panel revenue-panel"><div className="panel-heading"><div><h3>Revenue, with context</h3><p>Compare what was billed with what was received.</p></div></div><form className="range-form" onSubmit={async event => { event.preventDefault(); setRangeBusy(true); setRangeError(null); try { setRevenue(await api.request(`/reports/revenue?${new URLSearchParams(range)}`)) } catch (err) { setRangeError(err) } finally { setRangeBusy(false) } }}><label className="field"><span>From</span><input type="date" required value={range.start_date} max={range.end_date} onChange={event => setRange(old => ({ ...old, start_date: event.target.value }))}/></label><label className="field"><span>To</span><input type="date" required value={range.end_date} min={range.start_date} onChange={event => setRange(old => ({ ...old, end_date: event.target.value }))}/></label><button className="button secondary" disabled={rangeBusy}>{rangeBusy ? 'Loading…' : 'View report'}</button></form>{rangeError && <ErrorBanner error={rangeError}/>} {revenue && <div className="revenue-result"><div><span>Invoiced amount</span><strong>{amount(revenue.invoiced_amount)}</strong></div><div><span>Cash collected</span><strong>{amount(revenue.collected_payments)}</strong></div><small>{day(revenue.start_date)} – {day(revenue.end_date)}</small></div>}</section>}
  </div>
}
