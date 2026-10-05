import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import * as client from "./api/client";

vi.mock("./api/client", async () => {
  const actual = await vi.importActual<typeof client>("./api/client");
  return {
    ...actual,
    listPatterns: vi.fn(),
    createPattern: vi.fn(),
  };
});

const mockedListPatterns = client.listPatterns as unknown as ReturnType<typeof vi.fn>;
const mockedCreatePattern = client.createPattern as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedListPatterns.mockReset().mockResolvedValue({ items: [], total: 0 });
  mockedCreatePattern.mockReset();
});

describe("App", () => {
  it("renders the editor with a live preview reflecting the default dimensions", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Leather Pattern Studio" })).toBeInTheDocument();
    expect(await screen.findByText(/250×25mm finished/)).toBeInTheDocument();
  });

  it("shows an empty state, then a saved pattern after a successful save", async () => {
    mockedCreatePattern.mockResolvedValue({
      id: 7,
      name: "Crossbody strap",
      export_status: "ready",
    });
    mockedListPatterns
      .mockResolvedValueOnce({ items: [], total: 0 }) // initial load
      .mockResolvedValueOnce({
        items: [
          {
            id: 7,
            name: "Crossbody strap",
            finished_width_mm: 250,
            finished_height_mm: 25,
            export_status: "ready",
          },
        ],
        total: 1,
      }); // after save

    render(<App />);
    expect(await screen.findByText(/No patterns saved yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save pattern/i }));

    await waitFor(() => expect(mockedCreatePattern).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Saved "Crossbody strap" \(#7\)\./)).toBeInTheDocument();
    expect(screen.getByText(/#7 Crossbody strap/)).toBeInTheDocument();
  });

  it("surfaces an API error instead of failing silently", async () => {
    mockedCreatePattern.mockRejectedValue(new client.ApiError(422, "name cannot be blank"));

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /save pattern/i }));

    expect(await screen.findByText("name cannot be blank")).toBeInTheDocument();
  });
});
