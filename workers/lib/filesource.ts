/**
 * Reading uploaded files back out of R2 as rows.
 *
 * CSV files are stream-parsed (constant memory, works for very large files).
 * XLSX files are parsed with SheetJS — loaded lazily so the bundle cost is
 * only paid when an XLSX actually shows up.
 */

import { createCsvState, parseCsvChunk } from "./csv";

export type RowHandler = (row: string[], rowNum: number) => void | Promise<void>;

export interface ReadOptions {
  /** stop after this many data rows (0-based count, excludes header) */
  limit?: number;
  /** skip this many data rows before emitting (for chunked resume) */
  skip?: number;
}

export interface ReadResult {
  headers: string[];
  /** data rows emitted this call */
  emitted: number;
  /** true if the end of the file was reached */
  done: boolean;
}

export async function readRows(
  bucket: R2Bucket,
  r2Key: string,
  format: string,
  onRow: RowHandler,
  opts: ReadOptions = {},
): Promise<ReadResult> {
  const obj = await bucket.get(r2Key);
  if (!obj) throw new Error(`file ${r2Key} not found in storage`);

  if (format === "xlsx") {
    const buf = await obj.arrayBuffer();
    return readXlsxRows(buf, onRow, opts);
  }
  return readCsvRows(obj.body, onRow, opts);
}

async function readCsvRows(
  body: ReadableStream,
  onRow: RowHandler,
  opts: ReadOptions,
): Promise<ReadResult> {
  const limit = opts.limit ?? Infinity;
  const skip = opts.skip ?? 0;
  const decoder = new TextDecoder("utf-8");
  const state = createCsvState();
  const reader = body.getReader();

  let headers: string[] = [];
  let dataRow = 0; // index of next data row
  let emitted = 0;
  let sawHeader = false;
  let done = true;

  const handleRows = async (rows: string[][]): Promise<boolean> => {
    for (const row of rows) {
      if (!sawHeader) {
        headers = row.map((h) => h.replace(/^﻿/, "").trim());
        sawHeader = true;
        continue;
      }
      const idx = dataRow++;
      if (idx < skip) continue;
      if (emitted >= limit) return false;
      await onRow(row, idx + 2); // 1-based line numbers incl. header
      emitted++;
      if (emitted >= limit) return false;
    }
    return true;
  };

  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) {
      await handleRows(parseCsvChunk(state, decoder.decode(), true));
      break;
    }
    const keepGoing = await handleRows(parseCsvChunk(state, decoder.decode(value, { stream: true })));
    if (!keepGoing) {
      done = false;
      await reader.cancel();
      break;
    }
  }
  return { headers, emitted, done };
}

async function readXlsxRows(
  buf: ArrayBuffer,
  onRow: RowHandler,
  opts: ReadOptions,
): Promise<ReadResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  const limit = opts.limit ?? Infinity;
  const skip = opts.skip ?? 0;
  let headers: string[] = [];
  let emitted = 0;
  let done = true;
  let dataRow = 0;

  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] ?? []).map((c) => (c == null ? "" : String(c)));
    if (i === 0) {
      headers = cells.map((h) => h.replace(/^﻿/, "").trim());
      continue;
    }
    if (cells.every((c) => c.trim() === "")) continue;
    const idx = dataRow++;
    if (idx < skip) continue;
    if (emitted >= limit) {
      done = false;
      break;
    }
    await onRow(cells, i + 1);
    emitted++;
  }
  return { headers, emitted, done };
}

/** Read just the header row (fast path for upload-time detection). */
export async function readHeaders(
  bucket: R2Bucket,
  r2Key: string,
  format: string,
): Promise<string[]> {
  const res = await readRows(bucket, r2Key, format, () => {}, { limit: 0 });
  return res.headers;
}
