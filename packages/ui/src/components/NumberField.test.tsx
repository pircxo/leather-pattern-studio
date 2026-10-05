import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { NumberField } from "./NumberField";

describe("NumberField", () => {
  it("exposes an accessible name that includes the unit", () => {
    render(<NumberField label="Width" unit="mm" value={100} onChange={() => {}} />);
    expect(screen.getByRole("spinbutton", { name: "Width (mm)" })).toBeInTheDocument();
  });

  it("calls onChange with a parsed number when the value changes", () => {
    const onChange = vi.fn();
    render(<NumberField label="Width" unit="mm" value={100} onChange={onChange} />);

    const input = screen.getByRole("spinbutton", { name: "Width (mm)" }) as HTMLInputElement;
    // fireEvent avoids userEvent's per-character typing, which on a
    // type="number" input in jsdom can reject intermediate states.
    input.focus();
    input.valueAsNumber = 150;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith(150);
  });

  it("links an error message to the input via aria-describedby and role=alert", () => {
    render(
      <NumberField
        label="Width"
        value={-5}
        onChange={() => {}}
        error="Width must be greater than zero"
      />
    );
    const input = screen.getByRole("spinbutton", { name: "Width" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Width must be greater than zero");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(
      <NumberField label="Seam allowance" unit="mm" value={5} onChange={() => {}} hint="Typical: 4-6mm" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
