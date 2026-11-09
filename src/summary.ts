import { ImpactRule, IncomeEntry, Pledge, PledgeConfig } from './config';

export interface Impact {
  amount: number;
  order: number;
  icon: string;
  unit: string;
  source?: string;
  note?: string;
}

export interface Donation {
  date: string; // YYYY-MM-DD, or YYYY for a yearly total
  year: number;
  amount: number; // dollars; positive = given, negative = refund
  recipient: string;
  note?: string;
  source: 'actual' | 'csv';
  ea?: boolean; // EA-aligned; treated as true when unset
}

export interface YearSummary {
  year: number;
  income: IncomeEntry | null;
  coverage: number; // share of the year the pledge was active (first year can be partial)
  target: number | null;
  given: number;
  gap: number | null; // given - target; negative = still owed
  percentGiven: number | null; // given as % of gross
  /** Given ÷ gross over all years with income up to and including this one. */
  cumulativePercent: number | null;
  /** Running surplus (+) or shortfall (-) across all years up to and including this one. */
  balance: number | null;
  /** Current year only: how far through the pledge window we are, and the target to date. */
  pace: { elapsed: number; targetToDate: number; ahead: number } | null;
  byRecipient: { recipient: string; amount: number; impact: Impact[] }[];
  impact: Impact[]; // summed by unit
}

export interface Summary {
  percent: number;
  pledge: Pledge;
  today: string;
  years: YearSummary[]; // newest first
  totalGiven: number;
  /** Given ÷ gross over every year that has income set (the "contrapositive" lifetime rate). */
  /** `goal` is the sum of yearly targets, so it holds for a Further Pledge too. */
  lifetime: { given: number; gross: number; goal: number; percent: number; years: number; estimated: boolean } | null;
  impact: Impact[]; // all years, summed by unit
}

/** Every rule for this recipient applies: a fund can carry several output lines. */
function impactFor(recipient: string, dollars: number, rules: ImpactRule[]): Impact[] {
  if (dollars <= 0) return [];
  return rules
    .filter((x) => x.recipient.toLowerCase() === recipient.toLowerCase())
    .map((r) => ({ amount: dollars * r.perDollar, order: r.order, icon: r.icon, unit: r.unit, source: r.source, note: r.note }));
}

/** Same unit and source add up; different sources stay separate so each keeps its citation. */
function sumImpact(list: Impact[]): Impact[] {
  const m = new Map<string, Impact>();
  for (const i of list) {
    const k = `${i.unit}\u0000${i.source ?? ''}`;
    const prev = m.get(k);
    m.set(k, prev ? { ...prev, amount: prev.amount + i.amount, order: Math.min(prev.order, i.order) } : { ...i });
  }
  return [...m.values()].sort((a, b) => a.order - b.order);
}

const DAY = 86_400_000;
const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);
const daysInYear = (y: number) => (utc(`${y + 1}-01-01`) - utc(`${y}-01-01`)) / DAY;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function summarize(config: PledgeConfig, donations: Donation[], today: string): Summary {
  const { pledge } = config;
  const yearTarget = (gross: number) => (pledge.kind === 'further' ? Math.max(0, gross - pledge.allowance!) : (gross * pledge.percent) / 100);
  const start = pledge.startDate;
  const startYear = start ? Number(start.slice(0, 4)) : -Infinity;
  const thisYear = Number(today.slice(0, 4));

  const years = new Set<number>();
  for (const y of Object.keys(config.income)) years.add(Number(y));
  for (const d of donations) years.add(d.year);

  // Every year from the first one with data through this year, so a year with no
  // income and no gifts shows up as missing instead of silently disappearing.
  const known = [...years].filter((y) => y >= startYear && y <= thisYear);
  const first = known.length ? Math.min(...known) : thisYear;
  const sorted: number[] = [];
  if (known.length) for (let y = first; y <= thisYear; y++) sorted.push(y);

  let balance: number | null = 0;
  let cumGiven = 0;
  let cumGross = 0;
  const out: YearSummary[] = [];
  for (const year of sorted) {
    const income = config.income[year] ?? null;
    const total = daysInYear(year);
    const windowStart = start && year === startYear ? utc(start) : utc(`${year}-01-01`);
    const windowDays = (utc(`${year + 1}-01-01`) - windowStart) / DAY;
    const coverage = windowDays / total;

    const mine = donations.filter((d) => d.year === year);
    const given = round2(mine.reduce((s, d) => s + d.amount, 0));
    const target = income ? round2(yearTarget(income.gross) * coverage) : null;
    const gap = target === null ? null : round2(given - target);
    balance = balance === null || gap === null ? null : round2(balance + gap);

    let pace: YearSummary['pace'] = null;
    if (year === thisYear && target !== null) {
      // Count today as elapsed: a gift made today should be judged against today's target.
      const elapsedDays = Math.min(windowDays, Math.max(0, (utc(today) - windowStart) / DAY + 1));
      const elapsed = elapsedDays / windowDays;
      const targetToDate = round2(target * elapsed);
      pace = { elapsed, targetToDate, ahead: round2(given - targetToDate) };
    }

    const byRec = new Map<string, number>();
    for (const d of mine) byRec.set(d.recipient, (byRec.get(d.recipient) ?? 0) + d.amount);

    if (income) {
      cumGiven += given;
      cumGross += income.gross;
    }

    const byRecipient = [...byRec]
      .map(([recipient, amount]) => ({ recipient, amount: round2(amount), impact: impactFor(recipient, amount, config.impact) }))
      .sort((a, b) => b.amount - a.amount);

    out.push({
      year,
      income,
      coverage,
      target,
      given,
      gap,
      percentGiven: income && income.gross > 0 ? round2((given / income.gross) * 100) : null,
      cumulativePercent: income && cumGross > 0 ? round2((cumGiven / cumGross) * 100) : null,
      balance,
      pace,
      byRecipient,
      impact: sumImpact(byRecipient.flatMap((r) => r.impact)),
    });
  }

  const withIncome = out.filter((y) => y.income);
  const lifeGross = withIncome.reduce((s, y) => s + y.income!.gross, 0);
  const lifeGiven = round2(withIncome.reduce((s, y) => s + y.given, 0));
  const lifetime =
    lifeGross > 0
      ? {
          given: lifeGiven,
          gross: lifeGross,
          goal: round2(withIncome.reduce((s, y) => s + (y.target ?? 0), 0)),
          percent: round2((lifeGiven / lifeGross) * 100),
          years: withIncome.length,
          estimated: withIncome.some((y) => y.income!.status === 'estimate'),
        }
      : null;

  return {
    percent: pledge.percent,
    pledge,
    lifetime,
    today,
    years: out.reverse(),
    totalGiven: round2(out.reduce((s, y) => s + y.given, 0)),
    impact: sumImpact(out.flatMap((y) => y.impact)),
  };
}
