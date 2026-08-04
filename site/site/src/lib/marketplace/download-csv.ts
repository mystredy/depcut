// Client-side CSV export for admin finance tables — turns whatever rows are
// currently loaded into a downloaded file, no server round-trip.
export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;

  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((row) =>
      keys.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
