/**
 * Small, dependency-free CSV utilities.
 *
 * `parseCsvChunk` is incremental: feed it text chunks (e.g. from a streamed
 * R2 body) and it emits complete rows, keeping any trailing partial record
 * as carry-over state. Handles quoted fields, escaped quotes, embedded
 * newlines and CRLF.
 */

export interface CsvParserState {
  /** unconsumed tail of the input (partial record) */
  carry: string;
}

export function createCsvState(): CsvParserState {
  return { carry: "" };
}

/**
 * Parse as many complete records as possible from state.carry + chunk.
 * Leaves the trailing incomplete record (if any) in state.carry.
 * Pass `flush=true` for the final call to emit the last record.
 */
export function parseCsvChunk(
  state: CsvParserState,
  chunk: string,
  flush = false,
): string[][] {
  const text = state.carry + chunk;
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  let lastRecordEnd = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      // swallow \r\n pairs
      if (ch === "\r" && text[i + 1] === "\n") i++;
      i++;
      // skip completely empty records
      if (row.length > 1 || row[0].trim() !== "") rows.push(row);
      row = [];
      lastRecordEnd = i;
      continue;
    }
    field += ch;
    i++;
  }

  if (flush) {
    row.push(field);
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    state.carry = "";
  } else {
    state.carry = text.slice(lastRecordEnd);
  }
  return rows;
}

/** One-shot parse for small inputs (previews, tests). */
export function parseCsv(text: string): string[][] {
  const state = createCsvState();
  return parseCsvChunk(state, text, true);
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}
