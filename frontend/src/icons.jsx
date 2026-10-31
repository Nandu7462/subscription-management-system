export function Icon({ name, size = 20, ...props }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    subscriptions: <><path d="M20 7a9 9 0 0 0-15-1L2 9m0-6v6h6M4 17a9 9 0 0 0 15 1l3-3m0 6v-6h-6"/></>,
    invoices: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></>,
    payments: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h3"/></>,
    customers: <><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 4a4 4 0 0 1 0 8M22 21v-2a7 7 0 0 0-4-6"/></>,
    products: <><path d="m12 2 10 5v10l-10 5-10-5V7zM2 7l10 5 10-5M12 12v10M7 4.5l10 5"/></>,
    plans: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
    taxes: <><path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></>,
    discounts: <><path d="m3 3 9 0 9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/></>,
    quotations: <><path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h5"/></>,
    users: <><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    logout: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
    refresh: <><path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.plans}</svg>
}

export function Brand() {
  return <span className="brand"><svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="currentColor"/><g fill="none" stroke="#c9ed9b" strokeWidth="3.5"><circle cx="16" cy="17" r="8"/><circle cx="24" cy="24" r="8"/></g></svg>brightloop<span className="brand-dot">.</span></span>
}
