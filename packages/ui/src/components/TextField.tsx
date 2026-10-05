import { Field } from "./Field";
import "./NumberField.css";

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  maxLength?: number;
}

/** A labelled single-line text input. Shares styling with NumberField but
 * keeps its own component since the two will keep diverging (e.g. this
 * one gains a character counter before NumberField ever would). */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  maxLength,
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          className="lps-number-field__input"
          style={{ width: "100%" }}
          type="text"
          value={value}
          maxLength={maxLength}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
