import { useId, type ReactNode } from "react";
import "./Field.css";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Render prop so Field owns id/aria wiring but never the input's type. */
  children: (ids: {
    inputId: string;
    describedBy: string | undefined;
  }) => ReactNode;
}

/**
 * Wraps a single form control with a visible `<label>`, optional hint
 * text, and optional error text — wiring `aria-describedby` correctly so
 * assistive tech announces the hint/error alongside the label, which is
 * easy to get subtly wrong by hand on every field individually.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const inputId = useId();
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="lps-field" data-invalid={Boolean(error) || undefined}>
      <label className="lps-field__label" htmlFor={inputId}>
        {label}
      </label>
      {children({ inputId, describedBy })}
      {hint && (
        <p className="lps-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="lps-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
