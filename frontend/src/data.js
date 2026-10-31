export const STORAGE_KEY = 'brightloop-react-v1';
export function seedData() {
  const customers = [
    {
      id: 'CUS-1001',
      name: 'Acme Studio',
      email: 'hello@acmestudio.example',
      contact: 'Alex Morgan',
      color: '#ecebdc',
    },
    {
      id: 'CUS-1002',
      name: 'Layers',
      email: 'finance@layers.example',
      contact: 'Jamie Chen',
      color: '#e6e9f1',
    },
    {
      id: 'CUS-1003',
      name: 'Sisyphus',
      email: 'accounts@sisyphus.example',
      contact: 'Sam Wilson',
      color: '#f1e4dc',
    },
    {
      id: 'CUS-1004',
      name: 'Catalog',
      email: 'hello@catalog.example',
      contact: 'Taylor Reed',
      color: '#e5ecdb',
    },
    {
      id: 'CUS-1005',
      name: 'Quotient',
      email: 'billing@quotient.example',
      contact: 'Casey Patel',
      color: '#ede4f0',
    },
    {
      id: 'CUS-1006',
      name: 'Circooles',
      email: 'team@circooles.example',
      contact: 'Jordan Lee',
      color: '#e0ece9',
    },
    {
      id: 'CUS-1007',
      name: 'Orbit & Co.',
      email: 'hello@orbit.example',
      contact: 'Avery Shah',
      color: '#e5e8da',
    },
    {
      id: 'CUS-1008',
      name: 'Northstar',
      email: 'finance@northstar.example',
      contact: 'Riley Jones',
      color: '#f2e8dd',
    },
  ];
  const products = [
    {
      id: 'PRD-1001',
      name: 'Workspace Suite',
      type: 'Software',
      price: 1499,
      cost: 350,
      notes: 'One connected space for projects, people, and everyday work.',
      variant: 'Odoo',
      variantPrice: 560,
    },
    {
      id: 'PRD-1002',
      name: 'Analytics Pro',
      type: 'Software',
      price: 2499,
      cost: 600,
      notes: 'Turn your business data into clear, actionable insights.',
      variant: 'Advanced',
      variantPrice: 400,
    },
    {
      id: 'PRD-1003',
      name: 'Cloud Storage',
      type: 'Add-on',
      price: 499,
      cost: 100,
      notes: 'Secure, shared storage that grows alongside your team.',
      variant: '2 TB',
      variantPrice: 200,
    },
  ];
  const plans = [
    {
      id: 'PLN-1001',
      name: 'Starter',
      productId: 'PRD-1001',
      price: 1499,
      cycle: 'Monthly',
      minQuantity: 1,
      start: '2026-01-01',
      end: '2027-12-31',
      autoClose: true,
      allowPause: true,
      allowClose: true,
      allowRenew: true,
    },
    {
      id: 'PLN-1002',
      name: 'Professional',
      productId: 'PRD-1002',
      price: 2499,
      cycle: 'Monthly',
      minQuantity: 1,
      start: '2026-01-01',
      end: '2027-12-31',
      autoClose: true,
      allowPause: true,
      allowClose: true,
      allowRenew: true,
    },
    {
      id: 'PLN-1003',
      name: 'Business Annual',
      productId: 'PRD-1001',
      price: 14990,
      cycle: 'Yearly',
      minQuantity: 5,
      start: '2026-01-01',
      end: '2027-12-31',
      autoClose: true,
      allowPause: false,
      allowClose: false,
      allowRenew: true,
    },
  ];
  const statuses = [
    'Active',
    'Active',
    'Active',
    'Active',
    'Paused',
    'Quotation',
    'Active',
    'Draft',
  ];
  const subscriptions = customers.map((c, i) => ({
    id: `SUB-${1041 + i}`,
    customerId: c.id,
    planId: plans[i % 3].id,
    productId: plans[i % 3].productId,
    quantity: i % 3 === 2 ? 5 : (i % 2) + 1,
    unitPrice: plans[i % 3].price,
    variant: '',
    start: i % 3 === 2 ? '2026-06-01' : '2026-05-01',
    expiry: '2027-05-31',
    nextBilling: i % 3 === 2 ? '2027-06-01' : i === 1 ? '2026-10-01' : '2026-11-01',
    terms: 14,
    status: statuses[i],
  }));
  const invoices = [];
  const payments = [];
  for (let month = 5; month <= 10; month++) {
    subscriptions
      .filter((s) => s.status === 'Active')
      .forEach((s, i) => {
        // Annual contracts bill once per year.
        if (plans.find((p) => p.id === s.planId).cycle === 'Yearly' && month !== 6) return;
        if (month === 10 && i === 1) return; // One due subscription for the recurring-billing demo.
        const subtotal = s.quantity * s.unitPrice;
        const tax = Math.round(subtotal * 18) / 100;
        const date = `2026-${String(month).padStart(2, '0')}-01`;
        const invoice = {
          id: `INV-${1080 + invoices.length}`,
          subscriptionId: s.id,
          customerId: s.customerId,
          date,
          due: `2026-${String(month).padStart(2, '0')}-15`,
          period: date,
          status: 'Confirmed',
          product: products.find((p) => p.id === s.productId).name,
          quantity: s.quantity,
          unitPrice: s.unitPrice,
          subtotal,
          discount: 0,
          taxRate: 18,
          tax,
          total: Math.round((subtotal + tax) * 100) / 100,
          discountName: '',
        };
        invoices.push(invoice);
        if (month < 10 || i === 0)
          payments.push({
            id: `PAY-${1001 + payments.length}`,
            invoiceId: invoice.id,
            amount: invoice.total,
            date: `2026-${String(month).padStart(2, '0')}-10`,
            method: i % 2 ? 'UPI' : 'Bank transfer',
            note: 'Monthly subscription payment',
          });
      });
  }
  return {
    version: 1,
    customers,
    products,
    plans,
    subscriptions,
    invoices,
    payments,
    taxRate: 18,
    discounts: [
      {
        id: 'DSC-1001',
        name: 'GROWTOGETHER',
        type: 'Percentage',
        value: 10,
        minQuantity: 5,
        minPurchase: 0,
        start: '2026-10-01',
        end: '2026-12-31',
        limit: 100,
        used: 0,
        scope: 'all',
        enabled: true,
      },
    ],
    templates: [
      {
        id: 'TPL-1001',
        name: 'Team starter offer',
        planId: 'PLN-1001',
        quantity: 5,
        validDays: 30,
      },
      {
        id: 'TPL-1002',
        name: 'Annual business offer',
        planId: 'PLN-1003',
        quantity: 10,
        validDays: 14,
      },
    ],
    staff: [
      { id: 'STA-1001', name: 'Olivia Rhye', email: 'olivia@brightloop.example', role: 'Admin' },
      { id: 'STA-1002', name: 'Drew Cano', email: 'drew@brightloop.example', role: 'Staff' },
    ],
    accounts: [],
    activity: [],
  };
}
export function readData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data?.version === 1 && Array.isArray(data.subscriptions) && Array.isArray(data.invoices))
      return data;
  } catch {
    /* A fresh demo still works when storage is unavailable. */
  }
  return seedData();
}
