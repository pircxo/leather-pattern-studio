import { Field } from "./Field";
import "./Slider.css";

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}

/**
 * A labelled range slider. Deliberately built on a native
 * `<input type="range">` rather than a hand-rolled `role="slider"` div:
 * the native element already gives us Left/Right/Up/Down/Home/End/
 * PageUp/PageDown keyboard support and correct screen-reader value
 * announcements for free, and re-implementing that with `onKeyDown`
 * handlers is a common source of subtly-broken custom widgets. We only
 * add `aria-valuetext` so the unit is announced ("120 millimeters", not
 * just "120"), and a visible numeric readout for sighted users.
 */
export function Slider({ label, value, onChange, min, max, step = 1, unit, hint }: SliderProps) {
  return (
    <Field label={label} hint={hint}>
      {({ inputId, describedBy }) => (
        <div className="lps-slider__row">
          <input
            id={inputId}
            className="lps-slider__input"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-describedby={describedBy}
            aria-valuetext={unit ? `${value} ${unit}` : String(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <output className="lps-slider__value" htmlFor={inputId}>
            {value}
            {unit ? ` ${unit}` : ""}
          </output>
        </div>
      )}
    </Field>
  );
}
