export const COLORS = [
  { value: "chestnut", label: "Chestnut", hex: "#986343" },
  { value: "black", label: "Black", hex: "#363933" },
  { value: "burgundy", label: "Burgundy", hex: "#733e49" },
  { value: "tan", label: "Natural tan", hex: "#c49b64" },
];
export const PRESETS = [
  {
    name: "Crossbody strap",
    w: 250,
    h: 25,
    r: 3,
    s: 5,
    kind: "Strap",
    note: "A clean, rounded strap end",
  },
  {
    name: "Wallet panel",
    w: 110,
    h: 90,
    r: 8,
    s: 4,
    kind: "Wallet",
    note: "A compact everyday panel",
  },
  {
    name: "Tote body",
    w: 320,
    h: 360,
    r: 20,
    s: 6,
    kind: "Tote",
    note: "A generous bag body panel",
  },
  {
    name: "Card pocket",
    w: 95,
    h: 65,
    r: 5,
    s: 4,
    kind: "Pocket",
    note: "Sized for an everyday card",
  },
];
export type Draft = {
  name: string;
  material: string;
  width: number;
  height: number;
  radius: number;
  seam: number;
  color: string;
};
const DEFAULT: Draft = {
  name: "Crossbody strap",
  material: "Veg-tan leather",
  width: 250,
  height: 25,
  radius: 3,
  seam: 5,
  color: "chestnut",
};
export const DRAFT_KEY = "lps:draft:v1";
export function initialDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    if (
      d &&
      ["name", "material", "color"].every((k) => typeof d[k] === "string") &&
      ["width", "height", "radius", "seam"].every(
        (k) => typeof d[k] === "number" && Number.isFinite(d[k]),
      )
    )
      return d;
  } catch {
    /* Storage may be disabled. The editor remains usable. */
  }
  return DEFAULT;
}
