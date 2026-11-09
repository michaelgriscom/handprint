import { parse } from 'yaml';
import { iconName } from './icons';
import { PRESETS } from './presets';

export type IncomeStatus = 'estimate' | 'final';

export interface IncomeEntry {
  gross: number;
  status: IncomeStatus;
  note?: string;
}

/** A transaction matches a rule when every field the rule sets matches. */
export interface MatchRule {
  payee?: string; // exact payee name, case-insensitive
  category?: string; // exact category name, case-insensitive
  notes?: string; // substring of the notes, case-insensitive
}

export interface RecipientRule {
  match: string; // substring of notes or payee, case-insensitive
  name: string;
}

/** Per-dollar impact estimate for one recipient. Shown as an approximation with its source. */
export interface ImpactRule {
  recipient: string; // matches a donation's recipient name, case-insensitive
  perDollar: number; // units per dollar given, after share
  order: number; // position in config, for display order
  icon: string; // key in ICONS
  unit: string; // e.g. "shrimp helped per year"
  source?: string; // URL
  note?: string;
}

export type PledgeKind = 'gwwc' | 'trial' | 'further' | 'custom';

export interface Pledge {
  kind: PledgeKind;
  label: string;
  percent: number; // of gross income; unused for `further`
  allowance?: number; // `further` only: everything above this yearly amount is pledged
  startDate?: string; // YYYY-MM-DD; the first year's target is pro-rated from here
}

export interface PledgeConfig {
  pledge: Pledge;
  income: Record<number, IncomeEntry>;
  actual: {
    rules: MatchRule[];
    recipients: RecipientRule[];
    defaultRecipient: string;
    since?: string; // ignore Actual transactions before this date (covered by the CSV)
  };
  donationsCsv?: string;
  impact: ImpactRule[];
  /** Cause areas, in display order; a recipient not listed falls into defaultCategory. */
  categories: { name: string; recipients: string[] }[];
  defaultCategory: string;
  /** lower-cased alias → canonical recipient name (from presets and the `aliases` section) */
  aliases: Record<string, string>;
  presets: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(msg: string): never {
  throw new Error(`config: ${msg}`);
}

// `yaml` parses unquoted 2026-01-01 as a string in its default (core) schema, but
// accept Date too in case the file opts into YAML 1.1 timestamps.
function asDate(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (!DATE_RE.test(s)) fail(`${field} must be YYYY-MM-DD, got "${s}"`);
  return s;
}

export function parseConfig(text: string): PledgeConfig {
  const raw = (parse(text) ?? {}) as Record<string, any>;

  const pledge = parsePledge(raw.pledge ?? {});

  const income: Record<number, IncomeEntry> = {};
  for (const [year, entry] of Object.entries(raw.income ?? {})) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1900 || y > 2200) fail(`income: "${year}" is not a year`);
    const e = (typeof entry === 'number' ? { gross: entry } : entry) as Record<string, unknown>;
    const gross = Number(e?.gross);
    if (!Number.isFinite(gross) || gross < 0) fail(`income.${year}.gross must be a non-negative number`);
    const status = (e.status ?? 'estimate') as IncomeStatus;
    if (status !== 'estimate' && status !== 'final') fail(`income.${year}.status must be estimate or final`);
    income[y] = { gross, status, note: e.note === undefined ? undefined : String(e.note) };
  }

  const a = raw.actual ?? {};
  const rules: MatchRule[] = (a.rules ?? []).map((r: Record<string, unknown>, i: number) => {
    const rule: MatchRule = {};
    if (r.payee !== undefined) rule.payee = String(r.payee);
    if (r.category !== undefined) rule.category = String(r.category);
    if (r.notes !== undefined) rule.notes = String(r.notes);
    if (!rule.payee && !rule.category && !rule.notes) fail(`actual.rules[${i}] needs payee, category or notes`);
    return rule;
  });
  const recipients: RecipientRule[] = (a.recipients ?? []).map((r: Record<string, unknown>, i: number) => {
    if (!r.match || !r.name) fail(`actual.recipients[${i}] needs match and name`);
    return { match: String(r.match), name: String(r.name) };
  });

  return {
    pledge,
    income,
    actual: {
      rules,
      recipients,
      defaultRecipient: String(a.default_recipient ?? 'Unattributed'),
      since: asDate(a.since, 'actual.since'),
    },
    donationsCsv: raw.donations_csv ? String(raw.donations_csv) : undefined,
    ...mergePresets(raw),
    defaultCategory: String(raw.default_category ?? 'Other'),
  };
}

const LABELS: Record<PledgeKind, string> = { gwwc: 'Giving What We Can Pledge', trial: 'Trial Pledge', further: 'Further Pledge', custom: 'Giving pledge' };

/**
 * Pledge kinds follow Giving What We Can's: the Pledge (10% of income), the Trial
 * Pledge (1% or more, for a set time), the Further Pledge (everything above a living
 * allowance), or a custom percentage.
 */
function parsePledge(p: Record<string, any>): Pledge {
  const kind = String(p.kind ?? (p.allowance !== undefined ? 'further' : 'gwwc')) as PledgeKind;
  if (!LABELS[kind]) fail(`pledge.kind must be one of ${Object.keys(LABELS).join(', ')}`);
  const label = p.label === undefined ? LABELS[kind] : String(p.label);
  const startDate = asDate(p.start_date, 'pledge.start_date');
  if (kind === 'further') {
    const allowance = Number(p.allowance);
    if (!(allowance > 0)) fail('pledge.allowance (yearly living allowance) is required for a Further Pledge');
    return { kind, label, percent: 100, allowance, startDate };
  }
  if (kind === 'custom' && p.percent === undefined) fail('pledge.percent is required for a custom pledge');
  const percent = Number(p.percent ?? (kind === 'trial' ? 1 : 10));
  if (!(percent > 0 && percent <= 100)) fail('pledge.percent must be between 0 and 100');
  if (kind === 'gwwc' && percent < 10) fail('pledge.percent below 10 is a Trial Pledge: set kind: trial');
  return { kind, label, percent, startDate };
}

/**
 * The built-in registry is on by default (`presets: none` turns it off); the
 * config's own categories, aliases and impact lines win per recipient.
 */
function mergePresets(raw: Record<string, any>): Pick<PledgeConfig, 'categories' | 'aliases' | 'impact' | 'presets'> {
  const given: string[] = raw.presets === undefined ? ['ea'] : Array.isArray(raw.presets) ? raw.presets.map(String) : [String(raw.presets)];
  const names = given.filter((n) => n !== 'none');
  for (const n of names) if (!PRESETS[n]) fail(`presets: "${n}" is not one of ${Object.keys(PRESETS).join(', ')}`);

  const categories: { name: string; recipients: string[] }[] = Object.entries((raw.categories ?? {}) as Record<string, unknown>).map(([name, list]) => {
    if (!Array.isArray(list)) fail(`categories.${name} must be a list of recipient names`);
    return { name, recipients: list.map(String) };
  });
  const aliases: Record<string, string> = {};
  const presetImpact: Record<string, unknown>[] = [];
  for (const n of names) {
    for (const cat of PRESETS[n].categories) {
      const target = categories.find((c) => c.name.toLowerCase() === cat.name.toLowerCase()) ?? (categories.push({ name: cat.name, recipients: [] }), categories[categories.length - 1]);
      for (const ch of cat.charities) {
        if (!target.recipients.some((r) => r.toLowerCase() === ch.name.toLowerCase())) target.recipients.push(ch.name);
        for (const a of ch.aliases ?? []) aliases[a.toLowerCase()] = ch.name;
        for (const line of ch.impact ?? []) presetImpact.push({ recipient: ch.name, ...line });
      }
    }
  }
  for (const [alias, name] of Object.entries((raw.aliases ?? {}) as Record<string, unknown>)) aliases[alias.toLowerCase()] = String(name);

  const own: Record<string, unknown>[] = raw.impact ?? [];
  const overridden = new Set(own.map((r) => String(r.recipient ?? '').toLowerCase()));
  const lines = [...presetImpact.filter((r) => !overridden.has(String(r.recipient).toLowerCase())), ...own];
  return {
    presets: names,
    categories,
    aliases,
    impact: lines.map((r: Record<string, unknown>, i: number) => {
      // Either per_dollar (units per $) or cost_per_unit ($ per unit); share scales it
      // for a fund that passes only part of each dollar to the program.
      const cost = r.cost_per_unit === undefined ? undefined : Number(r.cost_per_unit);
      const rate = cost !== undefined ? 1 / cost : Number(r.per_dollar);
      const share = r.share === undefined ? 1 : Number(r.share);
      if (!r.recipient || !r.unit || !(rate > 0) || !Number.isFinite(rate)) fail(`impact[${i}] needs recipient, unit and a positive per_dollar or cost_per_unit`);
      if (!(share > 0 && share <= 1)) fail(`impact[${i}].share must be in (0, 1]`);
      if (r.source !== undefined && !/^https?:\/\//.test(String(r.source))) fail(`impact[${i}].source must be an http(s) URL`);
      return {
        recipient: String(r.recipient),
        perDollar: rate * share,
        order: i,
        icon: iconName(String(r.unit), r.icon === undefined ? undefined : String(r.icon)),
        unit: String(r.unit),
        source: r.source === undefined ? undefined : String(r.source),
        note: r.note === undefined ? undefined : String(r.note),
      };
    }),
  };
}

/** "AMF" → "Against Malaria Foundation"; unknown names pass through unchanged. */
export function canonicalName(recipient: string, config: Pick<PledgeConfig, 'aliases'>): string {
  return config.aliases[recipient.trim().toLowerCase()] ?? recipient;
}

export function categoryOf(recipient: string, config: Pick<PledgeConfig, 'categories' | 'defaultCategory' | 'aliases'>): string {
  const r = canonicalName(recipient, config).toLowerCase();
  return config.categories.find((c) => c.recipients.some((x) => x.toLowerCase() === r))?.name ?? config.defaultCategory;
}

