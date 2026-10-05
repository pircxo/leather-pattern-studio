import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import * as client from "./api/client";
vi.mock("./api/client", async () => ({
  ...(await vi.importActual<typeof client>("./api/client")),
  listPatterns: vi.fn(),
  createPattern: vi.fn(),
  listOrders: vi.fn(),
  getPattern: vi.fn(),
  deletePattern: vi.fn(),
  retryExport: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
}));
const pattern: client.PatternOut = {
  id: 7,
  name: "Crossbody strap",
  material: "Veg-tan leather",
  finished_width_mm: 250,
  finished_height_mm: 25,
  corner_radius_mm: 3,
  seam_allowance_mm: 5,
  cut_width_mm: 260,
  cut_height_mm: 35,
  finished_area_cm2: 62.42,
  finished_perimeter_cm: 54.48,
  stitch_guide_path: "M 5,5 H 255 V 30 H 5 Z",
  cut_outline_path: "M 0,0 H 260 V 35 H 0 Z",
  export_status: "ready",
  svg_export_path: "file.svg",
  pdf_export_path: "file.pdf",
  export_error: null,
  created_at: "2026-10-05T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.mocked(client.listPatterns).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(client.listOrders).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(client.createPattern).mockResolvedValue(pattern);
  vi.stubGlobal("scrollTo", vi.fn());
});
describe("App", () => {
  it("renders a live preview and switches presets", async () => {
    render(<App />);
    expect(await screen.findByText(/250×25mm finished/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Wallet" }));
    expect(screen.getByText(/110×90mm finished/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Pattern name" })).toHaveValue(
      "Wallet panel",
    );
  });
  it("saves, offers exports and lists the pattern", async () => {
    render(<App />);
    await waitFor(() => expect(client.listPatterns).toHaveBeenCalled());
    vi.mocked(client.listPatterns).mockResolvedValue({
      items: [pattern],
      total: 1,
    });
    await userEvent.click(
      screen.getByRole("button", { name: /save pattern/i }),
    );
    expect(
      await screen.findByText('Saved "Crossbody strap" (#7).'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download PDF for Crossbody strap" }),
    ).toHaveAttribute("href", "/api/v1/patterns/7/export.pdf");
    await userEvent.click(
      screen.getByRole("button", { name: /pattern library/i }),
    );
    expect(
      await screen.findByRole("heading", { name: "Crossbody strap" }),
    ).toBeInTheDocument();
  });
  it("disables saving blank names and invalid dimensions", async () => {
    render(<App />);
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Pattern name" }),
    );
    expect(
      screen.getByRole("button", { name: /save pattern/i }),
    ).toBeDisabled();
    await userEvent.clear(
      screen.getByRole("spinbutton", { name: "Finished width (mm)" }),
    );
    expect(
      screen.getByRole("heading", { name: "Check your dimensions" }),
    ).toBeInTheDocument();
    expect(client.createPattern).not.toHaveBeenCalled();
  });
  it("shows useful errors for saving and loading", async () => {
    vi.mocked(client.createPattern).mockRejectedValue(
      new client.ApiError(422, "name cannot be blank"),
    );
    vi.mocked(client.listPatterns).mockRejectedValue(new Error("offline"));
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: /save pattern/i }),
    );
    expect(await screen.findByText("name cannot be blank")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /pattern library/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "The library couldn’t load.",
      }),
    ).toBeInTheDocument();
  });
  it("reopens a pattern and saves changes separately", async () => {
    vi.mocked(client.listPatterns).mockResolvedValue({
      items: [pattern],
      total: 1,
    });
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: /pattern library/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(
      screen.getByRole("button", { name: "Save as new pattern" }),
    ).toBeInTheDocument();
    await userEvent.clear(
      screen.getByRole("spinbutton", { name: "Finished width (mm)" }),
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Finished width (mm)" }),
      "300",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save pattern" }));
    expect(client.createPattern).toHaveBeenCalledWith(
      expect.objectContaining({ finished_width_mm: 300 }),
    );
  });
  it("requires confirmation before deleting", async () => {
    vi.mocked(client.listPatterns).mockResolvedValue({
      items: [pattern],
      total: 1,
    });
    vi.mocked(client.deletePattern).mockResolvedValue();
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: /pattern library/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete Crossbody strap" }),
    );
    expect(client.deletePattern).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm delete" }),
    );
    expect(client.deletePattern).toHaveBeenCalledWith(7);
  });
  it("recovers the last draft after remount", async () => {
    const { unmount } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Tote" }));
    unmount();
    render(<App />);
    expect(screen.getByRole("textbox", { name: "Pattern name" })).toHaveValue(
      "Tote body",
    );
    expect(screen.getByText(/320×360mm finished/)).toBeInTheDocument();
  });
  it("automatically offers downloads when a queued export finishes", async () => {
    vi.mocked(client.createPattern).mockResolvedValue({
      ...pattern,
      export_status: "pending",
    });
    vi.mocked(client.getPattern).mockResolvedValue(pattern);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Save pattern" }));
    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(
      await screen.findByRole(
        "link",
        { name: "Download PDF for Crossbody strap" },
        { timeout: 3500 },
      ),
    ).toBeInTheDocument();
    expect(client.getPattern).toHaveBeenCalledWith(7);
  });
});
