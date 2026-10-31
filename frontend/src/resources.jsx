import { amount, day, title, short, today } from './format'
import { Badge } from './components'

const col = (key, label, render) => ({ key, label, render })
const name = col('name', 'Name', row => <span className="cell-name">{row.name}</span>)
const active = col('is_active', 'Availability', row => <Badge value={row.is_active ? 'available' : 'archived'}/>)
const dateField = (key, label) => ({ key, label, type: 'date' })
const textField = (key, label, required = false) => ({ key, label, required })
const moneyField = (key, label, required = true) => ({ key, label, required, type: 'number', min: 0, max: 999999999999.99, step: '0.01' })
const choice = (key, label, options, required = true) => ({ key, label, type: 'select', required,
  options: options.map(value => typeof value === 'string' ? { value, label: title(value) } : value) })
const count = (key, label, value = 1) => ({ key, label, type: 'number', min: value, max: 1000000, step: 1, required: true })
const flag = (key, label) => ({ key, label, type: 'checkbox' })

export const resources = {
  subscriptions: { title: 'Subscriptions', subtitle: 'Every customer relationship, moving forward.', singular: 'subscription', employee: true,
    columns: [col('number', 'Subscription', row => <span className="mono">{short(row.number)}</span>), col('status', 'Status', row => <Badge value={row.status}/>), col('start_date', 'Started', row => day(row.start_date)), col('next_billing_date', 'Next billing', row => day(row.next_billing_date)), col('plan_fee', 'Plan fee', row => amount(row.plan_fee))] },
  invoices: { title: 'Invoices', subtitle: 'From the first bill to the final balance.', singular: 'invoice',
    columns: [col('number', 'Invoice', row => <span className="mono">{short(row.number)}</span>), col('billing_name', 'Customer'), col('status', 'Status', row => <Badge value={row.status}/>), col('due_date', 'Due date', row => day(row.due_date)), col('total', 'Total', row => amount(row.total)), col('outstanding_amount', 'Outstanding', row => amount(row.outstanding_amount))] },
  payments: { title: 'Payments', subtitle: 'A clear record of every amount received.', singular: 'payment',
    columns: [col('id', 'Payment', row => <span className="mono">{row.id.slice(0, 12)}</span>), col('payment_date', 'Received', row => day(row.payment_date)), col('method', 'Method', row => title(row.method)), col('amount', 'Amount', row => amount(row.amount)), col('reversed_at', 'Status', row => <Badge value={row.reversed_at ? 'reversed' : 'received'}/>)] },
  customers: { title: 'Customers', subtitle: 'The people and businesses behind every subscription.', singular: 'customer',
    columns: [col('business_name', 'Customer', row => <span className="cell-name">{row.business_name || 'Individual customer'}</span>), col('billing_address', 'Billing address'), col('tax_number', 'Tax number'), col('created_at', 'Joined', row => day(row.created_at))] },
  products: { title: 'Products', subtitle: 'Build the offering your customers come back for.', singular: 'product', admin: true,
    columns: [name, col('type', 'Type', row => title(row.type)), col('sales_price', 'Sales price', row => amount(row.sales_price)), col('cost_price', 'Cost price', row => amount(row.cost_price)), active],
    fields: [textField('name', 'Product name', true), choice('type', 'Product type', ['service', 'consumable', 'goods']), moneyField('sales_price', 'Sales price'), moneyField('cost_price', 'Cost price'), { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 5000 }, flag('is_active', 'Available for new subscriptions')],
    defaults: { type: 'service', sales_price: '0.00', cost_price: '0.00', notes: '', is_active: true } },
  plans: { title: 'Plans', subtitle: 'A thoughtful cadence for every kind of customer.', singular: 'plan', admin: true,
    columns: [name, col('billing_interval', 'Billing cycle', row => title(row.billing_interval)), col('price', 'Recurring fee', row => amount(row.price)), col('minimum_quantity', 'Minimum quantity'), active],
    fields: [textField('name', 'Plan name', true), moneyField('price', 'Recurring plan fee'), choice('billing_interval', 'Billing cycle', ['daily', 'weekly', 'monthly', 'yearly']), count('minimum_quantity', 'Minimum quantity'), dateField('available_from', 'Available from'), dateField('available_until', 'Available until'), flag('allow_pause', 'Allow pause'), flag('allow_early_close', 'Allow early closure'), flag('allow_renewal', 'Allow renewal'), flag('auto_close', 'Close automatically at expiry'), flag('is_active', 'Available for new subscriptions')],
    defaults: { price: '0.00', billing_interval: 'monthly', minimum_quantity: 1, allow_pause: true, allow_early_close: false, allow_renewal: true, auto_close: true, is_active: true } },
  taxes: { title: 'Taxes', subtitle: 'Consistent rules. Clear calculations.', singular: 'tax rule', admin: true,
    columns: [name, col('rate', 'Rate', row => `${row.rate}%`), col('start_date', 'Starts', row => day(row.start_date)), col('end_date', 'Ends', row => day(row.end_date)), active],
    fields: [textField('name', 'Tax name', true), { ...moneyField('rate', 'Rate (%)'), max: 100, step: '0.0001' }, dateField('start_date', 'Start date'), dateField('end_date', 'End date'), flag('is_active', 'Active')], defaults: { rate: '0', is_active: true } },
  discounts: { title: 'Discounts', subtitle: 'The right offer, with the right boundaries.', singular: 'discount', admin: true,
    columns: [name, col('type', 'Type', row => title(row.type)), col('value', 'Value', row => row.type === 'percentage' ? `${row.value}%` : amount(row.value)), col('usage_count', 'Redemptions', row => `${row.usage_count} / ${row.usage_limit ?? 'Unlimited'}`), active],
    fields: [textField('name', 'Discount name', true), choice('type', 'Discount type', ['percentage', 'fixed']), moneyField('value', 'Value'), moneyField('min_purchase', 'Minimum purchase'), count('min_quantity', 'Minimum quantity'), { ...count('usage_limit', 'Usage limit'), required: false, hint: 'Leave empty for unlimited redemptions.' }, dateField('start_date', 'Start date'), dateField('end_date', 'End date'), flag('is_active', 'Active')],
    defaults: { type: 'percentage', value: '10.00', min_purchase: '0.00', min_quantity: 1, is_active: true } },
  quotations: { title: 'Quotation templates', subtitle: 'A good first impression, ready to send.', singular: 'quotation template', employee: true,
    path: '/quotation-templates', columns: [name, col('validity_days', 'Valid for', row => `${row.validity_days} days`), col('lines', 'Product lines', row => row.lines.length), col('created_at', 'Created', row => day(row.created_at))] },
  users: { title: 'Team & access', subtitle: 'The right people, with the right permissions.', singular: 'staff account', admin: true, path: '/users', createPath: '/staff',
    columns: [col('email', 'Email', row => <span className="cell-name">{row.email}</span>), col('role', 'Role', row => <Badge value={row.role}/>), col('is_active', 'Access', row => <Badge value={row.is_active ? 'active' : 'inactive'}/>), col('created_at', 'Joined', row => day(row.created_at))],
    fields: [{ ...textField('email', 'Email', true), type: 'email' }, { ...textField('password', 'Initial password', true), type: 'password', minLength: 9, maxLength: 128, autoComplete: 'new-password', hint: '9+ characters, uppercase, lowercase and a special character.' }], defaults: {} },
}

export function canCreate(resource, user) {
  return Boolean((resource.admin && user.role === 'admin') || (resource.employee && user.role !== 'customer'))
}

export function formPayload(resource, values) {
  const result = {}
  for (const field of resource.fields) {
    let value = values[field.key]
    if (field.type === 'checkbox') value = Boolean(value)
    else if (value === '' || value === undefined || value === null) {
      if (field.type === 'date' || field.key === 'usage_limit') value = null
      else if (!field.required) value = ''
      else continue
    } else if (field.type === 'number' && field.step === 1) value = Number(value)
    result[field.key] = value
  }
  return result
}

export const selectField = choice
export const quantityField = count
export const newSubscriptionDefaults = () => ({ start_date: today(), payment_terms: 14, quantity: 1 })
