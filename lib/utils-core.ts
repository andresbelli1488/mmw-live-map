export const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/["'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const nowIso = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
export const dedupe = <T,>(items: T[]) => [...new Set(items)];

export function titleCaseArea(input?: string) {
  if (!input) return "Miami";
  return input
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
