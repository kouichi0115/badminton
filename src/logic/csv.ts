export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') (cell += '"', i++);
        else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === '\t') (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.map((c) => c.trim()));
}

export function toCSV(rows: (string | number)[][]): string {
  return (
    '﻿' +
    rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? '');
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\r\n')
  );
}

/** UTF-8 で読めなければ Shift_JIS として読む（Excel の CSV 対策） */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

export function download(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
