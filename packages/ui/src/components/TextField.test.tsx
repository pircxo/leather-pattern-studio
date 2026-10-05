import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("renders a labelled text input and reports changes", () => {
    const onChange = vi.fn();
    render(<TextField label="Pattern name" value="" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Pattern name" });
    fireEvent.change(input, { target: { value: "Crossbody strap" } });

    expect(onChange).toHaveBeenCalledWith("Crossbody strap");
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(
      <TextField
        label="Pattern name"
        value="Wallet panel"
        onChange={() => {}}
        hint="Shown on exports"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
