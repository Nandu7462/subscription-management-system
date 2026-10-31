import { useEffect, useState } from 'react'
import { Badge, Modal, ResourceForm, ErrorBanner, DataTable, Empty } from './components'
import { resources, formPayload, selectField } from './resources'
import { amount, day, title, short, today } from './format'
import { Icon } from './icons'

const visible = ['name', 'number', 'email', 'business_name', 'status', 'role', 'billing_interval', 'plan_fee', 'price', 'sales_price', 'cost_price', 'minimum_quantity', 'rate', 'type', 'value', 'min_purchase', 'min_quantity', 'usage_count', 'usage_limit', 'billing_name', 'billing_address', 'tax_number', 'start_date', 'expiry_date', 'next_billing_date', 'quotation_valid_until', 'available_from', 'available_until', 'billing_period', 'period_end', 'due_date', 'payment_date', 'method', 'amount', 'validity_days', 'notes', 'reversal_reason']
const moneyKeys = new Set(['plan_fee', 'price', 'sales_price', 'cost_price', 'value', 'min_purchase', 'amount'])
const lineColumns = [
  { key: 'description', label: 'Product', render: row => row.description || row.product_id.slice(0, 12) },
  { key: 'quantity', label: 'Qty' }, { key: 'unit_price', label: 'Unit price', render: row => amount(row.unit_price) },
  { key: 'tax_amount', label: 'Tax', render: row => row.tax_amount !== undefined ? amount(row.tax_amount) : '—' },
  { key: 'line_total', label: 'Total', render: row => row.line_total !== undefined ? amount(row.line_total) : '—' },
]

export default function Detail({ api, kind, record, user, close, saved }) {
  const resource = resources[kind]
  const path = resource.path || `/${kind}`
  const [item, setItem] = useState(record)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [related, setRelated] = useState(null)
  const [extra, setExtra] = useState(null)
  const staff = user.role !== 'customer'
  const admin = user.role === 'admin'
  useEffect(() => {
    const controller = new AbortController()
    if (kind !== 'customers' && kind !== 'users') api.request(`${path}/${record.id}`, { signal: controller.signal }).then(setItem).catch(err => { if (!controller.signal.aborted) setError(err) })
    if (kind === 'products' || (kind === 'invoices' && staff)) api.all(kind === 'products' ? `/products/${record.id}/variants` : `/invoices/${record.id}/payments`, controller.signal).then(setRelated).catch(err => { if (!controller.signal.aborted) setError(err) })
    return () => controller.abort()
  }, [api, kind, path, record.id, staff])
  async function action(actionPath, body, method = 'POST', message = 'Changes saved') {
    setBusy(true); setError(null)
    try {
      const result = await api.request(actionPath, { method, body })
      if (result?.id === item.id) setItem(result)
      saved(message)
      return result
    } catch (err) { setError(err); throw err } finally { setBusy(false) }
  }
  const run = (...args) => { action(...args).catch(() => {}) }
  const basicAction = (label, endpoint, description) => setForm({ title: label, description, fields: [], initial: {}, submit: () => action(endpoint, undefined, 'POST', `${label} completed`) })
  const edit = () => setForm({ title: `Edit ${resource.singular}`, fields: resource.fields, initial: item,
    submit: values => action(`${path}/${item.id}`, formPayload(resource, values), 'PATCH') })
  const payment = () => setForm({ title: 'Record payment', description: `Outstanding balance: ${amount(item.outstanding_amount)}. This records a payment already received.`,
    initial: { amount: item.outstanding_amount, method: 'bank_transfer', payment_date: today(), notes: '', idempotency_key: crypto.randomUUID() },
    fields: [{ key: 'amount', label: 'Amount received', type: 'number', min: '0.01', max: item.outstanding_amount, step: '0.01', required: true }, selectField('method', 'Payment method', ['bank_transfer', 'upi', 'cash', 'card', 'cheque', 'other']), { key: 'payment_date', label: 'Payment date', type: 'date', required: true, max: today() }, { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 3000 }],
    submit: async values => {
      await action(`/invoices/${item.id}/payments`, values, 'POST', 'Payment recorded')
      const [invoice, payments] = await Promise.all([api.request(`/invoices/${item.id}`), api.all(`/invoices/${item.id}/payments`)])
      setItem(invoice); setRelated(payments)
    } })
  const assign = async () => {
    setBusy(true); setError(null)
    try {
      const rules = await api.all('/discounts')
      setForm({ title: 'Assign a discount', description: 'Applies to future billing cycles. Existing invoices stay unchanged.', initial: {}, fields: [selectField('discount_id', 'Discount', rules.filter(row => row.is_active).map(row => ({ value: row.id, label: `${row.name} · ${row.type === 'percentage' ? row.value + '%' : amount(row.value)}` })))], submit: values => action(`/subscriptions/${item.id}/discounts`, values, 'POST', 'Discount assigned') })
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function download() {
    setBusy(true); setError(null)
    try {
      const blob = await api.request(`/invoices/${item.id}/pdf`, { blob: true })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `${item.number}.pdf`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <><Modal title={item.name || (item.number ? short(item.number) : title(resource.singular))} description={kind === 'users' ? item.email : `Created ${day(item.created_at)}`} close={() => { if (!busy) close() }} wide>
    <div className="detail-body">{error && <ErrorBanner error={error}/>}
      <div className="detail-top"><Badge value={item.status || (item.is_active === undefined ? kind : item.is_active ? 'active' : 'archived')}/><span className="record-id" title={item.id}>{item.id}</span></div>
      <dl className="detail-grid">{visible.filter(key => item[key] !== undefined && item[key] !== null && item[key] !== '').map(key => <div key={key}><dt>{title(key)}</dt><dd>{key.endsWith('_date') || key.endsWith('_until') || key === 'billing_period' || key === 'period_end' ? day(item[key]) : moneyKeys.has(key) ? amount(item[key]) : title(['status', 'role', 'billing_interval', 'method', 'type'].includes(key) ? item[key] : '') || String(item[key])}</dd></div>)}</dl>
      {item.lines?.length > 0 && <section className="detail-section"><h3>Line items</h3><DataTable columns={lineColumns} items={item.lines}/></section>}
      {kind === 'invoices' && <div className="invoice-totals">{[['Subtotal', item.subtotal], ['Discount', item.discount], ['Tax', item.tax], ['Total', item.total], ['Amount paid', item.amount_paid], ['Outstanding', item.outstanding_amount]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{amount(value)}</strong></div>)}</div>}
      {kind === 'products' && <section className="detail-section"><div className="section-heading"><h3>Product variants</h3>{admin && <button className="text-button" disabled={busy} onClick={() => setForm({ title: 'Add variant', initial: { price_extra: '0.00' }, fields: [{ key: 'attribute_name', label: 'Attribute name', required: true, maxLength: 100 }, { key: 'attribute_value', label: 'Attribute value', required: true, maxLength: 100 }, { key: 'price_extra', label: 'Additional price', type: 'number', min: 0, step: '0.01', required: true }], submit: async values => { await action(`/products/${item.id}/variants`, values, 'POST', 'Variant created'); setRelated(await api.all(`/products/${item.id}/variants`)) } })}><Icon name="plus" size={16}/> Add variant</button>}</div>
        {related?.map(variant => <div className="related-row" key={variant.id}><span>{variant.attribute_name}: <strong>{variant.attribute_value}</strong></span><span>+{amount(variant.price_extra)}</span></div>)}{related?.length === 0 && <p className="muted">No variants yet.</p>}</section>}
      {kind === 'invoices' && staff && <section className="detail-section"><h3>Payment history</h3>{related?.map(row => <div className="related-row" key={row.id}><span>{day(row.payment_date)} · {title(row.method)} {row.reversed_at && <Badge value="reversed"/>}</span><strong>{amount(row.amount)}</strong></div>)}{related?.length === 0 && <p className="muted">No payments recorded yet.</p>}</section>}
      {kind === 'subscriptions' && extra && <div className="success-banner" role="status">{extra}</div>}
    </div>
    <div className="detail-actions" aria-label="Record actions">
      {resource.fields && admin && kind !== 'users' && <button className="button secondary" disabled={busy} onClick={edit}>Edit {resource.singular}</button>}
      {kind === 'users' && admin && <button className="button secondary" disabled={busy} onClick={() => setForm({ title: 'Update access', fields: [selectField('role', 'Role', ['admin', 'staff', 'customer']), { key: 'is_active', label: 'Account active', type: 'checkbox' }], initial: { role: item.role, is_active: item.is_active }, submit: values => action(`/users/${item.id}`, values, 'PATCH') })}>Manage access</button>}
      {admin && ['products', 'plans'].includes(kind) && item.is_active && <button className="button secondary danger" disabled={busy} onClick={() => setForm({ title: `Archive ${resource.singular}?`, description: 'Existing subscriptions and invoice history will be preserved.', fields: [], submit: () => action(kind === 'products' ? `/products/${item.id}` : `/plans/${item.id}/archive`, undefined, kind === 'products' ? 'DELETE' : 'POST', 'Archived') })}>Archive</button>}
      {kind === 'subscriptions' && <>
        {staff && ['draft', 'quotation'].includes(item.status) && <button className="button" disabled={busy} onClick={() => run(`/subscriptions/${item.id}/quote`, undefined, 'POST', 'Quotation issued')}>{item.status === 'draft' ? 'Issue quotation' : 'Reissue quotation'}</button>}
        {staff && item.status === 'quotation' && <button className="button" disabled={busy} onClick={() => run(`/subscriptions/${item.id}/confirm`, undefined, 'POST', 'Subscription confirmed')}>Confirm quotation</button>}
        {staff && item.status === 'confirmed' && <button className="button" disabled={busy} onClick={() => basicAction('Activate subscription', `/subscriptions/${item.id}/activate`, 'Activation generates invoices for any due billing cycles.')}>Activate</button>}
        {item.status === 'active' && <button className="button secondary" disabled={busy} onClick={() => basicAction('Pause subscription', `/subscriptions/${item.id}/pause`, 'Pausing freezes future billing dates, subject to the plan policy.')}>Pause</button>}
        {item.status === 'paused' && <button className="button" disabled={busy} onClick={() => run(`/subscriptions/${item.id}/resume`, undefined, 'POST', 'Subscription resumed')}>Resume</button>}
        {['active', 'closed'].includes(item.status) && <button className="button secondary" disabled={busy} onClick={() => setForm({ title: 'Renew subscription', initial: {}, fields: [{ key: 'expiry_date', label: 'New expiry date', type: 'date', required: true, min: item.expiry_date && item.expiry_date > today() ? item.expiry_date : today() }], submit: values => action(`/subscriptions/${item.id}/renew`, values, 'POST', 'Subscription renewed') })}>Renew</button>}
        {['active', 'paused', 'confirmed'].includes(item.status) && <button className="button secondary danger" disabled={busy} onClick={() => basicAction('Close subscription', `/subscriptions/${item.id}/close`, 'This stops future billing. The plan’s closure policy will be checked.')}>Close subscription</button>}
        {staff && item.status !== 'closed' && <button className="button secondary" disabled={busy} onClick={assign}>Assign discount</button>}
        {staff && item.status === 'active' && <button className="button secondary" disabled={busy} onClick={async () => { try { const result = await action(`/subscriptions/${item.id}/invoices/generate`, undefined, 'POST', 'Billing checked'); setExtra(`${result.count} due invoice(s) generated. Next billing: ${day(result.next_billing_date)}.`); setItem(await api.request(`/subscriptions/${item.id}`)) } catch { /* visible error */ } }}>Generate due invoices</button>}
      </>}
      {kind === 'invoices' && <>
        <button className="button secondary" disabled={busy} onClick={download}><Icon name="download" size={16}/> Download PDF</button>
        {staff && item.status === 'draft' && <button className="button" disabled={busy} onClick={() => run(`/invoices/${item.id}/confirm`, undefined, 'POST', 'Invoice confirmed')}>Confirm invoice</button>}
        {staff && ['confirmed', 'partially_paid'].includes(item.status) && <button className="button" disabled={busy} onClick={payment}>Record payment</button>}
        {staff && !['draft', 'cancelled'].includes(item.status) && <button className="button secondary" disabled={busy} onClick={() => run(`/invoices/${item.id}/send`, undefined, 'POST', 'Invoice email sent')}>Send email</button>}
        {staff && ['draft', 'confirmed'].includes(item.status) && Number(item.amount_paid) === 0 && <button className="button secondary danger" disabled={busy} onClick={() => basicAction('Cancel invoice', `/invoices/${item.id}/cancel`, 'This cycle is retained and will not be billed again automatically.')}>Cancel invoice</button>}
      </>}
      {kind === 'payments' && admin && !item.reversed_at && <button className="button secondary danger" disabled={busy} onClick={() => setForm({ title: 'Reverse payment', description: 'The payment stays in the audit history and its amount returns to the invoice balance.', fields: [{ key: 'reason', label: 'Reason', required: true, minLength: 3, maxLength: 3000, type: 'textarea' }], initial: {}, submit: values => action(`/payments/${item.id}/reverse`, values, 'POST', 'Payment reversed') })}>Reverse payment</button>}
      {busy && <span className="muted" role="status">Working…</span>}
    </div>
  </Modal>{form && <ResourceForm {...form} close={() => setForm(null)}/>}</>
}
