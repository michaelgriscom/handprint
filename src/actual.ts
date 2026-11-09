import * as fs from 'fs';
import * as api from '@actual-app/api';
import { MatchRule, PledgeConfig, RecipientRule } from './config';
import { Donation } from './summary';

export interface ActualEnv {
  serverUrl: string;
  password: string;
  syncId: string;
  budgetPassword?: string; // only for end-to-end encrypted budgets
  dataDir: string;
}

export interface RawTxn {
  id: string;
  date: string;
  amount: number; // Actual's integer cents; negative = money out
  payee: string | null;
  category: string | null;
  notes: string | null;
}

const lc = (s: string | null | undefined) => (s ?? '').toLowerCase();

export function matches(t: RawTxn, rules: MatchRule[]): boolean {
  return rules.some(
    (r) =>
      (r.payee === undefined || lc(t.payee) === lc(r.payee)) &&
      (r.category === undefined || lc(t.category) === lc(r.category)) &&
      (r.notes === undefined || lc(t.notes).includes(lc(r.notes))),
  );
}

export function recipientFor(t: RawTxn, rules: RecipientRule[], fallback: string): string {
  const hay = `${lc(t.notes)} ${lc(t.payee)}`;
  return rules.find((r) => hay.includes(lc(r.match)))?.name ?? fallback;
}

export function toDonations(txns: RawTxn[], config: PledgeConfig): Donation[] {
  const { rules, recipients, defaultRecipient, since } = config.actual;
  return txns
    .filter((t) => matches(t, rules) && (!since || t.date >= since))
    .map((t) => ({
      date: t.date,
      year: Number(t.date.slice(0, 4)),
      amount: -t.amount / 100, // money out of the account is a gift; a refund comes back negative
      recipient: recipientFor(t, recipients, defaultRecipient),
      note: t.notes ?? undefined,
      source: 'actual' as const,
      ea: true, // Actual rules only match giving you chose to track; mark exceptions in the CSV
    }));
}

/**
 * Downloads the budget and returns every non-parent transaction. The matching is
 * done here rather than in AQL so rule edits in config.yaml apply on the next
 * page load without another download.
 */
export async function fetchTransactions(env: ActualEnv): Promise<RawTxn[]> {
  fs.mkdirSync(env.dataDir, { recursive: true });
  await api.init({ dataDir: env.dataDir, serverURL: env.serverUrl, password: env.password });
  try {
    await api.downloadBudget(env.syncId, env.budgetPassword ? { password: env.budgetPassword } : undefined);
    // splits: 'inline' returns split children in place of their parent, so a split
    // that puts part of one charge toward a donation is counted for that part only.
    const { data } = (await api.aqlQuery(
      api
        .q('transactions')
        .filter({ tombstone: false })
        .select(['id', 'date', 'amount', 'payee.name', 'category.name', 'notes'])
        .options({ splits: 'inline' }),
    )) as { data: Record<string, any>[] };
    return data.map((r) => ({
      id: r.id,
      date: r.date,
      amount: r.amount,
      payee: r['payee.name'] ?? null,
      category: r['category.name'] ?? null,
      notes: r.notes ?? null,
    }));
  } finally {
    await api.shutdown().catch(() => undefined);
  }
}
