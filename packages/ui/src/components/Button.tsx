import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./Button.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
}

/**
 * A native `<button>` underneath everything — not a `<div onClick>` — so
 * it is focusable, operable with Space/Enter, and exposed to screen
 * readers as a button for free. `busy` sets `aria-busy` and disables the
 * control without hiding its label, so a screen reader announces "busy"
 * rather than the button silently vanishing mid-action.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      busy = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={rest.type ?? "button"}
        className={["lps-button", `lps-button--${variant}`, className]
          .filter(Boolean)
          .join(" ")}
        aria-busy={busy || undefined}
        disabled={disabled || busy}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
