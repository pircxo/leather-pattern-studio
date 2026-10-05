import { useId } from "react";
import "./ColorSwatch.css";

export interface ColorOption {
  value: string;
  label: string;
  hex: string;
}

export interface ColorSwatchGroupProps {
  legend: string;
  options: ColorOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * A group of colour swatches that is, under the hood, a plain native
 * `<input type="radio">` group — each swatch is a `<label>` wrapping a
 * visually-hidden radio input. That is a deliberate choice over a
 * hand-built `role="radiogroup"`/`role="radio"` widget with custom arrow
 * key handling: native radio inputs already give correct roving focus,
 * arrow-key navigation, and screen-reader semantics, so styling around
 * them is both less code and more robust than reimplementing the ARIA
 * radio pattern by hand.
 */
export function ColorSwatchGroup({
  legend,
  options,
  value,
  onChange,
}: ColorSwatchGroupProps) {
  const groupName = useId();

  return (
    <fieldset className="lps-swatches">
      <legend className="lps-swatches__legend">{legend}</legend>
      <div className="lps-swatches__row">
        {options.map((opt) => (
          <label key={opt.value} className="lps-swatches__item">
            <input
              type="radio"
              name={groupName}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="lps-swatches__input"
            />
            <span
              className="lps-swatches__swatch"
              style={{ backgroundColor: opt.hex }}
              aria-hidden="true"
            />
            <span className="lps-swatches__label">{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
