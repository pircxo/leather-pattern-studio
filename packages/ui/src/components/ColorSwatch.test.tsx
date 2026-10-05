import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { ColorSwatchGroup } from "./ColorSwatch";

const options = [
  { value: "chestnut", label: "Chestnut", hex: "#7a3b1e" },
  { value: "black", label: "Black", hex: "#1a1a1a" },
  { value: "burgundy", label: "Burgundy", hex: "#5c1f2e" },
];

describe("ColorSwatchGroup", () => {
  it("renders as a native radio group, reachable by role and label", () => {
    render(
      <ColorSwatchGroup
        legend="Leather colour"
        options={options}
        value="chestnut"
        onChange={() => {}}
      />,
    );
    const group = screen.getByRole("group", { name: "Leather colour" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Chestnut" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Black" })).not.toBeChecked();
  });

  it("calls onChange with the new value when a swatch is chosen (mouse or keyboard)", async () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchGroup
        legend="Leather colour"
        options={options}
        value="chestnut"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Burgundy" }));
    expect(onChange).toHaveBeenCalledWith("burgundy");
  });

  it("supports arrow-key navigation between swatches, for free, via native radio semantics", async () => {
    const onChange = vi.fn();
    render(
      <ColorSwatchGroup
        legend="Leather colour"
        options={options}
        value="chestnut"
        onChange={onChange}
      />,
    );

    screen.getByRole("radio", { name: "Chestnut" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("black");
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(
      <ColorSwatchGroup
        legend="Leather colour"
        options={options}
        value="chestnut"
        onChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
