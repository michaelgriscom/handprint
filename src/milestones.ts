import { PledgeConfig } from './config';
import { Donation } from './summary';

export interface Reached {
  date: string; // YYYY-MM-DD or YYYY
  icon: string;
  value: number;
  text: string;
}

export interface Next {
  icon: string;
  text: string;
  current: number;
  from: number; // the milestone before target (or 0): progress bars start here
  target: number;
  dollarsNeeded: number;
  via: string | null; // recipient with the best rate for this metric
}

const DOLLARS = [1e3, 5e3, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6, 2.5e6, 5e6, 1e7];

/** 1, 5, 10, 25, 50, 100, 250, 500, 1,000 ... */
export function niceSeries(max = 1e9): number[] {
  const out = [1, 5];
  for (let m = 10; m <= max; m *= 10) out.push(m, m * 2.5, m * 5);
  return out;
}

export function singular(unit: string): string {
  return unit
    .replace(/\blives\b/, 'life')
    .replace(/\bchildren\b/, 'child')
    .replace(/\b(nets|infants|dollars|child-years|families)\b/, (m) => (m === 'families' ? 'family' : m.slice(0, -1)));
}

const fmt = (n: number) => n.toLocaleString('en-US');

function metricText(unit: string, n: number) {
  return n === 1 ? `First ${singular(unit)}` : `${fmt(n)} ${unit}`;
}

interface Metric {
  key: string;
  icon: string;
  thresholds: number[];
  text: (n: number) => string;
  best: { rate: number; via: string | null };
  total: number;
}

export function computeMilestones(donations: Donation[], config: PledgeConfig): { reached: Reached[]; next: Next[] } {
  const metrics = new Map<string, Metric>();
  metrics.set('$', {
    key: '$',
    icon: 'gift',
    thresholds: DOLLARS,
    text: (n) => `$${fmt(n)} given`,
    best: { rate: 1, via: null },
    total: 0,
  });
  for (const r of config.impact) {
    const m = metrics.get(r.unit) ?? {
      key: r.unit,
      icon: r.icon,
      thresholds: niceSeries(),
      text: (n: number) => metricText(r.unit, n),
      best: { rate: 0, via: null },
      total: 0,
    };
    // Best single-recipient rate, summing a recipient's lines for the same unit.
    const rate = config.impact.filter((x) => x.unit === r.unit && x.recipient === r.recipient).reduce((s, x) => s + x.perDollar, 0);
    if (rate > m.best.rate) m.best = { rate, via: r.recipient };
    metrics.set(r.unit, m);
  }

  const crossed = new Map<string, Reached>(); // metric|date -> highest threshold crossed that day
  const sorted = [...donations].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) {
    const adds: [Metric, number][] = [[metrics.get('$')!, d.amount]];
    for (const r of config.impact) {
      if (r.recipient.toLowerCase() === d.recipient.toLowerCase()) adds.push([metrics.get(r.unit)!, d.amount * r.perDollar]);
    }
    for (const [m, add] of adds) {
      const before = m.total;
      m.total += add;
      for (const t of m.thresholds) {
        if (before < t && m.total >= t) {
          const k = `${m.key}|${d.date}`;
          const prev = crossed.get(k);
          if (!prev || prev.value < t) crossed.set(k, { date: d.date, icon: m.icon, value: t, text: m.text(t) });
        }
      }
    }
  }

  const reached = [...crossed.values()].sort((a, b) => b.date.localeCompare(a.date) || b.value - a.value);

  const next: Next[] = [];
  for (const m of metrics.values()) {
    if (m.best.rate <= 0) continue;
    const target = m.thresholds.find((t) => t > m.total + 1e-9);
    if (target === undefined) continue;
    const from = [...m.thresholds].reverse().find((t) => t < target && t <= m.total + 1e-9) ?? 0;
    next.push({
      icon: m.icon,
      text: m.text(target),
      current: m.total,
      from,
      target,
      dollarsNeeded: Math.ceil((target - m.total) / m.best.rate),
      via: m.best.via,
    });
  }
  // Cheapest to reach first: the ones a single gift could tip over.
  next.sort((a, b) => a.dollarsNeeded - b.dollarsNeeded);
  return { reached, next };
}
