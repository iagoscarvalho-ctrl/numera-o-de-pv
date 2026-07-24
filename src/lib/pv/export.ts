import type { PV } from "./types";

export function exportPVs(
  pvs: PV[],
  opts: { separator: "," | ";"; header: boolean },
): string {
  const rows: string[] = [];
  if (opts.header) rows.push(["PV", "E", "N", "Z"].join(opts.separator));
  const sorted = [...pvs].sort((a, b) => a.number - b.number);
  for (const pv of sorted) {
    rows.push(
      [pv.label, pv.x.toFixed(3), pv.y.toFixed(3), pv.z.toFixed(2)].join(opts.separator),
    );
  }
  return rows.join("\n");
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}