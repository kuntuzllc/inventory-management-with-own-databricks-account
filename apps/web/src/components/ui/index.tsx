import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react';

import { useToast } from '../../contexts/ToastContext';

export function Button({
  children,
  className,
  variant = 'primary',
  loading,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={['button', `button--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
    >
      {loading ? 'Working...' : children}
    </button>
  );
}

export function Input({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input {...props} className={['field__control', className].filter(Boolean).join(' ')} />
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export function Select({
  label,
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select {...props} className={['field__control', className].filter(Boolean).join(' ')}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextArea({
  label,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        {...props}
        className={['field__control field__control--textarea', className]
          .filter(Boolean)
          .join(' ')}
      />
    </label>
  );
}

export function Card({
  title,
  description,
  children,
  actions
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card">
      {title || actions ? (
        <header className="card__header">
          <div>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {description ? <p className="card__description">{description}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function LoadingState({
  label = 'Loading...',
  fullscreen = false
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div className={fullscreen ? 'loading-screen' : 'loading-inline'}>
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actions
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__header">
          <h3>{title}</h3>
          <Button variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Table({
  columns,
  children
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-shell">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StatCard({
  label,
  value,
  helpText,
  accent
}: {
  label: string;
  value: ReactNode;
  helpText?: string;
  accent?: string;
}) {
  return (
    <article className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value" style={accent ? { color: accent } : undefined}>
        {value}
      </strong>
      {helpText ? <span className="stat-card__help">{helpText}</span> : null}
    </article>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast--${toast.variant}`}>
          <div>
            <strong>{toast.title}</strong>
            {toast.description ? <p>{toast.description}</p> : null}
          </div>
          <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)}>
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
