/**
 * CSV for Excel and email tools: every field quoted, a BOM so Excel reads č/ć/š/ž correctly, and
 * values starting with = + - @ get a leading ' so a spreadsheet never runs them as formulas.
 */
function csvField(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]) {
  return `﻿${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}
