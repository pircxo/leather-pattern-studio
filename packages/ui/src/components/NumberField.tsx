import { Field } from "./Field";
import "./NumberField.css";

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  error?: string;
}

/**
 * A labelled numeric input with an optional unit suffix ("mm", "cm"...).
 * Uses a native `<input type="number">` so mobile browsers show a numeric
 * keypad and the browser's own increment/decrement and validation
 * semantics (min/max/step, `inputmode`) keep working — we only add the
 * label wiring and unit display on top, not reimplement number parsing.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  hint,
  error,
}: NumberFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <div className="lps-number-field__row">
          <input
            id={inputId}
            className="lps-number-field__input"
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            // The unit suffix next to the input is `aria-hidden` (purely
            // visual) — folding it into the accessible name here instead
            // means a screen reader says "Width (mm)" once, not the label
            // and then the unit text read twice from two places.
            aria-label={unit ? `${label} (${unit})` : undefined}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error) || undefined}
            onChange={(e) => {
              const next = e.target.valueAsNumber;
              onChange(Number.isNaN(next) ? 0 : next);
            }}
          />
          {unit && (
            <span className="lps-number-field__unit" aria-hidden="true">
              {unit}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
