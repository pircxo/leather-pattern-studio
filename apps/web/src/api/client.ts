/**
 * Thin REST client for apps/api. Centralising the fetch calls here (vs.
 * calling `fetch` inline in components) means there is exactly one place
 * that knows the API's URL shape, error shape, and base path — see
 * `docs/API.md` for the contract this client assumes.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export type ExportStatus = "pending" | "processing" | "ready" | "failed";

export interface PatternOut {
  id: number;
  name: string;
  material: string;
  finished_width_mm: number;
  finished_height_mm: number;
  corner_radius_mm: number;
  seam_allowance_mm: number;
  cut_width_mm: number;
  cut_height_mm: number;
  finished_area_cm2: number;
  finished_perimeter_cm: number;
  stitch_guide_path: string;
  cut_outline_path: string;
  export_status: ExportStatus;
  svg_export_path: string | null;
  pdf_export_path: string | null;
  export_error: string | null;
  created_at: string;
}

export interface PatternCreateInput {
  name: string;
  material?: string;
  finished_width_mm: number;
  finished_height_mm: number;
  corner_radius_mm?: number;
  seam_allowance_mm?: number;
}

export interface OrderOut {
  id: number;
  pattern_id: number;
  quantity: number;
  customer_note: string | null;
  status: string;
  created_at: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.error ?? detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function createPattern(input: PatternCreateInput): Promise<PatternOut> {
  return request<PatternOut>("/patterns", { method: "POST", body: JSON.stringify(input) });
}

export function listPatterns(): Promise<{ items: PatternOut[]; total: number }> {
  return request("/patterns");
}

export function getPattern(id: number): Promise<PatternOut> {
  return request(`/patterns/${id}`);
}

export function createOrder(
  patternId: number,
  quantity: number,
  customerNote?: string
): Promise<OrderOut> {
  return request<OrderOut>("/orders", {
    method: "POST",
    body: JSON.stringify({ pattern_id: patternId, quantity, customer_note: customerNote }),
  });
}

export function patternSvgUrl(id: number): string {
  return `${API_BASE}/patterns/${id}/export.svg`;
}

export function patternPdfUrl(id: number): string {
  return `${API_BASE}/patterns/${id}/export.pdf`;
}
