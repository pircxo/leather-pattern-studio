import { afterEach, expect, it, vi } from "vitest";
import { createPattern, deletePattern, listPatterns } from "./client";
afterEach(() => {
  vi.unstubAllGlobals();
});
it("handles structured validation messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: "Invalid width" }] }), {
        status: 422,
      }),
    ),
  );
  await expect(
    createPattern({ name: "x", finished_width_mm: 0, finished_height_mm: 1 }),
  ).rejects.toThrow("Invalid width");
});
it("accepts an empty 204 response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
  await expect(deletePattern(1)).resolves.toBeUndefined();
});
it("encodes search without changing query structure", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })));
  vi.stubGlobal("fetch", fetchMock);
  await listPatterns(12, "a&offset=100");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/patterns?limit=12&offset=12&q=a%26offset%3D100",
    expect.anything(),
  );
});
