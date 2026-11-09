import { Donation } from './summary';

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * Donations kept outside Actual: history from before Actual, payroll giving, DAF
 * grants. Columns: date,amount,recipient,note[,ea]. `date` may be a bare year (2023)
 * for a yearly total. `amount` is positive for a gift; a negative row is a refund.
 */
export function parseDonationsCsv(text: string): Donation[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iDate = col('date');
  const iAmount = col('amount');
  if (iDate < 0 || iAmount < 0) throw new Error('donations.csv: header must include date and amount');
  const iRecipient = col('recipient');
  const iNote = col('note');
  const iEa = col('ea');

  return rows.slice(1).map((r, n) => {
    const line = n + 2;
    const date = (r[iDate] ?? '').trim();
    if (!/^\d{4}(-\d{2}-\d{2})?$/.test(date)) throw new Error(`donations.csv line ${line}: bad date "${date}"`);
    const amount = Number((r[iAmount] ?? '').replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount)) throw new Error(`donations.csv line ${line}: bad amount "${r[iAmount]}"`);
    const eaRaw = iEa >= 0 ? (r[iEa] ?? '').trim().toLowerCase() : '';
    if (eaRaw && !['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(eaRaw)) throw new Error(`donations.csv line ${line}: ea must be true/false, got "${r[iEa]}"`);
    return {
      ea: eaRaw ? ['true', 'yes', '1', 'y'].includes(eaRaw) : true,
      date,
      year: Number(date.slice(0, 4)),
      amount,
      recipient: (iRecipient >= 0 ? r[iRecipient]?.trim() : '') || 'Unattributed',
      note: iNote >= 0 ? r[iNote]?.trim() || undefined : undefined,
      source: 'csv' as const,
    };
  });
}
