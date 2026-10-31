import { useEffect, useState } from 'react'
import { Field, Modal, ErrorBanner } from './components'
import { Icon } from './icons'
import { newSubscriptionDefaults, selectField, quantityField } from './resources'

export default function SubscriptionForm({ api, close, saved, template = false }) {
  const [lookups, setLookups] = useState(null)
  const [values, setValues] = useState({ ...newSubscriptionDefaults(), validity_days: 30 })
  const [lines, setLines] = useState([])
  const [variants, setVariants] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [useTemplate, setUseTemplate] = useState(false)
  const change = (key, value) => setValues(old => ({ ...old, [key]: value }))
  const options = (items, label = 'name') => items.map(row => ({ value: row.id, label: row[label] || row.id }))
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([api.all('/plans', controller.signal), api.all('/products', controller.signal),
      api.all('/taxes', controller.signal), template ? [] : api.all('/customers', controller.signal),
      template ? [] : api.all('/quotation-templates', controller.signal)])
      .then(([plans, products, taxes, customers, templates]) => setLookups({ plans: plans.filter(row => row.is_active), products: products.filter(row => row.is_active), taxes: taxes.filter(row => row.is_active), customers, templates }))
      .catch(err => { if (!controller.signal.aborted) setError(err) })
    return () => controller.abort()
  }, [api, template])
  const updateLine = async (index, key, value) => {
    setLines(old => old.map((line, i) => i !== index ? line : { ...line, [key]: value, ...(key === 'product_id' ? { variant_id: '' } : {}) }))
    if (key === 'product_id' && value && !variants[value]) {
      try { const items = await api.all(`/products/${value}/variants`); setVariants(old => ({ ...old, [value]: items })) }
      catch (err) { setError(err) }
    }
  }
  return <Modal title={template ? 'New quotation template' : 'New subscription'} description={template ? 'A reusable starting point for your customer offers.' : 'Start with a draft. Confirm and activate when you’re ready.'} close={() => { if (!busy) close() }} wide>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(null)
      try {
        const body = template ? { name: values.name, plan_id: values.plan_id, validity_days: Number(values.validity_days) }
          : { customer_id: values.customer_id, start_date: values.start_date, expiry_date: values.expiry_date || null, payment_terms: Number(values.payment_terms) }
        if (!template && useTemplate) body.template_id = values.template_id
        else {
          body.plan_id = values.plan_id
          body.lines = lines.map(line => ({ product_id: line.product_id, quantity: Number(line.quantity), variant_id: line.variant_id || null, tax_rule_id: line.tax_rule_id || null, ...(line.unit_price !== '' ? { unit_price: line.unit_price } : {}) }))
        }
        await api.request(template ? '/quotation-templates' : useTemplate ? '/subscriptions/from-template' : '/subscriptions', { method: 'POST', body })
        saved(template ? 'Quotation template created' : 'Draft subscription created'); close()
      } catch (err) { setError(err) } finally { setBusy(false) }
    }}>
      <div className="form-body">{error && <ErrorBanner error={error}/>}{!lookups ? <p className="muted">{error ? 'Close and reopen this form to retry.' : 'Loading plans and customers…'}</p> : <>
        {!template && <Field field={{ key: 'use_template', label: 'Create from a quotation template', type: 'checkbox' }} value={useTemplate} onChange={(_, value) => setUseTemplate(value)}/>}
        <div className="form-grid">
          {template ? <Field field={{ key: 'name', label: 'Template name', required: true, maxLength: 200 }} value={values.name} onChange={change}/>
            : <Field field={selectField('customer_id', 'Customer', options(lookups.customers, 'business_name'))} value={values.customer_id} onChange={change}/>}
          <Field field={useTemplate ? selectField('template_id', 'Quotation template', options(lookups.templates)) : selectField('plan_id', 'Plan', options(lookups.plans))} value={useTemplate ? values.template_id : values.plan_id} onChange={change}/>
          {template ? <Field field={{ ...quantityField('validity_days', 'Valid for (days)'), max: 365 }} value={values.validity_days} onChange={change}/>
            : <><Field field={{ key: 'start_date', label: 'Start date', type: 'date', required: true }} value={values.start_date} onChange={change}/><Field field={{ key: 'expiry_date', label: 'Expiry date', type: 'date', min: values.start_date }} value={values.expiry_date} onChange={change}/><Field field={{ ...quantityField('payment_terms', 'Payment due within (days)', 0), max: 365 }} value={values.payment_terms} onChange={change}/></>}
        </div>
        {!useTemplate && <><div className="section-heading"><h3>Product lines</h3><button type="button" className="text-button" onClick={() => setLines(old => [...old, { key: crypto.randomUUID(), product_id: '', quantity: 1, unit_price: '', variant_id: '', tax_rule_id: '' }])} disabled={lines.length >= 100}><Icon name="plus" size={16}/> Add product</button></div>
          <p className="field-hint">Product prices are added to the plan fee. Leave lines empty to use the plan’s default products.</p>
          {lines.map((line, index) => <div className="line-editor" key={line.key}>
            <div className="line-heading"><strong>Product {index + 1}</strong><button type="button" className="icon-button" aria-label={`Remove product ${index + 1}`} onClick={() => setLines(old => old.filter((_, i) => i !== index))}><Icon name="close" size={16}/></button></div>
            <div className="form-grid"><Field field={selectField('product_id', 'Product', options(lookups.products))} value={line.product_id} onChange={(key, value) => updateLine(index, key, value)}/>
              <Field field={quantityField('quantity', 'Quantity')} value={line.quantity} onChange={(key, value) => updateLine(index, key, value)}/>
              <Field field={selectField('variant_id', 'Variant', (variants[line.product_id] || []).map(row => ({ value: row.id, label: `${row.attribute_name}: ${row.attribute_value} (+${row.price_extra})` })), false)} value={line.variant_id} onChange={(key, value) => updateLine(index, key, value)}/>
              <Field field={selectField('tax_rule_id', 'Tax', options(lookups.taxes), false)} value={line.tax_rule_id} onChange={(key, value) => updateLine(index, key, value)}/>
              <Field field={{ key: 'unit_price', label: 'Override unit price', type: 'number', min: 0, step: '0.01', hint: 'Leave empty to use the product + variant price.' }} value={line.unit_price} onChange={(key, value) => updateLine(index, key, value)}/></div>
          </div>)}</>}
      </>}</div><div className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancel</button><button className="button" disabled={busy || !lookups}>{busy ? 'Creating…' : template ? 'Create template' : 'Create draft'}<Icon name="arrow" size={16}/></button></div>
    </form>
  </Modal>
}
