import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a native button and responds to a click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save pattern</Button>);

    const button = screen.getByRole("button", { name: "Save pattern" });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and marked aria-busy while busy, but keeps its label", () => {
    render(<Button busy>Save pattern</Button>);

    const button = screen.getByRole("button", { name: "Save pattern" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
