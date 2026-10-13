// The eight colours collections and tags can have. The database stores the key
// (see the add_palette_colors migration); the classes are written out in full so
// Tailwind can see them. Light mode pairs a 100 background with 800 text (about
// 7:1 contrast); dark mode uses a dark tint with 200 text. Dots and folders use
// the 500/600 shades. Note: amber, green and teal 500 dots are below 3:1 on white
// (about 2.1 to 2.5:1); the tag or collection name always sits next to the dot, so
// colour is never the only cue, but a darker shade would be needed to meet 1.4.11.

export const PALETTE_KEYS = [
  "slate",
  "red",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

type PaletteEntry = {
  label: string;
  /** Small filled dot. */
  dot: string;
  /** Folder icon colour. */
  folder: string;
  /** Soft badge: background and readable text. */
  badge: string;
};

export const PALETTE: Record<PaletteKey, PaletteEntry> = {
  slate: {
    label: "Slate",
    dot: "bg-slate-500",
    folder: "text-slate-600 dark:text-slate-400",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  },
  red: {
    label: "Red",
    dot: "bg-red-500",
    folder: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  amber: {
    label: "Amber",
    dot: "bg-amber-500",
    folder: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  green: {
    label: "Green",
    dot: "bg-green-500",
    folder: "text-green-600 dark:text-green-400",
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  },
  teal: {
    label: "Teal",
    dot: "bg-teal-500",
    folder: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  },
  blue: {
    label: "Blue",
    dot: "bg-blue-500",
    folder: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  violet: {
    label: "Violet",
    dot: "bg-violet-500",
    folder: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
  pink: {
    label: "Pink",
    dot: "bg-pink-500",
    folder: "text-pink-600 dark:text-pink-400",
    badge: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
  },
};

export function isPaletteKey(value: unknown): value is PaletteKey {
  return typeof value === "string" && (PALETTE_KEYS as readonly string[]).includes(value);
}

/** Unknown or missing values fall back to slate, so a bad row cannot break rendering. */
export function toPaletteKey(value: unknown): PaletteKey {
  return isPaletteKey(value) ? value : "slate";
}

/** The least-used colour among `used` (ties go to palette order, skipping slate first). */
export function nextColor(used: readonly PaletteKey[]): PaletteKey {
  const counts = new Map<PaletteKey, number>(PALETTE_KEYS.map((key) => [key, 0]));
  for (const key of used) counts.set(key, (counts.get(key) ?? 0) + 1);
  const order = [...PALETTE_KEYS.slice(1), PALETTE_KEYS[0]]; // slate is the neutral fallback: last
  return order.reduce((best, key) => (counts.get(key)! < counts.get(best)! ? key : best), order[0]);
}
