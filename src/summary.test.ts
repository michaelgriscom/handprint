import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from './config';
import { parseDonationsCsv } from './csv';
import { RawTxn, toDonations } from './actual';
import { summarize } from './summary';

const config = parseConfig(`
pledge:
  percent: 10
income:
  2025: { gross: 100000, status: final }
  2026: { gross: 120000 }
actual:
  rules:
    - payee: Every.org
  recipients:
    - { match: "EVERY.ORG* ANIMA", name: Animal Charity Evaluators }
    - { match: FARMK, name: FarmKind }
  default_recipient: Every.org
  since: 2026-01-01
`);

const txn = (date: string, dollars: number, notes: string, payee = 'Every.org'): RawTxn => ({
  id: `${date}-${notes}`, date, amount: Math.round(dollars * 100), payee, category: 'Michael', notes,
});

test('config defaults income status to estimate', () => {
  assert.equal(config.income[2026].status, 'estimate');
  assert.equal(config.income[2025].status, 'final');
});

test('Actual rules match payee case-insensitively, attribute recipients, honour since', () => {
  const d = toDonations(
    [
      txn('2026-10-16', -100, 'EVERY.ORG* ANIMA'),
      txn('2026-05-15', -10, 'EVERY.ORG* FARMK'),
      txn('2026-05-15', -10, 'EVERY.ORG* SHRIM', 'every.org'),
      txn('2026-06-01', 20, 'EVERY.ORG* ANIMA'), // refund
      txn('2025-12-01', -50, 'EVERY.ORG* ANIMA'), // before since: covered by CSV
      txn('2026-06-01', -40, 'groceries', 'Kroger'),
    ],
    config,
  );
  assert.deepEqual(
    d.map((x) => [x.amount, x.recipient]),
    [[100, 'Animal Charity Evaluators'], [10, 'FarmKind'], [10, 'Every.org'], [-20, 'Animal Charity Evaluators']],
  );
});

test('CSV accepts yearly totals, quotes and currency formatting', () => {
  const d = parseDonationsCsv('﻿date,amount,recipient,note\r\n2025,"$1,200.50",GiveWell,"yearly, total"\n2026-03-01,25,,\n');
  assert.deepEqual(d.map((x) => [x.year, x.amount, x.recipient, x.note]), [
    [2025, 1200.5, 'GiveWell', 'yearly, total'],
    [2026, 25, 'Unattributed', undefined],
  ]);
});

test('summary: targets, gaps, running balance, and pace', () => {
  const s = summarize(
    config,
    [
      { date: '2025', year: 2025, amount: 11000, recipient: 'GiveWell', source: 'csv' },
      { date: '2026-03-01', year: 2026, amount: 3000, recipient: 'ACE', source: 'actual' },
    ],
    '2026-07-02', // day 183 of 365
  );
  const [y26, y25] = s.years;
  assert.equal(y25.target, 10000);
  assert.equal(y25.gap, 1000);
  assert.equal(y25.balance, 1000);
  assert.equal(y25.pace, null);
  assert.equal(y26.target, 12000);
  assert.equal(y26.gap, -9000);
  assert.equal(y26.balance, -8000);
  assert.equal(y26.pace!.targetToDate, Math.round(12000 * (183 / 365) * 100) / 100);
  assert.equal(y26.percentGiven, 2.5);
});

test('summary: start_date pro-rates the first year and drops earlier years', () => {
  const c = { ...config, pledge: { percent: 10, startDate: '2025-07-01' } };
  const s = summarize(c, [{ date: '2024', year: 2024, amount: 5, recipient: 'x', source: 'csv' }], '2026-01-01');
  assert.deepEqual(s.years.map((y) => y.year), [2026, 2025]);
  assert.equal(s.years[1].target, Math.round(10000 * (184 / 365) * 100) / 100);
});

test('summary: a year with no income has no target and breaks the running balance', () => {
  const s = summarize({ ...config, income: { 2026: config.income[2026] } }, [{ date: '2025', year: 2025, amount: 1, recipient: 'x', source: 'csv' }], '2026-02-01');
  assert.equal(s.years[1].target, null);
  assert.equal(s.years[0].balance, null);
});

test('impact: per-recipient estimates, summed by unit per year and overall, refunds net out', () => {
  const c = parseConfig(`
income:
  2025: 100000
  2026: 100000
impact:
  - { recipient: shrimp welfare project, per_dollar: 1400, unit: shrimp helped per year, source: "https://example.org/swp" }
`);
  const s = summarize(
    c,
    [
      { date: '2025', year: 2025, amount: 10, recipient: 'Shrimp Welfare Project', source: 'csv' },
      { date: '2026-05-15', year: 2026, amount: 10, recipient: 'Shrimp Welfare Project', source: 'actual' },
      { date: '2026-05-20', year: 2026, amount: -5, recipient: 'Shrimp Welfare Project', source: 'actual' },
      { date: '2026-05-15', year: 2026, amount: 100, recipient: 'ACE', source: 'actual' },
    ],
    '2026-06-01',
  );
  assert.deepEqual(s.years[0].byRecipient.find((r) => r.recipient === 'ACE')!.impact, []);
  assert.deepEqual(s.years[0].impact.map((i) => [i.amount, i.unit]), [[7000, 'shrimp helped per year']]);
  assert.equal(s.impact[0].amount, 21000);
});

test('impact: config rejects a non-URL source and a missing rate', () => {
  assert.throws(() => parseConfig('impact:\n  - { recipient: x, per_dollar: 1, unit: u, source: "javascript:alert(1)" }'), /http/);
  assert.throws(() => parseConfig('impact:\n  - { recipient: x, unit: u }'), /per_dollar/);
});

test('summary: years with no data between the first year and today still appear', () => {
  const s = summarize({ ...config, income: { 2022: { gross: 1000, status: 'final' } } }, [], '2025-03-01');
  assert.deepEqual(s.years.map((y) => [y.year, y.target]), [[2025, null], [2024, null], [2023, null], [2022, 100]]);
});

test('lifetime: given ÷ gross over years with income only', () => {
  const s = summarize(
    { ...config, income: { 2024: { gross: 100000, status: 'final' }, 2025: { gross: 100000, status: 'estimate' } } },
    [
      { date: '2023', year: 2023, amount: 999, recipient: 'x', source: 'csv' }, // no income that year: excluded
      { date: '2024', year: 2024, amount: 5000, recipient: 'x', source: 'csv' },
      { date: '2025', year: 2025, amount: 8700, recipient: 'x', source: 'csv' },
    ],
    '2025-06-01',
  );
  assert.deepEqual(s.lifetime, { given: 13700, gross: 200000, goal: 20000, percent: 6.85, years: 2, estimated: true });
});

test('cumulativePercent: running given ÷ gross, skipping years without income', () => {
  const s = summarize(
    { ...config, income: { 2023: { gross: 100000, status: 'final' }, 2025: { gross: 100000, status: 'final' } } },
    [
      { date: '2023', year: 2023, amount: 5000, recipient: 'x', source: 'csv' },
      { date: '2024', year: 2024, amount: 7000, recipient: 'x', source: 'csv' },
      { date: '2025', year: 2025, amount: 15000, recipient: 'x', source: 'csv' },
    ],
    '2025-06-01',
  );
  assert.deepEqual(s.years.map((y) => [y.year, y.cumulativePercent]), [[2025, 10], [2024, null], [2023, 5]]);
});

test('categories: case-insensitive lookup with a default', async () => {
  const { categoryOf } = await import('./config');
  const c = parseConfig('presets: none\ncategories:\n  Global health: [GiveWell]\n  Animal welfare: [Animal Charity Evaluators]\ndefault_category: Other\n');
  assert.deepEqual(c.categories.map((x) => x.name), ['Global health', 'Animal welfare']);
  assert.equal(categoryOf('givewell', c), 'Global health');
  assert.equal(categoryOf('PBS', c), 'Other');
  assert.throws(() => parseConfig('categories:\n  Bad: GiveWell\n'), /list/);
});

test('breakdown: embeds every gift with its category, escaped for a script tag', async () => {
  const { renderBreakdown } = await import('./breakdown');
  const c = parseConfig('categories:\n  Global health: [GiveWell]\n');
  const html = renderBreakdown(
    [
      { date: '2023', year: 2023, amount: 100, recipient: 'GiveWell', source: 'csv' },
      { date: '2024', year: 2024, amount: 5, recipient: '</script><b>x', source: 'csv' },
    ],
    c,
    '2026-01-01',
  );
  const json = JSON.parse(html.match(/class="bd-data">(.*)<\/script>/s)![1]);
  assert.deepEqual(json.cats, ['Global health', 'Other']);
  assert.equal(json.min, 2023);
  assert.equal(json.max, 2026);
  assert.equal(json.rows[1].r, '</script><b>x');
  assert.ok(!html.includes('</script><b>'));
});

test('charts: cumulative target only accrues in years with income', async () => {
  const { cumulative } = await import('./charts');
  const ys = summarize(
    { ...config, income: { 2024: { gross: 100000, status: 'final' }, 2025: { gross: 50000, status: 'final' } } },
    [
      { date: '2024', year: 2024, amount: 8000, recipient: 'x', source: 'csv' },
      { date: '2026-02-01', year: 2026, amount: 500, recipient: 'x', source: 'actual' },
    ],
    '2026-03-01',
  ).years.reverse();
  assert.deepEqual(cumulative(ys), [
    { year: 2024, given: 8000, target: 10000 },
    { year: 2025, given: 8000, target: 15000 },
    { year: 2026, given: 8500, target: null },
  ]);
});

test('impact: a fund can carry several outputs via share and cost_per_unit', () => {
  const c = parseConfig(`
income:
  2025: 100000
impact:
  - { recipient: GiveWell, cost_per_unit: 5000, unit: lives saved }
  - { recipient: GiveWell, share: 0.5, cost_per_unit: 6, unit: bed nets }
  - { recipient: AMF, cost_per_unit: 6, unit: bed nets }
`);
  const s = summarize(
    c,
    [
      { date: '2025', year: 2025, amount: 1200, recipient: 'GiveWell', source: 'csv' },
      { date: '2025', year: 2025, amount: 60, recipient: 'AMF', source: 'csv' },
    ],
    '2025-06-01',
  );
  assert.deepEqual(s.impact.map((i) => [i.unit, Math.round(i.amount * 100) / 100]), [['lives saved', 0.24], ['bed nets', 110]]);
  assert.throws(() => parseConfig('impact:\n  - { recipient: x, unit: u, per_dollar: 1, share: 2 }'), /share/);
});

test('csv: optional ea column, default true, rejects junk', () => {
  const d = parseDonationsCsv('date,amount,recipient,ea\n2024,5,PBS,false\n2024,9,GiveWell,\n');
  assert.deepEqual(d.map((x) => x.ea), [false, true]);
  assert.throws(() => parseDonationsCsv('date,amount,ea\n2024,5,maybe\n'), /ea must be/);
});

test('milestones: dated crossings collapse to the highest per day; next is cheapest first', async () => {
  const { computeMilestones, singular } = await import('./milestones');
  const c = parseConfig(`
presets: none
impact:
  - { recipient: AMF, cost_per_unit: 6, unit: bed nets }
  - { recipient: AMF, cost_per_unit: 5000, unit: lives saved }
`);
  const m = computeMilestones(
    [
      { date: '2021-03-01', year: 2021, amount: 600, recipient: 'AMF', source: 'csv' },
      { date: '2022', year: 2022, amount: 600, recipient: 'AMF', source: 'csv' },
    ],
    c,
  );
  assert.deepEqual(m.reached.map((r) => [r.date, r.text]), [
    ['2022', '$1,000 given'], // 100 → 200 nets in 2022 crosses no net threshold
    ['2021-03-01', '100 bed nets'], // 0 → 100 crosses 1, 5 ... 100: only the highest is kept
  ]);
  assert.equal(m.next[0].text, '250 bed nets');
  assert.equal(m.next[0].from, 100); // bar starts at the last milestone, not zero
  assert.equal(m.next[0].dollarsNeeded, 300);
  assert.equal(m.next.find((n) => n.text.includes('life'))!.text, 'First life saved');
  assert.equal(singular('children protected'), 'child protected');
  assert.equal(singular('lives saved (expected)'), 'life saved (expected)');
});

test('bundle: export round-trips and rejects junk', async () => {
  const { makeBundle, parseBundle } = await import('./view');
  const yaml = 'income:\n  2025: 1000\n';
  const b = makeBundle(yaml, [{ date: '2025-01-02', year: 2025, amount: 5, recipient: 'x', source: 'actual', ea: false }], new Date('2026-01-01T00:00:00Z'));
  const back = parseBundle(JSON.stringify(b));
  assert.deepEqual(back.bundle.donations[0], { date: '2025-01-02', year: 2025, amount: 5, recipient: 'x', note: undefined, source: 'actual', ea: false });
  assert.equal(back.config.income[2025].gross, 1000);
  assert.throws(() => parseBundle('nope'), /JSON/);
  assert.throws(() => parseBundle('{"format":"other"}'), /format/);
  assert.throws(() => parseBundle(JSON.stringify({ ...b, donations: [{ date: 'x', amount: 1, recipient: 'y' }] })), /malformed/);
});

test('pages: paths map to pages for server and hash routes', async () => {
  const { pageFor } = await import('./render');
  assert.equal(pageFor('/'), 'overview');
  assert.equal(pageFor('/history'), 'over-time');
  assert.equal(pageFor('/recipients/'), 'giving');
  assert.equal(pageFor('#milestones'), 'milestones');
  assert.equal(pageFor(''), 'overview');
  assert.equal(pageFor('/nope'), null);
});

test('presets: ea supplies categories, aliases and impact; own entries win per recipient', async () => {
  const { canonicalName, categoryOf } = await import('./config');
  const c = parseConfig(`
presets: ea
categories:
  Local: [Food bank]
  Animal welfare: [Shelter]
aliases:
  AMF UK: Against Malaria Foundation
impact:
  - { recipient: GiveWell, cost_per_unit: 4000, unit: lives saved }
`);
  assert.deepEqual(c.categories.slice(0, 3).map((x) => x.name), ['Local', 'Animal welfare', 'Global health']);
  assert.ok(c.categories[1].recipients.includes('Shelter') && c.categories[1].recipients.includes('Shrimp Welfare Project'));
  assert.equal(canonicalName('amf', c), 'Against Malaria Foundation');
  assert.equal(canonicalName('AMF UK', c), 'Against Malaria Foundation');
  assert.equal(canonicalName('Unknown Org', c), 'Unknown Org');
  assert.equal(categoryOf('SWP', c), 'Animal welfare');
  assert.deepEqual(c.impact.filter((i) => i.recipient === 'GiveWell').map((i) => i.unit), ['lives saved']); // preset lines replaced
  assert.ok(c.impact.some((i) => i.recipient === 'Against Malaria Foundation' && i.unit === 'bed nets'));
  assert.throws(() => parseConfig('presets: nope'), /not one of/);
  assert.equal(parseConfig('income:\n  2025: 1\n').presets[0], 'ea'); // on by default
  assert.deepEqual(parseConfig('presets: none\n').categories, []);
});

test('view: aliases collapse recipients before summarising', async () => {
  const { buildView } = await import('./view');
  const c = parseConfig('presets: ea\nincome:\n  2025: 1000\n');
  const v = buildView(
    c,
    [
      { date: '2025-01-01', year: 2025, amount: 60, recipient: 'AMF', source: 'csv' },
      { date: '2025-02-01', year: 2025, amount: 60, recipient: 'Against Malaria Foundation', source: 'csv' },
    ],
    '2025-06-01',
  );
  assert.deepEqual(v.summary.years[0].byRecipient.map((r) => [r.recipient, r.amount]), [['Against Malaria Foundation', 120]]);
  assert.equal(Math.round(v.summary.impact.find((i) => i.unit === 'bed nets')!.amount), 20);
});

test('pledge kinds: defaults, further-pledge targets, validation', () => {
  assert.equal(parseConfig('').pledge.label, 'Giving What We Can Pledge');
  assert.equal(parseConfig('pledge: { kind: trial }').pledge.percent, 1);
  assert.throws(() => parseConfig('pledge: { percent: 5 }'), /Trial Pledge/);
  assert.throws(() => parseConfig('pledge: { kind: custom }'), /percent is required/);
  assert.throws(() => parseConfig('pledge: { kind: further }'), /allowance/);
  const c = parseConfig('pledge: { kind: further, allowance: 40000 }\nincome:\n  2024: 100000\n  2025: 30000\n');
  const s = summarize(c, [{ date: '2024', year: 2024, amount: 50000, recipient: 'x', source: 'csv' }], '2025-06-01');
  assert.deepEqual(s.years.map((y) => [y.year, y.target]), [[2025, 0], [2024, 60000]]);
  assert.equal(s.lifetime!.goal, 60000);
  assert.equal(s.pledge.label, 'Further Pledge');
});

test('share: encode/decode round-trips a bundle and rejects junk', async () => {
  const { encodeShare, decodeShare, shareFromHash } = await import('./share');
  const { makeBundle } = await import('./view');
  const b = makeBundle('income:\n  2025: 1000\n', [{ date: '2025-01-02', year: 2025, amount: 5, recipient: 'AMF', note: 'n', source: 'actual', ea: false }]);
  const code = await encodeShare(b);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = await decodeShare(code);
  assert.deepEqual(back.donations[0], { date: '2025-01-02', year: 2025, amount: 5, recipient: 'AMF', note: 'n', source: 'csv', ea: false });
  assert.equal(back.configYaml, b.configYaml);
  await assert.rejects(decodeShare('not-a-link'), /damaged/);
  assert.equal(shareFromHash('#share=abc'), 'abc');
  assert.equal(shareFromHash('#history'), null);
});
