import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Slider } from "./Slider";

describe("Slider", () => {
  it("is a native range input with an aria-valuetext including the unit", () => {
    render(<Slider label="Corner radius" value={10} min={0} max={50} unit="mm" onChange={() => {}} />);
    const slider = screen.getByRole("slider", { name: "Corner radius" });
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("aria-valuetext", "10 mm");
  });

  it("calls onChange when the value changes", () => {
    const onChange = vi.fn();
    render(<Slider label="Corner radius" value={10} min={0} max={50} onChange={onChange} />);

    const slider = screen.getByRole("slider", { name: "Corner radius" });
    // `fireEvent.change` goes through Testing Library's native-setter
    // bypass so React's change-tracking sees a real value transition —
    // setting `.value` and dispatching a raw Event does not.
    fireEvent.change(slider, { target: { value: "20" } });

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("shows the current value and unit as visible text for sighted users", () => {
    render(<Slider label="Width" value={120} min={0} max={500} unit="mm" onChange={() => {}} />);
    expect(screen.getByText("120 mm")).toBeInTheDocument();
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(
      <Slider label="Width" value={120} min={0} max={500} unit="mm" onChange={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
