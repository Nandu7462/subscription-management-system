// Pure billing helpers shared by the UI and tests. All money is rounded to cents.
export const TODAY = '2026-10-31';
export const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value || 0);
export const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value + 'T00:00:00Z'))
    : '—';
export function addDays(value, days) {
  const d = new Date(value + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function nextDate(value, cycle) {
  if (cycle === 'Daily') return addDays(value, 1);
  if (cycle === 'Weekly') return addDays(value, 7);
  const d = new Date(value + 'T00:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (cycle === 'Yearly' ? 12 : 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export const nextId = (items, prefix) =>
  `${prefix}-${String(Math.max(1000, ...items.map((x) => Number(x.id.split('-').at(-1)) || 0)) + 1)}`;
export function eligibleDiscount(db, sub, date) {
  const subtotal = round(sub.quantity * sub.unitPrice);
  return db.discounts.find(
    (d) =>
      d.enabled &&
      d.start <= date &&
      d.end >= date &&
      d.used < d.limit &&
      sub.quantity >= d.minQuantity &&
      subtotal >= d.minPurchase &&
      (d.scope === 'all' || d.scope === sub.productId || d.scope === sub.id),
  );
}
export function invoiceAmounts(sub, discount, taxRate) {
  const subtotal = round(sub.quantity * sub.unitPrice);
  const reduction = discount
    ? Math.min(
        subtotal,
        round(discount.type === 'Percentage' ? (subtotal * discount.value) / 100 : discount.value),
      )
    : 0;
  const tax = round(((subtotal - reduction) * taxRate) / 100);
  return { subtotal, discount: reduction, tax, total: round(subtotal - reduction + tax) };
}
export const paidAmount = (db, invoiceId) =>
  round(db.payments.filter((p) => p.invoiceId === invoiceId).reduce((n, p) => n + p.amount, 0));
export const balance = (db, invoice) =>
  round(Math.max(0, invoice.total - paidAmount(db, invoice.id)));
export function invoiceStatus(db, invoice) {
  if (['Draft', 'Cancelled'].includes(invoice.status)) return invoice.status;
  if (balance(db, invoice) <= 0) return 'Paid';
  return invoice.due < TODAY ? 'Overdue' : 'Confirmed';
}
export function buildInvoice(db, sub, period) {
  const discount = eligibleDiscount(db, sub, period);
  const amounts = invoiceAmounts(sub, discount, db.taxRate);
  const product = db.products.find((p) => p.id === sub.productId);
  const invoice = {
    id: nextId(db.invoices, 'INV'),
    subscriptionId: sub.id,
    customerId: sub.customerId,
    date: period,
    due: addDays(period, sub.terms),
    period,
    status: 'Draft',
    product: product?.name || 'Subscription',
    quantity: sub.quantity,
    unitPrice: sub.unitPrice,
    taxRate: db.taxRate,
    discountName: discount?.name || '',
    ...amounts,
  };
  if (discount) discount.used += 1;
  return invoice;
}
export function runBilling(database, today = TODAY) {
  const db = structuredClone(database);
  let count = 0;
  for (const sub of db.subscriptions) {
    if (sub.status !== 'Active') continue;
    const plan = db.plans.find((p) => p.id === sub.planId);
    while (sub.nextBilling <= today && sub.nextBilling <= sub.expiry) {
      const period = sub.nextBilling;
      // Keep cancelled invoices as a period lock: retrying billing never charges twice.
      if (!db.invoices.some((i) => i.subscriptionId === sub.id && i.period === period)) {
        db.invoices.push(buildInvoice(db, sub, period));
        count += 1;
      }
      sub.nextBilling = nextDate(period, plan.cycle);
    }
    if (sub.expiry < today && plan.autoClose) sub.status = 'Closed';
  }
  return { db, count };
}
export const monthlyValue = (sub, plan) =>
  round(
    sub.quantity *
      sub.unitPrice *
      ({ Daily: 365 / 12, Weekly: 52 / 12, Monthly: 1, Yearly: 1 / 12 }[plan?.cycle] || 1),
  );
export function downloadCsv(filename, rows) {
  const escape = (val) => {
    let str = String(val ?? '');
    // Prevent spreadsheet software from interpreting customer-controlled text as formulas.
    if (/^[=+@\-\t\r]/.test(str)) str = "'" + str;
    return '"' + str.replaceAll('"', '""') + '"';
  };
  const csv = '\ufeff' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
