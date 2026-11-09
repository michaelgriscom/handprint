import { renderBreakdown } from './breakdown';
import { canonicalName, parseConfig, PledgeConfig } from './config';
import { computeMilestones } from './milestones';
import { Donation, summarize } from './summary';

/** Everything the page needs, from a config and a list of donations. Shared by server and browser. */
export function buildView(config: PledgeConfig, raw: Donation[], today: string) {
  // Aliases collapse "AMF" and "Against Malaria Foundation" into one recipient everywhere.
  const donations = raw.map((d) => ({ ...d, recipient: canonicalName(d.recipient, config) }));
  const summary = summarize(config, donations, today);
  const warnings: string[] = [];
  for (const y of summary.years) if (!y.income) warnings.push(`No income set for ${y.year}, so it has no target.`);
  return {
    summary,
    warnings,
    breakdown: renderBreakdown(donations, config, today),
    milestones: computeMilestones(donations, config),
  };
}

/** Portable snapshot: the raw config text plus every donation (Actual and CSV merged). */
export interface Bundle {
  format: 'pledge-tracker';
  version: 1;
  exportedAt: string;
  configYaml: string;
  donations: Donation[];
}

export function makeBundle(configYaml: string, donations: Donation[], now = new Date()): Bundle {
  return { format: 'pledge-tracker', version: 1, exportedAt: now.toISOString(), configYaml, donations };
}

const DATE = /^\d{4}(-\d{2}-\d{2})?$/;

/** Validates an imported bundle; throws a readable error on anything malformed. */
export function parseBundle(text: string): { bundle: Bundle; config: PledgeConfig } {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a JSON file.');
  }
  if (raw?.format !== 'pledge-tracker' || raw.version !== 1) throw new Error('Not a pledge tracker export (wrong format or version).');
  if (typeof raw.configYaml !== 'string') throw new Error('Export is missing its config.');
  if (!Array.isArray(raw.donations)) throw new Error('Export is missing its donations.');
  const config = parseConfig(raw.configYaml);
  const donations: Donation[] = raw.donations.map((d: any, i: number) => {
    const date = String(d?.date ?? '');
    const amount = Number(d?.amount);
    if (!DATE.test(date) || !Number.isFinite(amount) || typeof d.recipient !== 'string') throw new Error(`Donation ${i + 1} is malformed.`);
    return {
      date,
      year: Number(date.slice(0, 4)),
      amount,
      recipient: d.recipient,
      note: typeof d.note === 'string' ? d.note : undefined,
      source: d.source === 'actual' ? 'actual' : 'csv',
      ea: d.ea !== false,
    };
  });
  return { bundle: { format: 'pledge-tracker', version: 1, exportedAt: String(raw.exportedAt ?? ''), configYaml: raw.configYaml, donations }, config };
}
