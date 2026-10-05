const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/$/,
  "",
);
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
export type OrderStatus = "received" | "in_production" | "shipped";
export interface OrderOut {
  id: number;
  pattern_name: string;
  pattern_id: number;
  quantity: number;
  customer_note: string | null;
  status: OrderStatus;
  created_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail))
        detail = body.detail.map((e: { msg: string }) => e.msg).join("; ");
      else if (typeof body.error === "string") detail = body.error;
    } catch {
      /* A proxy can return a non-JSON error. */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
export function createPattern(input: PatternCreateInput): Promise<PatternOut> {
  return request("/patterns", { method: "POST", body: JSON.stringify(input) });
}
export function listPatterns(
  offset = 0,
  q = "",
  signal?: AbortSignal,
): Promise<Page<PatternOut>> {
  return request(
    `/patterns?limit=12&offset=${offset}&q=${encodeURIComponent(q)}`,
    { signal },
  );
}
export function getPattern(id: number): Promise<PatternOut> {
  return request(`/patterns/${id}`);
}
export function deletePattern(id: number): Promise<void> {
  return request(`/patterns/${id}`, { method: "DELETE" });
}
export function retryExport(id: number): Promise<PatternOut> {
  return request(`/patterns/${id}/retry-export`, { method: "POST" });
}
export function createOrder(
  patternId: number,
  quantity: number,
  customerNote?: string,
): Promise<OrderOut> {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify({
      pattern_id: patternId,
      quantity,
      customer_note: customerNote,
    }),
  });
}
export function listOrders(
  offset = 0,
  signal?: AbortSignal,
): Promise<Page<OrderOut>> {
  return request(`/orders?limit=12&offset=${offset}`, { signal });
}
export function updateOrder(
  id: number,
  status: OrderStatus,
): Promise<OrderOut> {
  return request(`/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
export function patternSvgUrl(id: number): string {
  return `${API_BASE}/patterns/${id}/export.svg`;
}
export function patternPdfUrl(id: number): string {
  return `${API_BASE}/patterns/${id}/export.pdf`;
}
