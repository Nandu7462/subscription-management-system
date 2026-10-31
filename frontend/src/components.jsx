import React, { useEffect, useRef } from 'react';

const paths = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  repeat: (
    <>
      <path d="M3 10a9 9 0 0 1 15-6l3 3M21 3v4h-4M21 14A9 9 0 0 1 6 20l-3-3M3 21v-4h4" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H5v20h14V7l-5-5ZM14 2v6h5M8 12h8M8 16h6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 8V5l14-3v3M21 11h-6v5h6M17 13.5h.01" />
    </>
  ),
  tag: (
    <>
      <path d="m3 3 8 0 11 11-8 8L3 11V3Z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 15v-4M13 15V6M18 15V9" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3-1 3-3 1-3 3 2 2-1 4 3 3 4-1 2 3 4-1 1-4 3-2-1-4-3-1-1-3-6-1Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10ZM10 22h4" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6M17 2v6M3 11h18" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-10M15 5h6v6" />
    </>
  ),
  logout: <path d="M9 3H3v18h6M9 12h12m-5-5 5 5-5 5" />,
};
export function Icon({ name, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
export function Button({ children, icon, primary = false, className = '', ...props }) {
  return (
    <button className={`button ${primary ? 'primary' : ''} ${className}`} {...props}>
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
export function Badge({ value }) {
  return <span className={`badge ${value.toLowerCase()}`}>{value}</span>;
}
export function Customer({ customer, subtext }) {
  return (
    <div className="customer-cell">
      <span className="avatar" style={{ background: customer?.color }}>
        {customer?.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')}
      </span>
      <div>
        <strong>{customer?.name || 'Unknown customer'}</strong>
        <small>{subtext || customer?.email}</small>
      </div>
    </div>
  );
}
export function Field({ label, children, full = false, hint }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const cancel = (e) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener('cancel', cancel);
    return () => {
      el.removeEventListener('cancel', cancel);
      el.close();
    };
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </dialog>
  );
}
export function Empty({
  title = 'No results found',
  description = 'Try another search or change your filters.',
  children,
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Metric({ label, value, icon, note, highlight, attention }) {
  return (
    <div className={`metric ${attention ? 'attention' : ''}`}>
      <div className="metric-label">
        {label}
        <Icon name={icon} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-footer">
        <strong>{highlight}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}
export function Table({ headers, rows, empty }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {!React.Children.count(rows) && (empty || <Empty />)}
    </div>
  );
}
