import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './icons'
import { title } from './format'

export function Badge({ value }) { return <span className={`badge badge-${value}`}>{title(value)}</span> }
export function Empty({ icon = 'subscriptions', title: heading = 'Nothing here yet', children, action }) {
  return <div className="empty"><span className="empty-icon"><Icon name={icon} size={27}/></span><h3>{heading}</h3><p>{children}</p>{action}</div>
}
export function ErrorBanner({ error, retry }) {
  return <div className="error-banner" role="alert"><span>{error.message || error}</span>{retry && <button className="text-button" onClick={retry}>Try again</button>}</div>
}
export function Modal({ title, description, close, children, wide = false }) {
  const dialog = useRef(null)
  const headingId = useId()
  useEffect(() => {
    const active = document.activeElement
    dialog.current.showModal()
    return () => { if (active instanceof HTMLElement) active.focus() }
  }, [])
  return <dialog ref={dialog} aria-labelledby={headingId} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === dialog.current) close() }}>
    <div className="modal-header"><div><h2 id={headingId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><Icon name="close"/></button></div>{children}
  </dialog>
}

export function Field({ field, value, onChange }) {
  const { key, label, type = 'text', options = [], required = false, hint, ...rest } = field
  if (type === 'checkbox') return <label className="checkbox-field"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(key, event.target.checked)}/><span>{label}</span></label>
  return <label className="field"><span>{label}{required && <span className="required"> *</span>}</span>
    {type === 'select' ? <select value={value ?? ''} onChange={event => onChange(key, event.target.value)} required={required}>
      <option value="">Select {label.toLowerCase()}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : type === 'textarea' ? <textarea value={value ?? ''} onChange={event => onChange(key, event.target.value)} required={required} {...rest}/>
      : <input type={type} value={value ?? ''} onChange={event => onChange(key, event.target.value)} required={required} {...rest}/>}
    {hint && <small>{hint}</small>}
  </label>
}

export function ResourceForm({ title: heading, description, fields, initial = {}, close, submit, children }) {
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const change = (key, value) => setValues(old => ({ ...old, [key]: value }))
  return <Modal title={heading} description={description} close={() => { if (!busy) close() }}>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(null)
      try { await submit(values); close() } catch (err) { setError(err) } finally { setBusy(false) }
    }}>
      <div className="form-body">{error && <ErrorBanner error={error}/>}{fields.map(field => <Field key={field.key} field={field} value={values[field.key]} onChange={change}/>)}{children}</div>
      <div className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}<Icon name="check" size={16}/></button></div>
    </form>
  </Modal>
}

export function DataTable({ columns, items, rowClick, empty, busy = false }) {
  if (!items.length && !busy) return empty || <Empty>No records to display.</Empty>
  return <div className="table-scroll" aria-busy={busy}><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}{rowClick && <th><span className="sr-only">Details</span></th>}</tr></thead>
    <tbody>{items.map(item => <tr key={item.id}>{columns.map((column, index) => <td key={column.key}>{rowClick && index === 0 ? <button className="row-link" onClick={() => rowClick(item)}>{column.render ? column.render(item) : item[column.key]}</button> : column.render ? column.render(item) : item[column.key] ?? '—'}</td>)}{rowClick && <td className="row-end"><button className="icon-button" aria-label={`View ${item.number || item.name || item.email || 'record'}`} onClick={() => rowClick(item)}><Icon name="arrow" size={16}/></button></td>}</tr>)}</tbody></table>{busy && <div className="loading-line"/>}</div>
}

export function Pager({ offset, limit, total, setOffset, busy }) {
  return <div className="pager"><span>{total ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total.toLocaleString()}` : '0 records'}</span><div><button className="button secondary small" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button><button className="button secondary small" disabled={offset + limit >= total || busy} onClick={() => setOffset(offset + limit)}>Next</button></div></div>
}
