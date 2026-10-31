import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Icon,
  Button,
  Badge,
  Customer,
  Modal,
  Empty,
  Metric,
  Table,
  Field,
} from './components.jsx';
import Editor from './Editor.jsx';
import { readData, seedData, STORAGE_KEY } from './data.js';
import {
  TODAY,
  money,
  round,
  dateLabel,
  addDays,
  nextDate,
  nextId,
  runBilling,
  balance,
  paidAmount,
  invoiceStatus,
  monthlyValue,
  downloadCsv,
} from './billing.js';

const pages = {
  dashboard: ['Overview', 'Your business, at a glance.'],
  subscriptions: ['Subscriptions', 'A clear view of every customer relationship.'],
  products: ['Products', 'Build the building blocks of your recurring business.'],
  plans: ['Recurring plans', 'Flexible plans. Predictable growth.'],
  customers: ['Customers', 'Good relationships start with a little context.'],
  invoices: ['Invoices', 'From billing day to payday, all in one place.'],
  payments: ['Payments', 'Every payment, accounted for.'],
  discounts: ['Discounts', 'Give your customers another reason to stay.'],
  reports: ['Reports', 'Understand the numbers behind your growth.'],
  templates: ['Quotation templates', 'A great offer starts with a great template.'],
  settings: ['Settings', 'Keep your workspace running your way.'],
  portal: ['Customer portal', 'Your subscriptions, invoices, and payments in one place.'],
};
const nav = [
  ['dashboard', 'grid', 'Overview'],
  ['subscriptions', 'repeat', 'Subscriptions'],
  ['customers', 'users', 'Customers'],
  ['products', 'box', 'Products'],
  ['plans', 'layers', 'Recurring plans'],
  ['invoices', 'file', 'Invoices'],
  ['payments', 'wallet', 'Payments'],
  ['discounts', 'tag', 'Discounts'],
  ['templates', 'file', 'Quotation templates'],
  ['reports', 'chart', 'Reports'],
];
const adminPages = ['products', 'plans', 'discounts', 'settings'];
const stageNext = { Draft: 'Quotation', Quotation: 'Confirmed', Confirmed: 'Active' };
const formatCompact = (n) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `₹${Math.round(n / 1000)}k`
      : `₹${Math.round(n)}`;

export default function App() {
  const [db, setDb] = useState(readData);
  const [page, setPage] = useState(() => window.location.hash.slice(1) || 'dashboard');
  const [role, setRole] = useState('Admin');
  const [portalCustomer, setPortalCustomer] = useState('CUS-1001');
  const [modal, setModal] = useState(null);
  const close = useCallback(() => setModal(null), []);
  const [toast, setToast] = useState('');
  const toastTimer = useRef();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [pageNumber, setPageNumber] = useState(1);
  const [chartRange, setChartRange] = useState(6);
  const [reportFrom, setReportFrom] = useState('2026-05-01');
  const [reportTo, setReportTo] = useState(TODAY);
  const [globalSearch, setGlobalSearch] = useState('');
  const admin = role === 'Admin';
  const customerRole = role === 'Customer';
  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      notify('Browser storage is unavailable. Changes will last for this session only.');
    }
  }, [db, notify]);
  useEffect(() => {
    const change = () => {
      setPage(window.location.hash.slice(1) || 'dashboard');
      setSearch('');
      setFilter('All');
      setPageNumber(1);
      setMobileOpen(false);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = `${pages[page]?.[0] || 'Overview'} · Brightloop`;
  }, [page]);
  useEffect(() => {
    if (customerRole && page !== 'portal') navigate('portal');
    else if (!customerRole && page === 'portal') navigate('dashboard');
    else if (!admin && adminPages.includes(page)) navigate('dashboard');
  }, [role, page]);
  function navigate(target) {
    if (window.location.hash === `#${target}`) {
      setPage(target);
      setSearch('');
      setFilter('All');
      setPageNumber(1);
    } else window.location.hash = target;
    setMobileOpen(false);
  }
  function commit(next, message) {
    setDb(next);
    close();
    if (message) notify(message);
  }
  function mutate(fn, message) {
    const next = structuredClone(db);
    fn(next);
    commit(next, message);
  }
  const currentCustomer = db.customers.find((c) => c.id === portalCustomer) || db.customers[0];
  const visibleSubs = customerRole
    ? db.subscriptions.filter((s) => s.customerId === currentCustomer?.id)
    : db.subscriptions;
  const visibleInvoices = customerRole
    ? db.invoices.filter((i) => i.customerId === currentCustomer?.id)
    : db.invoices;
  const active = visibleSubs.filter((s) => s.status === 'Active');
  const mrr = active.reduce(
    (n, s) =>
      n +
      monthlyValue(
        s,
        db.plans.find((p) => p.id === s.planId),
      ),
    0,
  );
  const overdue = visibleInvoices.filter((i) => invoiceStatus(db, i) === 'Overdue');
  const outstanding = visibleInvoices
    .filter((i) => !['Draft', 'Cancelled'].includes(i.status))
    .reduce((n, i) => n + balance(db, i), 0);
  const collected = db.payments
    .filter(
      (p) =>
        visibleInvoices.some((i) => i.id === p.invoiceId) &&
        p.date.slice(0, 7) === TODAY.slice(0, 7),
    )
    .reduce((n, p) => n + p.amount, 0);
  const customerOf = (id) => db.customers.find((c) => c.id === id);
  const planOf = (id) => db.plans.find((p) => p.id === id);
  function edit(kind, item = {}) {
    if (
      (['product', 'plan', 'discount', 'staff'].includes(kind) && !admin) ||
      (customerRole && !['signup', 'reset'].includes(kind))
    ) {
      notify('This action is not available for this demo role.');
      return;
    }
    setModal({ type: 'editor', kind, item });
  }
  function save(kind, item, v) {
    if (['product', 'plan', 'discount', 'staff'].includes(kind) && !admin)
      throw Error('Only an admin can make this change.');
    const next = structuredClone(db);
    const number = (key, min = 0) => {
      const n = Number(v[key]);
      if (!Number.isFinite(n) || n < min) throw Error(`Enter a valid ${key}.`);
      return n;
    };
    const integer = (key, min = 1) => {
      const n = number(key, min);
      if (!Number.isInteger(n)) throw Error(`${key} must be a whole number.`);
      return n;
    };
    const dates = (a, b) => {
      if (!v[a] || !v[b] || v[a] > v[b])
        throw Error('The end date must be on or after the start date.');
    };
    const text = (key) => {
      const s = (v[key] || '').trim();
      if (!s) throw Error(`Enter ${key}.`);
      return s;
    };
    const upsert = (key, prefix, values) => {
      const index = next[key].findIndex((x) => x.id === item.id);
      const record = { ...item, ...values, id: item.id || nextId(next[key], prefix) };
      if (index < 0) next[key].push(record);
      else next[key][index] = record;
      return record;
    };
    if (kind === 'customer' || kind === 'signup') {
      const email = text('email').toLowerCase();
      if (
        next.customers.some((c) => c.email.toLowerCase() === email && c.id !== item.id) ||
        next.staff.some((s) => s.email.toLowerCase() === email)
      )
        throw Error('That email is already registered.');
      if (
        kind === 'signup' &&
        (!(v.password.length > 8) ||
          !/[A-Z]/.test(v.password) ||
          !/[a-z]/.test(v.password) ||
          !/[^a-zA-Z0-9\s]/.test(v.password))
      )
        throw Error(
          'Use more than 8 characters, with uppercase, lowercase, and a special character.',
        );
      const c = upsert('customers', 'CUS', {
        name: text('name'),
        email,
        contact: v.contact || v.name,
        color: '#e8eddf',
      });
      if (kind === 'signup') {
        next.accounts.push({ customerId: c.id, email });
        setPortalCustomer(c.id);
        setRole('Customer');
      }
    } else if (kind === 'product') {
      upsert('products', 'PRD', {
        name: text('name'),
        type: v.type,
        price: number('price'),
        cost: number('cost'),
        variant: v.variant.trim(),
        variantPrice: number('variantPrice'),
        notes: v.notes.trim(),
      });
    } else if (kind === 'plan') {
      dates('start', 'end');
      upsert('plans', 'PLN', {
        name: text('name'),
        productId: v.productId,
        price: number('price'),
        cycle: v.cycle,
        minQuantity: integer('minQuantity'),
        start: v.start,
        end: v.end,
        autoClose: !!v.autoClose,
        allowPause: !!v.allowPause,
        allowClose: !!v.allowClose,
        allowRenew: !!v.allowRenew,
      });
    } else if (kind === 'subscription' || kind === 'quote') {
      dates('start', 'expiry');
      const plan = planOf(v.planId);
      const prod = next.products.find((p) => p.id === plan.productId);
      if (v.start < plan.start || v.start > plan.end)
        throw Error('The plan is not available on this start date.');
      const quantity = integer('quantity', plan.minQuantity);
      const template = db.templates.find((t) => t.id === item.templateId);
      upsert('subscriptions', 'SUB', {
        customerId: v.customerId,
        planId: plan.id,
        productId: plan.productId,
        quantity,
        variant: v.variant,
        unitPrice: round(plan.price + (v.variant ? prod.variantPrice : 0)),
        start: v.start,
        expiry: v.expiry,
        nextBilling: v.start,
        terms: integer('terms', 0),
        status: kind === 'quote' ? 'Quotation' : 'Draft',
        quoteExpiry: kind === 'quote' ? addDays(TODAY, template?.validDays || 30) : null,
      });
    } else if (kind === 'payment') {
      const invoice = next.invoices.find((i) => i.id === v.invoiceId);
      const remaining = balance(next, invoice);
      const amount = number('amount', 0.01);
      if (['Draft', 'Cancelled', 'Paid'].includes(invoiceStatus(next, invoice)))
        throw Error('Only confirmed, outstanding invoices can receive payments.');
      if (amount > remaining) throw Error('Payment exceeds the outstanding balance.');
      if (v.date > TODAY || v.date < invoice.date)
        throw Error('Payment date must be between the invoice date and today.');
      next.payments.push({
        id: nextId(next.payments, 'PAY'),
        invoiceId: invoice.id,
        amount: round(amount),
        method: v.method,
        date: v.date,
        note: v.note.trim(),
      });
    } else if (kind === 'discount') {
      dates('start', 'end');
      const value = number('value', 0.01);
      if (v.type === 'Percentage' && value > 100) throw Error('Percentage cannot exceed 100.');
      upsert('discounts', 'DSC', {
        name: text('name'),
        type: v.type,
        value,
        minQuantity: integer('minQuantity'),
        minPurchase: number('minPurchase'),
        start: v.start,
        end: v.end,
        limit: integer('limit', Math.max(1, item.used || 0)),
        used: item.used || 0,
        scope: v.scope,
        enabled: !!v.enabled,
      });
    } else if (kind === 'template') {
      const plan = planOf(v.planId);
      upsert('templates', 'TPL', {
        name: text('name'),
        planId: v.planId,
        quantity: integer('quantity', plan.minQuantity),
        validDays: integer('validDays'),
      });
    } else if (kind === 'staff') {
      const email = text('email').toLowerCase();
      if (
        next.staff.some((s) => s.email.toLowerCase() === email) ||
        next.customers.some((c) => c.email.toLowerCase() === email)
      )
        throw Error('That email is already registered.');
      upsert('staff', 'STA', { name: text('name'), email, role: 'Staff' });
    } else if (kind === 'reset') {
      close();
      notify('Reset preview complete. Connect an email service to deliver a secure reset link.');
      return;
    }
    next.activity.unshift({
      message: `${kind === 'payment' ? 'Recorded payment' : item.id ? 'Updated' : 'Created'} ${kind}`,
      date: TODAY,
    });
    commit(
      next,
      kind === 'payment'
        ? 'Payment recorded. The invoice balance is updated.'
        : kind === 'signup'
          ? 'Demo account created. Welcome to your portal.'
          : 'Saved successfully.',
    );
  }
  function advance(sub) {
    if (customerRole) return;
    if (sub.status === 'Quotation' && sub.quoteExpiry && sub.quoteExpiry < TODAY) {
      notify('This quote has expired. Create a new quotation.');
      return;
    }
    if (sub.status === 'Confirmed' && sub.expiry < TODAY) {
      notify('This subscription has expired. Renew it before activation.');
      return;
    }
    mutate((n) => {
      const s = n.subscriptions.find((x) => x.id === sub.id);
      s.status = stageNext[s.status];
    }, `Subscription moved to ${stageNext[sub.status]}.`);
  }
  function lifecycle(sub, action) {
    if (customerRole && sub.customerId !== currentCustomer?.id) return;
    const plan = planOf(sub.planId);
    if (
      (action === 'renew' && !plan.allowRenew) ||
      (action === 'pause' && !plan.allowPause) ||
      (action === 'close' && !plan.allowClose)
    )
      return;
    mutate(
      (n) => {
        const s = n.subscriptions.find((x) => x.id === sub.id);
        if (action === 'pause') s.status = 'Paused';
        if (action === 'resume') {
          s.status = 'Active';
          s.nextBilling = TODAY;
        }
        if (action === 'close') s.status = 'Closed';
        if (action === 'renew') {
          const renewalStart = s.expiry >= TODAY ? addDays(s.expiry, 1) : TODAY;
          const continuing = s.status === 'Active' && s.expiry >= TODAY;
          s.expiry = addDays(nextDate(renewalStart, plan.cycle), -1);
          if (!continuing) {
            s.start = renewalStart;
            s.nextBilling = renewalStart;
          }
          s.status = 'Active';
        }
      },
      `Subscription ${action === 'renew' ? 'renewed' : action === 'resume' ? 'resumed' : action === 'close' ? 'closed' : 'paused'}.`,
    );
  }
  function bill() {
    if (customerRole) return;
    const result = runBilling(db);
    commit(
      result.db,
      result.count
        ? `${result.count} draft invoice${result.count === 1 ? '' : 's'} generated. Review and confirm in Invoices.`
        : 'Everything is up to date. No invoices are due.',
    );
  }
  function setInvoiceState(invoice, status) {
    if (customerRole) return;
    if (status === 'Cancelled' && paidAmount(db, invoice.id) > 0) {
      notify('An invoice with payments cannot be cancelled.');
      return;
    }
    mutate((n) => {
      n.invoices.find((i) => i.id === invoice.id).status = status;
    }, `Invoice ${status.toLowerCase()}.`);
  }
  function exportData() {
    let rows;
    if (page === 'invoices')
      rows = [
        ['Invoice', 'Customer', 'Date', 'Due', 'Total', 'Paid', 'Balance', 'Status'],
        ...visibleInvoices.map((i) => [
          i.id,
          customerOf(i.customerId)?.name,
          i.date,
          i.due,
          i.total,
          paidAmount(db, i.id),
          balance(db, i),
          invoiceStatus(db, i),
        ]),
      ];
    else if (page === 'payments')
      rows = [
        ['Payment', 'Invoice', 'Date', 'Method', 'Amount', 'Reference'],
        ...db.payments.map((p) => [p.id, p.invoiceId, p.date, p.method, p.amount, p.note]),
      ];
    else if (page === 'customers')
      rows = [
        ['Customer', 'Email', 'Contact'],
        ...db.customers.map((c) => [c.name, c.email, c.contact]),
      ];
    else if (page === 'reports')
      rows = [
        ['Period', reportFrom, reportTo],
        ['Metric', 'Amount'],
        ['Active subscriptions', active.length],
        ['Monthly recurring revenue', round(mrr)],
        [
          'Payments in period',
          db.payments
            .filter((p) => p.date >= reportFrom && p.date <= reportTo)
            .reduce((n, p) => n + p.amount, 0),
        ],
        ['Outstanding today', round(outstanding)],
        ['Overdue invoices today', overdue.length],
      ];
    else
      rows = [
        [
          'Subscription',
          'Customer',
          'Plan',
          'Status',
          'Quantity',
          'Unit price',
          'Next billing',
          'Expiry',
        ],
        ...visibleSubs.map((s) => [
          s.id,
          customerOf(s.customerId)?.name,
          planOf(s.planId)?.name,
          s.status,
          s.quantity,
          s.unitPrice,
          s.nextBilling,
          s.expiry,
        ]),
      ];
    downloadCsv(`brightloop-${page}.csv`, rows);
    notify('CSV exported.');
  }
  function toolbar(title, count, withFilter = false) {
    return (
      <div className="table-toolbar">
        <div className="table-title">
          <h2>{title}</h2>
          <span className="count-chip">{count}</span>
        </div>
        <div className="table-tools">
          <label className="table-search">
            <Icon name="search" />
            <input
              aria-label={`Search ${title.toLowerCase()}`}
              placeholder="Search anything…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageNumber(1);
              }}
            />
          </label>
          {withFilter && (
            <select
              className="filter"
              aria-label="Filter status"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPageNumber(1);
              }}
            >
              {[
                'All',
                'Draft',
                'Quotation',
                'Confirmed',
                'Active',
                'Paused',
                'Closed',
                'Paid',
                'Overdue',
                'Cancelled',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  }
  function paginated(rows) {
    return rows.slice((pageNumber - 1) * 6, pageNumber * 6);
  }
  function pagination(count) {
    const total = Math.max(1, Math.ceil(count / 6));
    return (
      <div className="table-footer">
        <span>
          {count
            ? `${(pageNumber - 1) * 6 + 1}–${Math.min(pageNumber * 6, count)} of ${count}`
            : '0 results'}
        </span>
        <div className="pagination">
          <button
            aria-label="Previous page"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
          >
            ‹
          </button>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              aria-label={`Page ${i + 1}`}
              aria-current={pageNumber === i + 1 ? 'page' : undefined}
              className={pageNumber === i + 1 ? 'current' : ''}
              onClick={() => setPageNumber(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            aria-label="Next page"
            disabled={pageNumber >= total}
            onClick={() => setPageNumber((p) => p + 1)}
          >
            ›
          </button>
        </div>
      </div>
    );
  }
  function subscriptionTable(overview = false) {
    let rows = visibleSubs.filter((s) =>
      `${s.id} ${customerOf(s.customerId)?.name} ${planOf(s.planId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    if (filter === 'Upcoming')
      rows = rows.filter(
        (s) =>
          s.status === 'Active' && s.nextBilling >= TODAY && s.nextBilling <= addDays(TODAY, 30),
      );
    else if (filter !== 'All') rows = rows.filter((s) => s.status === filter);
    return (
      <section className="panel table-panel">
        {toolbar(
          overview ? 'Recent subscriptions' : 'All subscriptions',
          visibleSubs.length,
          !overview,
        )}
        {overview && (
          <div className="tabs">
            {['All', 'Active', 'Upcoming', 'Paused'].map((t) => (
              <button
                className={`tab ${filter === t ? 'active' : ''}`}
                key={t}
                onClick={() => {
                  setFilter(t);
                  setPageNumber(1);
                }}
              >
                {t === 'All' ? 'All subscriptions' : t === 'Upcoming' ? 'Upcoming renewals' : t}
              </button>
            ))}
            <button
              className="text-button"
              style={{ marginLeft: 'auto', marginBottom: 13 }}
              onClick={() => navigate('subscriptions')}
            >
              View all <Icon name="arrow" />
            </button>
          </div>
        )}
        <Table
          headers={[
            'Customer',
            'Subscription',
            'Plan',
            'Amount / cycle',
            'Next billing',
            'Status',
            '',
          ]}
          rows={paginated(rows).map((s) => (
            <tr key={s.id}>
              <td>
                <Customer customer={customerOf(s.customerId)} />
              </td>
              <td className="id">{s.id}</td>
              <td>
                {planOf(s.planId)?.name}
                <small className="muted" style={{ display: 'block', marginTop: 4, fontSize: 9 }}>
                  {planOf(s.planId)?.cycle}
                </small>
              </td>
              <td>{money(s.quantity * s.unitPrice)}</td>
              <td>{s.status === 'Closed' ? '—' : dateLabel(s.nextBilling)}</td>
              <td>
                <Badge value={s.status} />
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Open ${s.id}`}
                  onClick={() => setModal({ type: 'subscription', id: s.id })}
                >
                  <Icon name="more" />
                </button>
              </td>
            </tr>
          ))}
        />
        {pagination(rows.length)}
      </section>
    );
  }
  function invoiceTable() {
    const rows = [...visibleInvoices]
      .reverse()
      .filter(
        (i) =>
          `${i.id} ${customerOf(i.customerId)?.name}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === 'All' || invoiceStatus(db, i) === filter),
      );
    return (
      <section className="panel table-panel">
        {toolbar('All invoices', visibleInvoices.length, true)}
        <Table
          headers={['Invoice', 'Customer', 'Issued', 'Due date', 'Total', 'Balance', 'Status', '']}
          rows={paginated(rows).map((i) => (
            <tr key={i.id}>
              <td className="id">{i.id}</td>
              <td>
                <Customer customer={customerOf(i.customerId)} />
              </td>
              <td>{dateLabel(i.date)}</td>
              <td>{dateLabel(i.due)}</td>
              <td>{money(i.total)}</td>
              <td>{money(balance(db, i))}</td>
              <td>
                <Badge value={invoiceStatus(db, i)} />
              </td>
              <td>
                <button
                  className="text-button"
                  onClick={() => setModal({ type: 'invoice', id: i.id })}
                >
                  View <Icon name="arrow" />
                </button>
              </td>
            </tr>
          ))}
        />
        {pagination(rows.length)}
      </section>
    );
  }
  function revenueChart() {
    const months = Array.from({ length: chartRange }, (_, i) => {
      const d = new Date(`${TODAY}T00:00:00Z`);
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - (chartRange - 1 - i));
      return d.toISOString().slice(0, 7);
    });
    const values = months.map((m) =>
      db.payments.filter((p) => p.date.startsWith(m)).reduce((n, p) => n + p.amount, 0),
    );
    const max = Math.max(1000, ...values) * 1.16;
    const points = values.map((v, i) => [48 + i * (520 / (chartRange - 1)), 155 - (v / max) * 125]);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.join(',')}`).join(' ');
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Revenue overview</h2>
            <p>A little perspective on your progress</p>
          </div>
          <div className="pill-control">
            <button className={chartRange === 6 ? 'active' : ''} onClick={() => setChartRange(6)}>
              6 months
            </button>
            <button className={chartRange === 12 ? 'active' : ''} onClick={() => setChartRange(12)}>
              12 months
            </button>
          </div>
        </div>
        <div className="chart-summary">
          <strong>{money(values.reduce((a, b) => a + b, 0))}</strong>
          <span className="growth">Collected revenue</span>
          <span className="chart-legend">Payments received</span>
        </div>
        <div className="chart">
          <svg
            role="img"
            aria-label={`Payments received over the last ${chartRange} months: ${values.map((v, i) => `${months[i]} ${money(v)}`).join(', ')}`}
            viewBox="0 0 590 190"
          >
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a8bc82" stopOpacity=".32" />
                <stop offset="100%" stopColor="#a8bc82" stopOpacity=".02" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="48"
                  y1={30 + i * 41.7}
                  x2="568"
                  y2={30 + i * 41.7}
                  stroke="#eaf0e3"
                  strokeDasharray="3 4"
                />
                <text x="1" y={34 + i * 41.7}>
                  {formatCompact((max * (3 - i)) / 3)}
                </text>
              </g>
            ))}
            <path d={`${line} L568,155 L48,155 Z`} fill="url(#revenue-fill)" />
            <path d={line} fill="none" stroke="#8da66b" strokeWidth="2.5" strokeLinejoin="round" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r="3" fill="#8da66b" stroke="white" strokeWidth="2">
                  <title>
                    {months[i]}: {money(values[i])}
                  </title>
                </circle>
                <text textAnchor="middle" x={p[0]} y="181">
                  {new Date(months[i] + '-01T00:00:00Z').toLocaleString('en', {
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </section>
    );
  }
  function statusChart() {
    const groups = [
      ['Active', '#496a3f'],
      ['Paused', '#a8b78c'],
      ['Quotation', '#d9dfba'],
      ['Other', '#edf0e5'],
    ].map(([label, color]) => ({
      label,
      color,
      count: visibleSubs.filter((s) =>
        label === 'Other'
          ? !['Active', 'Paused', 'Quotation'].includes(s.status)
          : s.status === label,
      ).length,
    }));
    let angle = 0;
    const stops = groups
      .map((g) => {
        const start = angle;
        angle += (g.count / (visibleSubs.length || 1)) * 360;
        return `${g.color} ${start}deg ${angle}deg`;
      })
      .join(',');
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Subscription health</h2>
            <p>Every customer, part of the picture</p>
          </div>
          <Icon name="repeat" style={{ color: '#9aa58e', width: 15 }} />
        </div>
        <div className="donut-content">
          <div
            className="donut"
            role="img"
            aria-label={groups.map((g) => `${g.label}: ${g.count}`).join(', ')}
            style={{ background: visibleSubs.length ? `conic-gradient(${stops})` : '#edf0e5' }}
          >
            <div className="donut-label">
              <strong>{visibleSubs.length}</strong>
              <small>Total subscriptions</small>
            </div>
          </div>
          <div className="legend">
            {groups.map((g) => (
              <div key={g.label} className="legend-item">
                <i className="dot" style={{ background: g.color }} />
                <span className="muted">{g.label}</span>
                <strong>{g.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-note">
          <Icon name="check" />
          {Math.round((active.length / (visibleSubs.length || 1)) * 100)}% of your subscriptions are
          active
        </div>
      </section>
    );
  }
  function metrics() {
    return (
      <div className="metrics">
        <Metric
          label="Monthly recurring revenue"
          value={money(mrr)}
          icon="trend"
          highlight="MRR"
          note="normalized across billing cycles"
        />
        <Metric
          label="Active subscriptions"
          value={active.length}
          icon="repeat"
          highlight={`${db.customers.filter((c) => active.some((s) => s.customerId === c.id)).length} customers`}
          note="growing with you"
        />
        <Metric
          label="Collected this month"
          value={money(collected)}
          icon="wallet"
          highlight="October 2026"
          note="payments received"
        />
        <Metric
          label="Outstanding balance"
          value={money(outstanding)}
          icon="clock"
          highlight={`${overdue.length} overdue invoices`}
          note="need a little attention"
          attention
        />
      </div>
    );
  }
  function catalog(kind) {
    const items = db[kind].filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <label className="table-search" style={{ width: 270, marginBottom: 22 }}>
          <Icon name="search" />
          <input
            aria-label={`Search ${kind}`}
            value={search}
            placeholder={`Search ${kind}…`}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="cards">
          {items.map((item) => (
            <section className="panel catalog-card" key={item.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div className="catalog-icon">
                  <Icon name={kind === 'products' ? 'box' : kind === 'plans' ? 'layers' : 'file'} />
                </div>
                <Badge
                  value={
                    kind === 'products' ? item.type : kind === 'plans' ? item.cycle : 'Template'
                  }
                />
              </div>
              <h2>{item.name}</h2>
              <p>
                {kind === 'products'
                  ? item.notes
                  : kind === 'plans'
                    ? `A ${item.cycle.toLowerCase()} plan for ${db.products.find((p) => p.id === item.productId)?.name}.`
                    : `${planOf(item.planId)?.name} · ready to customize for your next customer.`}
              </p>
              <div className="catalog-price">
                {kind === 'templates' ? `${item.quantity} seats` : money(item.price)}
                <small>
                  {' '}
                  /{' '}
                  {kind === 'products'
                    ? 'base price'
                    : kind === 'plans'
                      ? item.cycle.toLowerCase() + ' · seat'
                      : 'quotation'}
                </small>
              </div>
              <div className="detail-list">
                {kind === 'products' ? (
                  <>
                    <span>
                      <Icon name="check" />
                      {item.variant || 'Standard'}{' '}
                      {item.variant ? `variant · +${money(item.variantPrice)}` : ''}
                    </span>
                    <span>
                      <Icon name="box" />
                      Cost price: {money(item.cost)}
                    </span>
                  </>
                ) : kind === 'plans' ? (
                  <>
                    <span>
                      <Icon name="users" />
                      From {item.minQuantity} seat{item.minQuantity === 1 ? '' : 's'}
                    </span>
                    <span>
                      <Icon name="calendar" />
                      Available until {dateLabel(item.end)}
                    </span>
                    <span>
                      <Icon name="check" />
                      {[
                        item.allowPause && 'Pause',
                        item.allowRenew && 'Renew',
                        item.allowClose && 'Close',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Fixed term'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <Icon name="clock" />
                      Valid for {item.validDays} days
                    </span>
                    <span>
                      <Icon name="layers" />
                      Product:{' '}
                      {db.products.find((p) => p.id === planOf(item.planId)?.productId)?.name}
                    </span>
                  </>
                )}
              </div>
              <div className="card-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    edit(
                      kind === 'products' ? 'product' : kind === 'plans' ? 'plan' : 'template',
                      item,
                    )
                  }
                >
                  Edit {kind === 'products' ? 'product' : kind === 'plans' ? 'plan' : 'template'}{' '}
                  <Icon name="arrow" />
                </button>
                {kind === 'templates' && (
                  <Button primary onClick={() => edit('quote', { templateId: item.id })}>
                    Use template
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>
        {!items.length && <Empty />}
      </>
    );
  }
  function customers() {
    const rows = db.customers.filter((c) =>
      `${c.name} ${c.email} ${c.contact}`.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <section className="panel table-panel">
        {toolbar('All customers', db.customers.length)}
        <Table
          headers={['Customer', 'Contact person', 'Subscriptions', 'Active', '']}
          rows={paginated(rows).map((c) => (
            <tr key={c.id}>
              <td>
                <Customer customer={c} />
              </td>
              <td>{c.contact}</td>
              <td>{db.subscriptions.filter((s) => s.customerId === c.id).length}</td>
              <td>
                {
                  db.subscriptions.filter((s) => s.customerId === c.id && s.status === 'Active')
                    .length
                }
              </td>
              <td>
                <button className="text-button" onClick={() => edit('customer', c)}>
                  Edit details <Icon name="arrow" />
                </button>
              </td>
            </tr>
          ))}
        />
        {pagination(rows.length)}
      </section>
    );
  }
  function payments() {
    const rows = [...db.payments]
      .reverse()
      .filter((p) =>
        `${p.id} ${p.invoiceId} ${p.method} ${p.note}`.toLowerCase().includes(search.toLowerCase()),
      );
    return (
      <section className="panel table-panel">
        {toolbar('Payment history', db.payments.length)}
        <Table
          headers={['Payment', 'Invoice', 'Date', 'Method', 'Amount', 'Reference']}
          rows={paginated(rows).map((p) => (
            <tr key={p.id}>
              <td className="id">{p.id}</td>
              <td>
                <button
                  className="text-button"
                  onClick={() => setModal({ type: 'invoice', id: p.invoiceId })}
                >
                  {p.invoiceId}
                </button>
              </td>
              <td>{dateLabel(p.date)}</td>
              <td>{p.method}</td>
              <td>{money(p.amount)}</td>
              <td>{p.note || '—'}</td>
            </tr>
          ))}
        />
        {pagination(rows.length)}
      </section>
    );
  }
  function discounts() {
    const rows = db.discounts.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <div className="notice">
          Eligible discounts apply automatically to new invoices. The first matching rule is used;
          discounts do not stack. Existing invoices keep their original totals.
        </div>
        <section className="panel table-panel">
          {toolbar('Discount rules', db.discounts.length)}
          <Table
            headers={['Discount', 'Value', 'Minimum', 'Valid until', 'Uses', 'Status', '']}
            rows={paginated(rows).map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.name}</strong>
                  <small className="muted" style={{ display: 'block', marginTop: 4, fontSize: 10 }}>
                    {d.scope === 'all'
                      ? 'All subscriptions'
                      : db.products.find((p) => p.id === d.scope)?.name || d.scope}
                  </small>
                </td>
                <td>{d.type === 'Percentage' ? `${d.value}%` : money(d.value)}</td>
                <td>
                  {d.minQuantity} seats · {money(d.minPurchase)}
                </td>
                <td>{dateLabel(d.end)}</td>
                <td>
                  {d.used} / {d.limit}
                </td>
                <td>
                  <Badge
                    value={
                      !d.enabled
                        ? 'Paused'
                        : d.end < TODAY || d.used >= d.limit
                          ? 'Closed'
                          : d.start > TODAY
                            ? 'Draft'
                            : 'Active'
                    }
                  />
                </td>
                <td>
                  <button className="text-button" onClick={() => edit('discount', d)}>
                    Edit rule <Icon name="arrow" />
                  </button>
                </td>
              </tr>
            ))}
          />
          {pagination(rows.length)}
        </section>
      </>
    );
  }
  function reports() {
    const inPeriod = (p) => p.date >= reportFrom && p.date <= reportTo;
    const revenue = db.payments.filter(inPeriod).reduce((n, p) => n + p.amount, 0);
    return (
      <>
        <div
          className="panel"
          style={{
            padding: 20,
            marginBottom: 23,
            display: 'flex',
            gap: 15,
            flexWrap: 'wrap',
            alignItems: 'end',
          }}
        >
          <Field label="Payments from">
            <input
              type="date"
              value={reportFrom}
              max={reportTo}
              onChange={(e) => {
                if (e.target.value) setReportFrom(e.target.value);
              }}
            />
          </Field>
          <Field label="Payments through">
            <input
              type="date"
              value={reportTo}
              min={reportFrom}
              max={TODAY}
              onChange={(e) => {
                if (e.target.value) setReportTo(e.target.value);
              }}
            />
          </Field>
          <span className="muted" style={{ fontSize: 11, paddingBottom: 10 }}>
            Balance and MRR show the current demo snapshot.
          </span>
        </div>
        <div className="metrics">
          <Metric
            label="Payments in period"
            value={money(revenue)}
            icon="wallet"
            highlight={`${db.payments.filter(inPeriod).length} payments`}
            note="successfully recorded"
          />
          <Metric
            label="Active subscriptions today"
            value={active.length}
            icon="repeat"
            note="current snapshot"
          />
          <Metric
            label="Recurring revenue today"
            value={money(mrr)}
            icon="chart"
            note="normalized per month"
          />
          <Metric
            label="Overdue today"
            value={money(overdue.reduce((n, i) => n + balance(db, i), 0))}
            icon="clock"
            note={`${overdue.length} outstanding invoices`}
            attention
          />
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Collected by payment method</h2>
            </div>
            <div className="report-bars">
              {['Bank transfer', 'UPI', 'Card', 'Cash', 'Other'].map((method) => {
                const amount = db.payments
                  .filter((p) => inPeriod(p) && p.method === method)
                  .reduce((n, p) => n + p.amount, 0);
                return (
                  <div className="report-bar" key={method}>
                    <div>
                      <span>{method}</span>
                      <strong>{money(amount)}</strong>
                    </div>
                    <div className="bar-track">
                      <div style={{ width: `${revenue ? (amount / revenue) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          {statusChart()}
        </div>
        <section className="panel">
          <div className="panel-head">
            <h2>Overdue invoices · current snapshot</h2>
            <button
              className="text-button"
              onClick={() => {
                navigate('invoices');
                setTimeout(() => setFilter('Overdue'), 0);
              }}
            >
              View invoices <Icon name="arrow" />
            </button>
          </div>
          <Table
            headers={['Invoice', 'Customer', 'Due date', 'Amount outstanding']}
            rows={overdue.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>{customerOf(i.customerId)?.name}</td>
                <td>{dateLabel(i.due)}</td>
                <td>{money(balance(db, i))}</td>
              </tr>
            ))}
          />
        </section>
      </>
    );
  }
  function settings() {
    return (
      <>
        <div className="settings-grid">
          <section className="panel">
            <h2>Tax configuration</h2>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
              Applied to the discounted subtotal when a new invoice is generated. Existing invoices
              preserve their tax rate.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const rate = Number(new FormData(e.currentTarget).get('rate'));
                if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
                mutate((n) => {
                  n.taxRate = rate;
                }, 'Tax rate updated.');
              }}
            >
              <Field label="Default sales tax (%)">
                <input
                  name="rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  defaultValue={db.taxRate}
                />
              </Field>
              <Button primary type="submit" style={{ marginTop: 18 }}>
                Save tax rate
              </Button>
            </form>
          </section>
          <section className="panel">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 15,
              }}
            >
              <h2 style={{ margin: 0 }}>Your team</h2>
              <Button icon="plus" onClick={() => edit('staff')}>
                Add staff
              </Button>
            </div>
            {db.staff.map((s) => (
              <div className="list-row" key={s.id}>
                <div>
                  {s.name}
                  <small>{s.email}</small>
                </div>
                <Badge value={s.role} />
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Demo workspace</h2>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>
              Reference date: {dateLabel(TODAY)}. All data stays in this browser. Roles simulate
              access for interface review; they are not authentication.
            </p>
            <Button
              className="danger"
              style={{ marginTop: 20 }}
              onClick={() => setModal({ type: 'resetData' })}
            >
              Reset sample data
            </Button>
          </section>
          <section className="panel">
            <h2>Backend integration</h2>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>
              Ready to connect to Node.js / Express APIs for authentication, persistent records,
              scheduled billing, invoice email, and payment reconciliation. See README.md for the
              proposed API contract.
            </p>
            <Button style={{ marginTop: 20 }} onClick={() => edit('signup')}>
              Preview signup
            </Button>{' '}
            <Button style={{ marginTop: 20 }} onClick={() => edit('reset')}>
              Password reset
            </Button>
          </section>
        </div>
      </>
    );
  }
  function portal() {
    const portalInvoices = visibleInvoices.filter(
      (i) => !['Draft', 'Cancelled'].includes(i.status),
    );
    return (
      <>
        <div className="notice">
          Customer portal preview. Choose a demo customer to review their view. A production backend
          must enforce account ownership.
        </div>
        <div className="intro-banner">
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              YOUR BRIGHTLOOP WORKSPACE
            </div>
            <h2>Welcome back, {currentCustomer?.name}.</h2>
            <p>Everything you need to keep your team moving.</p>
          </div>
          <Field label="Preview customer">
            <select
              value={currentCustomer?.id}
              onChange={(e) => {
                setPortalCustomer(e.target.value);
                setSearch('');
                setFilter('All');
                setPageNumber(1);
              }}
            >
              {db.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="metrics">
          <Metric
            label="Active subscriptions"
            value={active.length}
            icon="repeat"
            note="working for your team"
          />
          <Metric
            label="Monthly recurring total"
            value={money(mrr)}
            icon="wallet"
            note="before tax and discounts"
          />
          <Metric
            label="Outstanding invoices"
            value={portalInvoices.filter((i) => balance(db, i) > 0).length}
            icon="file"
            note="confirmed invoices"
          />
          <Metric
            label="Balance due"
            value={money(outstanding)}
            icon="clock"
            note="all outstanding invoices"
          />
        </div>
        <section className="panel table-panel">
          <div className="table-toolbar">
            <h2>Your subscriptions</h2>
            <span className="count-chip">{visibleSubs.length}</span>
          </div>
          <Table
            headers={['Subscription', 'Plan', 'Amount / cycle', 'Status', '']}
            rows={visibleSubs.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{planOf(s.planId)?.name}</td>
                <td>{money(s.unitPrice * s.quantity)}</td>
                <td>
                  <Badge value={s.status} />
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => setModal({ type: 'subscription', id: s.id })}
                  >
                    Manage <Icon name="arrow" />
                  </button>
                </td>
              </tr>
            ))}
          />
        </section>
        <section className="panel table-panel" style={{ marginTop: 24 }}>
          <div className="table-toolbar">
            <h2>Your invoices</h2>
            <span className="count-chip">{portalInvoices.length}</span>
          </div>
          <Table
            headers={['Invoice', 'Issued', 'Total', 'Balance', 'Status', '']}
            rows={[...portalInvoices].reverse().map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>{dateLabel(i.date)}</td>
                <td>{money(i.total)}</td>
                <td>{money(balance(db, i))}</td>
                <td>
                  <Badge value={invoiceStatus(db, i)} />
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => setModal({ type: 'invoice', id: i.id })}
                  >
                    View <Icon name="arrow" />
                  </button>
                </td>
              </tr>
            ))}
          />
        </section>
      </>
    );
  }
  const allowedPage =
    pages[page] && (!customerRole || page === 'portal') && (admin || !adminPages.includes(page));
  const actualPage = customerRole ? 'portal' : allowedPage ? page : 'dashboard';
  return (
    <>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
        <a className="brand" href={customerRole ? '#portal' : '#dashboard'}>
          <span className="brand-mark">∞</span>brightloop<span style={{ color: '#88a36d' }}>.</span>
        </a>
        <div className="workspace">
          <div className="square">
            <Icon name="layers" />
          </div>
          <div>
            Brightloop Software<small>Your workspace</small>
          </div>
          <Icon name="down" />
        </div>
        <div className="eyebrow nav-label">WORKSPACE</div>
        <nav>
          {customerRole ? (
            <a href="#portal" className="nav-link active">
              <Icon name="grid" />
              My portal
            </a>
          ) : (
            nav
              .filter(([id]) => admin || !adminPages.includes(id))
              .map(([id, icon, label], i) => (
                <React.Fragment key={id}>
                  {i === 5 && (
                    <>
                      <div className="nav-gap" />
                      <div className="eyebrow nav-label">BILLING & INSIGHTS</div>
                    </>
                  )}
                  <a
                    href={`#${id}`}
                    className={`nav-link ${page === id ? 'active' : ''}`}
                    aria-current={page === id ? 'page' : undefined}
                  >
                    <Icon name={icon} />
                    {label}
                    {id === 'subscriptions' && (
                      <span className="count">{db.subscriptions.length}</span>
                    )}
                  </a>
                </React.Fragment>
              ))
          )}
        </nav>
        <div className="sidebar-bottom">
          {admin && (
            <a className={`nav-link ${page === 'settings' ? 'active' : ''}`} href="#settings">
              <Icon name="settings" />
              Settings
            </a>
          )}
          <button
            className="nav-link"
            style={{ border: 0, background: 'none', width: '100%' }}
            onClick={() => setModal({ type: 'help' })}
          >
            <Icon name="help" />
            Help & getting started
          </button>
          <div className="help-card">
            <h3 style={{ fontSize: 11 }}>A little less admin.</h3>
            <p>
              A little more room to grow.
              <br />
              Your billing, beautifully in sync.
            </p>
            <button onClick={() => setModal({ type: 'help' })}>
              Explore your workspace <span style={{ float: 'right' }}>↗</span>
            </button>
          </div>
          <div className="profile">
            <span className="avatar">{customerRole ? 'CU' : role === 'Admin' ? 'OR' : 'DC'}</span>
            <div>
              {customerRole ? 'Customer preview' : role === 'Admin' ? 'Olivia Rhye' : 'Drew Cano'}
              <small>
                {role === 'Admin'
                  ? 'Workspace admin'
                  : role === 'Staff'
                    ? 'Internal staff'
                    : 'Customer account'}
              </small>
            </div>
            <select
              value={role}
              aria-label="Demo role"
              title="Switch demo role"
              onChange={(e) => {
                setRole(e.target.value);
                close();
              }}
            >
              <option>Admin</option>
              <option>Staff</option>
              <option>Customer</option>
            </select>
          </div>
        </div>
      </aside>
      <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
      <div className="shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Icon name="menu" />
            </button>
            <Icon name="grid" />
            <span>Workspace</span>
            <Icon name="chevron" />
            <strong>{pages[actualPage][0]}</strong>
          </div>
          <div className="top-actions">
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (globalSearch.trim()) setModal({ type: 'search', query: globalSearch.trim() });
              }}
            >
              <Icon name="search" />
              <input
                aria-label="Search workspace"
                placeholder="Search workspace…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <button className="shortcut" type="submit">
                ↵
              </button>
            </form>
            <span className="top-separator" />
            <button
              className="icon-button notification"
              aria-label="View billing notifications"
              onClick={() => setModal({ type: 'notifications' })}
            >
              <Icon name="bell" />
            </button>
            <span className="avatar">{customerRole ? 'CU' : role === 'Admin' ? 'OR' : 'DC'}</span>
          </div>
        </header>
        <div className="demo-strip">
          <span />
          Interactive frontend demo · Data saved in this browser · {dateLabel(TODAY)}
        </div>
        <main id="main" className="content">
          <div className="page-heading">
            <div>
              {actualPage === 'dashboard' && (
                <div className="eyebrow">LET'S MAKE ROOM FOR GROWTH</div>
              )}
              <h1>
                {actualPage === 'dashboard'
                  ? 'Good morning, ' + (role === 'Admin' ? 'Olivia' : 'Drew') + ' ☀'
                  : pages[actualPage][0]}
              </h1>
              <p>
                {actualPage === 'dashboard'
                  ? 'Here’s what’s happening with your subscriptions today.'
                  : pages[actualPage][1]}
              </p>
            </div>
            <div className="actions">
              {!customerRole &&
                [
                  'dashboard',
                  'subscriptions',
                  'customers',
                  'invoices',
                  'payments',
                  'reports',
                ].includes(actualPage) && (
                  <Button icon="download" onClick={exportData}>
                    Export {actualPage === 'reports' ? 'report' : ''}
                  </Button>
                )}
              {actualPage === 'dashboard' && (
                <Button icon="calendar" onClick={() => navigate('reports')}>
                  Oct 2026 <Icon name="down" />
                </Button>
              )}
              {['subscriptions', 'dashboard'].includes(actualPage) && !customerRole && (
                <Button primary icon="plus" onClick={() => edit('subscription')}>
                  New subscription
                </Button>
              )}
              {['products', 'plans', 'customers', 'discounts', 'templates'].includes(
                actualPage,
              ) && (
                <Button
                  primary
                  icon="plus"
                  onClick={() =>
                    edit(
                      {
                        products: 'product',
                        plans: 'plan',
                        customers: 'customer',
                        discounts: 'discount',
                        templates: 'template',
                      }[actualPage],
                    )
                  }
                >
                  New{' '}
                  {
                    {
                      products: 'product',
                      plans: 'plan',
                      customers: 'customer',
                      discounts: 'discount',
                      templates: 'template',
                    }[actualPage]
                  }
                </Button>
              )}
              {actualPage === 'invoices' && (
                <Button primary icon="repeat" onClick={bill}>
                  Run recurring billing
                </Button>
              )}
            </div>
          </div>
          {actualPage === 'dashboard' && (
            <>
              {metrics()}
              <div className="dashboard-grid">
                {revenueChart()}
                {statusChart()}
              </div>
              {subscriptionTable(true)}
            </>
          )}
          {actualPage === 'subscriptions' && subscriptionTable()}
          {['products', 'plans', 'templates'].includes(actualPage) && catalog(actualPage)}
          {actualPage === 'customers' && customers()}
          {actualPage === 'invoices' && invoiceTable()}
          {actualPage === 'payments' && payments()}
          {actualPage === 'discounts' && discounts()}
          {actualPage === 'reports' && reports()}
          {actualPage === 'settings' && settings()}
          {actualPage === 'portal' && portal()}
          <footer className="bottom-note">
            <span>
              <Icon name="lock" />
              Your workspace. A clearer way to grow.
            </span>
            <span>BRIGHTLOOP SOFTWARE · FRONTEND DEMO</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Modal
          title={modalTitle(modal)}
          onClose={close}
          footer={modal.type === 'editor' ? null : <Button onClick={close}>Close</Button>}
        >
          {renderModal()}
        </Modal>
      )}
      <div id="toast" className={toast ? 'show' : ''} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );

  function modalTitle(m) {
    return m.type === 'editor'
      ? `${m.item.id ? 'Edit' : 'New'} ${m.kind === 'quote' ? 'quotation' : m.kind === 'signup' ? 'demo account' : m.kind === 'reset' ? 'password reset preview' : m.kind}`
      : {
          subscription: m.id,
          invoice: 'Invoice details',
          help: 'Welcome to Brightloop',
          notifications: 'Your billing inbox',
          search: 'Workspace search',
          resetData: 'Reset demo workspace',
          confirmClose: 'Close subscription',
          confirmRenew: 'Renew subscription',
        }[m.type] || 'Details';
  }
  function renderModal() {
    if (modal.type === 'editor')
      return (
        <Editor
          kind={modal.kind}
          item={modal.item}
          db={db}
          onClose={close}
          onSave={(v) => save(modal.kind, modal.item, v)}
        />
      );
    if (modal.type === 'subscription') {
      const s = visibleSubs.find((x) => x.id === modal.id);
      if (!s) return <Empty title="Subscription unavailable" />;
      const p = planOf(s.planId);
      return (
        <>
          <div className="stage-flow">
            {['Draft', 'Quotation', 'Confirmed', 'Active', 'Closed'].map((t) => (
              <span key={t} className={s.status === t ? 'current' : ''}>
                {t}
              </span>
            ))}
          </div>
          <Customer customer={customerOf(s.customerId)} />
          <div className="detail-grid">
            {[
              ['Plan', `${p.name} · ${p.cycle}`],
              ['Status', s.status],
              ['Product', db.products.find((x) => x.id === s.productId)?.name],
              ['Variant', s.variant || 'Standard'],
              ['Quantity', `${s.quantity} seats`],
              ['Amount per cycle', money(s.unitPrice * s.quantity)],
              ['Starts', dateLabel(s.start)],
              ['Expires', dateLabel(s.expiry)],
              ['Next billing', dateLabel(s.nextBilling)],
              ['Payment terms', `Net ${s.terms} days`],
              ...(s.quoteExpiry ? [['Quote valid until', dateLabel(s.quoteExpiry)]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                {value}
              </div>
            ))}
          </div>
          <div className="notice" style={{ margin: 0 }}>
            Taxes and eligible discounts are calculated when the invoice is generated.
          </div>
          <div className="detail-actions">
            {stageNext[s.status] && !customerRole && (
              <Button primary onClick={() => advance(s)}>
                Move to {stageNext[s.status]}
              </Button>
            )}
            {s.status === 'Active' && p.allowPause && (
              <Button onClick={() => lifecycle(s, 'pause')}>Pause subscription</Button>
            )}
            {s.status === 'Paused' && (
              <Button primary onClick={() => lifecycle(s, 'resume')}>
                Resume subscription
              </Button>
            )}
            {['Active', 'Closed'].includes(s.status) && p.allowRenew && (
              <Button onClick={() => setModal({ type: 'confirmRenew', id: s.id })}>Renew</Button>
            )}
            {!['Closed', 'Draft'].includes(s.status) && p.allowClose && (
              <Button
                className="danger"
                onClick={() => setModal({ type: 'confirmClose', id: s.id })}
              >
                Close subscription
              </Button>
            )}
          </div>
        </>
      );
    }
    if (modal.type === 'confirmRenew') {
      const s = visibleSubs.find((s) => s.id === modal.id);
      return (
        <>
          <p>
            Renew {s.id} for another {planOf(s.planId).cycle.toLowerCase()} cycle? The new term
            starts {dateLabel(s.expiry >= TODAY ? addDays(s.expiry, 1) : TODAY)}. The next invoice
            will be created when that date is due.
          </p>
          <div className="detail-actions">
            <Button primary onClick={() => lifecycle(s, 'renew')}>
              Confirm renewal
            </Button>
          </div>
        </>
      );
    }
    if (modal.type === 'confirmClose') {
      const s = visibleSubs.find((s) => s.id === modal.id);
      return (
        <>
          <p>
            Close {s.id}? Future recurring invoices will stop. Existing invoices and outstanding
            payments stay on your account.
          </p>
          <div className="detail-actions">
            <Button className="danger" onClick={() => lifecycle(s, 'close')}>
              Confirm closure
            </Button>
          </div>
        </>
      );
    }
    if (modal.type === 'invoice') {
      const i = visibleInvoices.find((x) => x.id === modal.id);
      if (!i) return <Empty title="Invoice unavailable" />;
      const customer = customerOf(i.customerId);
      const status = invoiceStatus(db, i);
      return (
        <>
          <div className="invoice-preview">
            <div className="invoice-top">
              <div>
                <div className="eyebrow" style={{ marginBottom: 9 }}>
                  BRIGHTLOOP SOFTWARE
                </div>
                <h1>{i.id}</h1>
                <p>Subscription {i.subscriptionId}</p>
              </div>
              <div>
                <Badge value={status} />
                <p style={{ marginTop: 10 }}>
                  Issued {dateLabel(i.date)}
                  <br />
                  Due {dateLabel(i.due)}
                </p>
              </div>
            </div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              BILL TO
            </p>
            <Customer customer={customer} />
            <Table
              headers={['Description', 'Quantity', 'Unit price', 'Amount']}
              rows={
                <tr>
                  <td>{i.product}</td>
                  <td>{i.quantity}</td>
                  <td>{money(i.unitPrice)}</td>
                  <td>{money(i.subtotal)}</td>
                </tr>
              }
            />
            <div className="invoice-totals">
              <div>
                <span>Subtotal</span>
                <span>{money(i.subtotal)}</span>
              </div>
              <div>
                <span>Discount {i.discountName && `(${i.discountName})`}</span>
                <span>−{money(i.discount)}</span>
              </div>
              <div>
                <span>Tax ({i.taxRate}%)</span>
                <span>{money(i.tax)}</span>
              </div>
              <div className="total">
                <span>Total</span>
                <span>{money(i.total)}</span>
              </div>
              <div>
                <span>Paid</span>
                <span>{money(paidAmount(db, i.id))}</span>
              </div>
              <div>
                <strong>Balance due</strong>
                <strong>{status === 'Cancelled' ? 'Cancelled' : money(balance(db, i))}</strong>
              </div>
            </div>
          </div>
          <div className="detail-actions">
            {status === 'Draft' && !customerRole && (
              <Button primary onClick={() => setInvoiceState(i, 'Confirmed')}>
                Confirm invoice
              </Button>
            )}
            {['Confirmed', 'Overdue'].includes(status) && !customerRole && (
              <Button
                primary
                icon="wallet"
                onClick={() => edit('payment', { ...i, balance: balance(db, i) })}
              >
                Record payment
              </Button>
            )}
            <Button icon="download" onClick={() => window.print()}>
              Print / save PDF
            </Button>
            <Button
              icon="file"
              onClick={() => {
                downloadCsv(`${i.id}.csv`, [
                  ['Invoice', i.id],
                  ['Customer', customer.name],
                  ['Email', customer.email],
                  ['Product', 'Quantity', 'Unit price', 'Subtotal'],
                  [i.product, i.quantity, i.unitPrice, i.subtotal],
                  ['Discount', i.discount],
                  ['Tax', i.tax],
                  ['Total', i.total],
                  ['Balance', balance(db, i)],
                ]);
                notify('Invoice exported.');
              }}
            >
              Export
            </Button>
            {!customerRole && !['Cancelled', 'Paid'].includes(status) && (
              <Button onClick={() => setModal({ type: 'emailPreview', id: i.id })}>
                Email preview
              </Button>
            )}
            {!customerRole &&
              !['Cancelled', 'Paid'].includes(status) &&
              paidAmount(db, i.id) === 0 && (
                <Button className="danger" onClick={() => setInvoiceState(i, 'Cancelled')}>
                  Cancel invoice
                </Button>
              )}
          </div>
        </>
      );
    }
    if (modal.type === 'emailPreview') {
      const i = db.invoices.find((i) => i.id === modal.id);
      return (
        <>
          <div className="notice">Email preview only. Connect an email API to send invoices.</div>
          <p>
            <strong>To:</strong> {customerOf(i.customerId)?.email}
            <br />
            <strong>Subject:</strong> Your Brightloop invoice {i.id}
          </p>
          <p style={{ marginTop: 20 }}>
            Hi {customerOf(i.customerId)?.contact},<br />
            <br />
            Your invoice for {money(i.total)} is ready. Payment is due by {dateLabel(i.due)}.<br />
            <br />
            Thank you for growing with Brightloop.
          </p>
        </>
      );
    }
    if (modal.type === 'notifications')
      return (
        <>
          {overdue.length ? (
            <>
              <p style={{ marginBottom: 15 }}>
                A little attention goes a long way. These invoices are overdue.
              </p>
              {overdue.map((i) => (
                <div className="list-row" key={i.id}>
                  <div>
                    {i.id}
                    <small>
                      {customerOf(i.customerId)?.name} · Due {dateLabel(i.due)}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setModal({ type: 'invoice', id: i.id })}
                  >
                    {money(balance(db, i))} <Icon name="arrow" />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <Empty title="You're all caught up" description="There are no overdue invoices." />
          )}
        </>
      );
    if (modal.type === 'search') {
      const q = modal.query.toLowerCase();
      const subs = visibleSubs.filter((s) =>
        `${s.id} ${customerOf(s.customerId)?.name} ${planOf(s.planId)?.name}`
          .toLowerCase()
          .includes(q),
      );
      const inv = visibleInvoices.filter((i) =>
        `${i.id} ${customerOf(i.customerId)?.name}`.toLowerCase().includes(q),
      );
      return (
        <>
          <p>Results for “{modal.query}”</p>
          {subs.map((s) => (
            <div className="list-row" key={s.id}>
              <div>
                {customerOf(s.customerId)?.name}
                <small>
                  {s.id} · {s.status}
                </small>
              </div>
              <button
                className="text-button"
                onClick={() => setModal({ type: 'subscription', id: s.id })}
              >
                Open <Icon name="arrow" />
              </button>
            </div>
          ))}
          {inv.map((i) => (
            <div className="list-row" key={i.id}>
              <div>
                {i.id}
                <small>{customerOf(i.customerId)?.name}</small>
              </div>
              <button
                className="text-button"
                onClick={() => setModal({ type: 'invoice', id: i.id })}
              >
                {money(i.total)} <Icon name="arrow" />
              </button>
            </div>
          ))}
          {!subs.length && !inv.length && <Empty />}
        </>
      );
    }
    if (modal.type === 'resetData')
      return (
        <>
          <p>
            Replace all changes in this browser with the original sample data? This affects only
            this demo workspace.
          </p>
          <div className="detail-actions">
            <Button
              className="danger"
              onClick={() => {
                setSearch('');
                setFilter('All');
                setPageNumber(1);
                setPortalCustomer('CUS-1001');
                commit(seedData(), 'Sample data restored.');
              }}
            >
              Reset demo data
            </Button>
          </div>
        </>
      );
    return (
      <>
        <div className="intro-banner" style={{ padding: 20 }}>
          <div>
            <h2>Less busywork. More bright ideas.</h2>
            <p>Your subscription business, brought together.</p>
          </div>
          <Icon name="repeat" style={{ width: 35, height: 35 }} />
        </div>
        {[
          ['1. Build your offering', 'Add products, variants, and recurring plans.'],
          [
            '2. Make it official',
            'Create a subscription or use a quotation template. Move through Draft → Quotation → Confirmed → Active.',
          ],
          [
            '3. Keep billing moving',
            'Run recurring billing in Invoices, confirm a draft, then record full or partial payments.',
          ],
          [
            '4. See the bigger picture',
            'Explore revenue, overdue balances, and payments in Reports.',
          ],
        ].map(([title, text]) => (
          <div key={title} style={{ margin: '18px 0' }}>
            <h3 style={{ marginBottom: 6 }}>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
        <div className="notice">
          This frontend uses a fixed reference date of {dateLabel(TODAY)} and saves demo data
          locally. Use the role selector beside your profile to preview staff and customer screens.
        </div>
      </>
    );
  }
}
