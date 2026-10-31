import React, { useState } from 'react';
import { Button, Field } from './components.jsx';
import { TODAY, money, nextDate, addDays } from './billing.js';

const Text = ({ name, value = '', type = 'text', ...props }) => (
  <input name={name} type={type} defaultValue={value} required {...props} />
);
const NumberInput = ({ name, value = 0, min = 0, ...props }) => (
  <Text name={name} type="number" value={value} min={min} step="0.01" {...props} />
);
const Check = ({ name, label, value = true }) => (
  <label className="field checkbox">
    <input type="checkbox" name={name} defaultChecked={value} />
    {label}
  </label>
);

export default function Editor({ kind, db, item = {}, onSave, onClose, customerId }) {
  const template = kind === 'quote' ? db.templates.find((t) => t.id === item.templateId) : null;
  const [planId, setPlanId] = useState(item.planId || template?.planId || db.plans[0]?.id || '');
  const plan = db.plans.find((p) => p.id === planId);
  const product = db.products.find((p) => p.id === plan?.productId);
  const [variant, setVariant] = useState(item.variant || '');
  const [error, setError] = useState('');
  const [scope, setScope] = useState(item.scope || 'all');
  const options = (list, key = 'name') =>
    list.map((x) => (
      <option key={x.id} value={x.id}>
        {x[key]}
      </option>
    ));
  function submit(e) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const values = Object.fromEntries(fd.entries());
    try {
      onSave(values);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form id="editor" onSubmit={submit}>
      <div className="form-grid">
        {kind === 'customer' && (
          <>
            <Field label="Company name" full>
              <Text name="name" value={item.name} maxLength={80} />
            </Field>
            <Field label="Contact person">
              <Text name="contact" value={item.contact} maxLength={80} />
            </Field>
            <Field label="Email address">
              <Text name="email" type="email" value={item.email} />
            </Field>
          </>
        )}
        {kind === 'product' && (
          <>
            <Field label="Product name" full>
              <Text name="name" value={item.name} maxLength={80} />
            </Field>
            <Field label="Product type">
              <select name="type" defaultValue={item.type || 'Software'}>
                {['Software', 'Service', 'Add-on'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Sales price (₹)">
              <NumberInput name="price" value={item.price || 1499} />
            </Field>
            <Field label="Cost price (₹)">
              <NumberInput name="cost" value={item.cost || 0} />
            </Field>
            <Field label="Variant name">
              <input
                name="variant"
                defaultValue={item.variant || ''}
                placeholder="e.g. Odoo"
                maxLength={60}
              />
            </Field>
            <Field label="Variant price addition (₹)">
              <NumberInput name="variantPrice" value={item.variantPrice ?? 560} />
            </Field>
            <Field label="Product notes" full>
              <textarea name="notes" defaultValue={item.notes || ''} rows="3" maxLength={500} />
            </Field>
          </>
        )}
        {kind === 'plan' && (
          <>
            <Field label="Plan name" full>
              <Text name="name" value={item.name} maxLength={80} />
            </Field>
            <Field label="Product">
              <select name="productId" defaultValue={item.productId || db.products[0]?.id} required>
                {options(db.products)}
              </select>
            </Field>
            <Field label="Billing cycle">
              <select name="cycle" defaultValue={item.cycle || 'Monthly'}>
                {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Price per seat, per cycle (₹)">
              <NumberInput name="price" value={item.price || 1499} />
            </Field>
            <Field label="Minimum quantity">
              <NumberInput name="minQuantity" value={item.minQuantity || 1} min={1} step="1" />
            </Field>
            <Field label="Available from">
              <Text name="start" type="date" value={item.start || TODAY} />
            </Field>
            <Field label="Available until">
              <Text name="end" type="date" value={item.end || '2027-12-31'} />
            </Field>
            <Check
              name="autoClose"
              label="Automatically close expired subscriptions"
              value={item.autoClose ?? true}
            />
            <Check
              name="allowPause"
              label="Allow pause and resume"
              value={item.allowPause ?? true}
            />
            <Check name="allowClose" label="Allow early closure" value={item.allowClose ?? true} />
            <Check name="allowRenew" label="Allow renewal" value={item.allowRenew ?? true} />
          </>
        )}
        {(kind === 'subscription' || kind === 'quote') && (
          <>
            {kind === 'quote' && (
              <div className="notice" style={{ gridColumn: '1 / -1', margin: 0 }}>
                This quote uses {template?.name || 'a custom offer'}. It is valid for{' '}
                {template?.validDays || 30} days and starts in Quotation.
              </div>
            )}
            <Field label="Customer" full>
              <select
                name="customerId"
                defaultValue={item.customerId || customerId || db.customers[0]?.id}
                required
              >
                {options(
                  customerId ? db.customers.filter((c) => c.id === customerId) : db.customers,
                )}
              </select>
            </Field>
            <Field label="Recurring plan">
              <select
                name="planId"
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setVariant('');
                }}
                required
              >
                {options(db.plans)}
              </select>
            </Field>
            <Field label="Seats / quantity" hint={`Minimum ${plan?.minQuantity || 1} seat(s)`}>
              <NumberInput
                key={planId}
                name="quantity"
                value={item.quantity || template?.quantity || plan?.minQuantity || 1}
                min={plan?.minQuantity || 1}
                step="1"
              />
            </Field>
            <Field label="Product variant">
              <select name="variant" value={variant} onChange={(e) => setVariant(e.target.value)}>
                <option value="">Standard</option>
                {product?.variant && (
                  <option value={product.variant}>
                    {product.variant} (+{money(product.variantPrice)})
                  </option>
                )}
              </select>
            </Field>
            <Field label="Unit price per cycle" hint="Plan price plus the selected variant">
              <input
                readOnly
                value={money((plan?.price || 0) + (variant ? product?.variantPrice || 0 : 0))}
              />
            </Field>
            <Field label="Start date">
              <Text name="start" type="date" value={item.start || TODAY} />
            </Field>
            <Field label="Expiry date">
              <Text name="expiry" type="date" value={item.expiry || nextDate(TODAY, 'Yearly')} />
            </Field>
            <Field label="Payment terms">
              <select name="terms" defaultValue={item.terms ?? 14}>
                <option value="0">Due on receipt</option>
                <option value="7">Net 7 days</option>
                <option value="14">Net 14 days</option>
                <option value="30">Net 30 days</option>
              </select>
            </Field>
            <Field label="Initial stage">
              <input readOnly value={kind === 'quote' ? 'Quotation' : 'Draft'} />
            </Field>
          </>
        )}
        {kind === 'payment' && (
          <>
            <Field label="Invoice" full>
              <input
                readOnly
                value={`${item.id} · ${db.customers.find((c) => c.id === item.customerId)?.name}`}
              />
              <input type="hidden" name="invoiceId" value={item.id} />
            </Field>
            <Field label="Amount received (₹)" hint={`Outstanding: ${money(item.balance)}`}>
              <NumberInput name="amount" value={item.balance} min={0.01} max={item.balance} />
            </Field>
            <Field label="Payment method">
              <select name="method">
                {['Bank transfer', 'UPI', 'Card', 'Cash', 'Other'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment date">
              <Text name="date" type="date" value={TODAY} max={TODAY} />
            </Field>
            <Field label="Reference / note">
              <input name="note" placeholder="Transaction reference" maxLength={200} />
            </Field>
          </>
        )}
        {kind === 'discount' && (
          <>
            <Field label="Discount name / code" full>
              <Text name="name" value={item.name} maxLength={60} />
            </Field>
            <Field label="Discount type">
              <select name="type" defaultValue={item.type || 'Percentage'}>
                <option>Percentage</option>
                <option>Fixed amount</option>
              </select>
            </Field>
            <Field label="Discount value">
              <NumberInput name="value" value={item.value || 10} min={0.01} />
            </Field>
            <Field label="Minimum purchase (₹)">
              <NumberInput name="minPurchase" value={item.minPurchase || 0} />
            </Field>
            <Field label="Minimum quantity">
              <NumberInput name="minQuantity" value={item.minQuantity || 1} min={1} step="1" />
            </Field>
            <Field label="Valid from">
              <Text name="start" type="date" value={item.start || TODAY} />
            </Field>
            <Field label="Valid until">
              <Text name="end" type="date" value={item.end || addDays(TODAY, 60)} />
            </Field>
            <Field label="Maximum uses">
              <NumberInput
                name="limit"
                value={item.limit || 100}
                min={Math.max(1, item.used || 0)}
                step="1"
              />
            </Field>
            <Field label="Applies to">
              <select name="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">All subscriptions</option>
                <optgroup label="Products">{options(db.products)}</optgroup>
                <optgroup label="Specific subscriptions">
                  {db.subscriptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
            <Check name="enabled" label="Enable discount rule" value={item.enabled ?? true} />
          </>
        )}
        {kind === 'template' && (
          <>
            <Field label="Template name" full>
              <Text name="name" value={item.name} maxLength={80} />
            </Field>
            <Field label="Recurring plan">
              <select name="planId" defaultValue={item.planId || db.plans[0]?.id}>
                {options(db.plans)}
              </select>
            </Field>
            <Field label="Quantity">
              <NumberInput name="quantity" value={item.quantity || 5} min={1} step="1" />
            </Field>
            <Field label="Quotation validity (days)">
              <NumberInput name="validDays" value={item.validDays || 30} min={1} step="1" />
            </Field>
          </>
        )}
        {kind === 'staff' && (
          <>
            <Field label="Full name" full>
              <Text name="name" maxLength={80} />
            </Field>
            <Field label="Email address" full>
              <Text name="email" type="email" />
            </Field>
            <Field label="Role">
              <input readOnly value="Staff" />
            </Field>
            <p style={{ gridColumn: '1 / -1' }}>
              This creates a demo staff record. Provisioning a secure login requires your
              authentication backend.
            </p>
          </>
        )}
        {kind === 'signup' && (
          <>
            <div className="notice" style={{ gridColumn: '1 / -1', margin: 0 }}>
              Demo account creation. Password rules are validated locally; passwords are never
              saved. Connect your backend for secure signup.
            </div>
            <Field label="Company name" full>
              <Text name="name" maxLength={80} />
            </Field>
            <Field label="Email address" full>
              <Text name="email" type="email" />
            </Field>
            <Field
              label="Password"
              full
              hint="More than 8 characters, with uppercase, lowercase, and a special character."
            >
              <Text name="password" type="password" minLength={9} autoComplete="new-password" />
            </Field>
          </>
        )}
        {kind === 'reset' && (
          <>
            <div className="notice" style={{ gridColumn: '1 / -1', margin: 0 }}>
              Password reset is a preview. A backend must generate a single-use token and deliver
              the email.
            </div>
            <Field label="Registered email" full>
              <Text name="email" type="email" autoComplete="email" />
            </Field>
          </>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-footer" style={{ margin: '24px -27px -24px' }}>
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button primary type="submit" icon="check">
          {kind === 'payment'
            ? 'Record payment'
            : kind === 'reset'
              ? 'Preview reset request'
              : kind === 'signup'
                ? 'Create demo account'
                : item.id
                  ? 'Save changes'
                  : 'Create ' + (kind === 'quote' ? 'quotation' : kind)}
        </Button>
      </div>
    </form>
  );
}
