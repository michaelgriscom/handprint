import { breakdownScript } from './breakdown';
import { chartScript, renderCharts } from './charts';
import { iconSvg } from './icons';
import { Next, Reached } from './milestones';
import { pictogram, round2sig } from './pictogram';
import { Impact, Summary, YearSummary } from './summary';
import { fontFace, STYLES, themeScript } from './theme';

export type Page = 'overview' | 'over-time' | 'milestones' | 'giving';
export const PAGES: { page: Page; path: string; title: string }[] = [
  { page: 'overview', path: '', title: 'Overview' },
  { page: 'over-time', path: 'history', title: 'History' },
  { page: 'milestones', path: 'milestones', title: 'Milestones' },
  { page: 'giving', path: 'recipients', title: 'Recipients' },
];
export const pageFor = (path: string): Page | null => PAGES.find((p) => p.path === path.replace(/^[/#]+|\/+$/g, ''))?.page ?? null;

export interface RenderMeta {
  page?: Page; // which page to render; defaults to the overview
  href?: (path: string) => string; // link target for a page path ("/over-time" on the server, "#over-time" in the web build)
  refreshedAt: string | null;
  error: string | null;
  warnings: string[];
  breakdown: string; // pre-rendered "Where it went" section
  milestones: { reached: Reached[]; next: Next[] };
  toolbar?: string; // HTML placed above the title (theme toggle, or the web version's import/export bar)
  brand?: string; // small label in the self-hosted page's top bar, e.g. your domain
  footer?: string; // replaces the self-hosted footer
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const when = (d: string) => (d.length === 4 ? d : `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`);

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const usd = (n: number, signed = false) => {
  const s = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  if (!signed) return n < 0 ? `−${s}` : s;
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
};
const usdCompact = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M` : usd(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

const approx = (n: number) =>
  `≈${round2sig(n).toLocaleString('en-US', { notation: n >= 10_000 ? 'compact' : 'standard', maximumSignificantDigits: 2 })}`;

function stat(value: string, label: string, opts: { icon?: string; small?: boolean; accent?: boolean; title?: string } = {}) {
  const cls = ['stat', opts.small ? 'sm' : '', opts.accent ? 'accent' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><div class="stat-value"${opts.title ? ` title="${esc(opts.title)}"` : ''}>${opts.icon ? iconSvg(opts.icon) : ''}<span>${esc(value)}</span></div><div class="stat-label">${label}</div></div>`;
}

function section(title: string, body: string, aside = '') {
  return `<section class="block"><div class="rule-h"><h2>${esc(title)}</h2>${aside ? `<span class="meta">${aside}</span>` : ''}</div>${body}</section>`;
}

function meter(given: number, target: number | null, marker: number | null, thin = false) {
  if (!target) return '';
  const fill = Math.max(0, Math.min(1, given / target));
  const name = `${usd(given)} of ${usd(target)} (${Math.round((given / target) * 100)}%)`;
  const mark =
    marker === null
      ? ''
      : `<span class="marker" style="left:${(Math.min(1, marker / target) * 100).toFixed(2)}%" title="Target to date: ${usd(marker)}"></span>`;
  return `<div class="meter${thin ? ' thin' : ''}" role="meter" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${given}" aria-label="${esc(name)}" title="${esc(name)}"><span class="fill" style="width:${(fill * 100).toFixed(2)}%"></span>${mark}</div>`;
}

/** Lifetime impact: each figure with a glyph row, so the count is seen as well as read. */
function renderScorecard(list: Impact[]) {
  if (!list.length) return '';
  const tile = (i: Impact, n: number) =>
    `<div class="impact${n === 0 ? ' hero' : ''}"${i.note ? ` title="${esc(i.note)}"` : ''}>
      <div class="impact-value">${esc(approx(i.amount))}</div>
      <div class="stat-label">${esc(i.unit)}</div>
      ${pictogram(round2sig(i.amount), i.unit, i.icon, n === 0)}
    </div>`;
  const notes = list
    .filter((i) => i.note || i.source)
    .map((i) => `<li><strong>${esc(i.unit)}:</strong> ${esc(i.note ?? '')}${i.source ? ` <a class="src" href="${esc(i.source)}" rel="noreferrer" target="_blank">source</a>` : ''}</li>`)
    .join('');
  return section(
    'Impact',
    `<div class="impacts">${list.map(tile).join('')}</div>
    ${notes ? `<details class="table-view"><summary>How these are estimated</summary><ul class="notes">${notes}</ul></details>` : ''}`,
    'lifetime estimate',
  );
}

/** "10% of income" or "everything above $40,000 a year". */
const pledgeDesc = (s: Summary) => (s.pledge.kind === 'further' ? `everything above ${usd(s.pledge.allowance!)} a year` : `${s.percent}% of income`);
const pledgeGoal = (s: Summary) => (s.pledge.kind === 'further' ? 'the pledge' : `${s.percent}%`);

function renderPledge(s: Summary) {
  const current = s.years.find((y) => y.year === Number(s.today.slice(0, 4))) ?? s.years[0];
  const prev = current ? s.years.find((y) => y.year === current.year - 1) : undefined;
  const parts: string[] = [];

  if (s.lifetime) {
    const { given, goal, gross, years, estimated } = s.lifetime;
    parts.push(`<div class="stats">
      ${stat(pct(s.lifetime.percent), 'of income given', { accent: true, title: `${usd(given)} of ${usd(gross)} over ${years} ${years === 1 ? 'year' : 'years'}${estimated ? ', incl. estimates' : ''}` })}
      ${given >= goal ? stat(usd(given - goal), `past ${pledgeGoal(s)}`) : stat(usd(goal - given), `to reach ${pledgeGoal(s)}`)}
    </div>${meter(given, goal, null)}
    <p class="legend lining">${usd(given)} of ${usdCompact(goal)} pledged</p>`);
  }

  if (current) {
    const y = current;
    const est = y.income && y.income.status !== 'final';
    const tiles = [
      stat(usd(y.given), 'given', { small: true, title: y.percentGiven === null ? undefined : `${pct(y.percentGiven)} of income` }),
      stat(y.target === null ? '—' : usd(y.target), y.income ? `target${est ? ' · est.' : ''}${y.coverage < 1 ? ' · pro-rated' : ''}` : 'target · income not set', {
        small: true,
        title: y.income ? (s.pledge.kind === 'further' ? `Income above ${usd(s.pledge.allowance!)}` : `${s.percent}% of ${usd(y.income.gross)}`) : undefined,
      }),
    ];
    if (y.pace) tiles.push(stat(usd(Math.abs(y.pace.ahead)), y.pace.ahead >= 0 ? 'ahead of pace' : 'behind pace', { small: true, title: `${usd(y.pace.targetToDate)} expected by now` }));
    if (prev?.balance != null) tiles.push(stat(usd(prev.balance, true), `carried from ${prev.year}`, { small: true, title: `${prev.balance >= 0 ? 'Surplus' : 'Shortfall'} through ${prev.year}` }));
    parts.push(`<h3 class="eyebrow" style="margin-top:2rem">${y.year}</h3>
      <div class="stats cols-${tiles.length}">${tiles.join('')}</div>
      ${meter(y.given, y.target, y.pace?.targetToDate ?? null)}
      ${y.pace ? `<p class="legend"><span><span class="sw marker"></span>on pace</span></p>` : ''}`);
  }

  return parts.length ? section('Pledge', parts.join(''), pledgeDesc(s)) : '';
}

function incomeCell(y: YearSummary) {
  if (!y.income) return `<span class="meta">not set</span>`;
  return `${usd(y.income.gross)}${y.income.status === 'estimate' ? '<span class="badge">est.</span>' : ''}`;
}

function renderOverTime(s: Summary) {
  const rows = s.years
    .map(
      (y) => `<tr>
      <th scope="row">${y.year}${y.coverage < 1 ? ` <span class="badge">from start</span>` : ''}</th>
      <td class="num">${incomeCell(y)}</td>
      <td class="num">${usd(y.given)}</td>
      <td class="num">${y.target === null ? '—' : usd(y.target)}</td>
      <td class="num">${y.percentGiven === null ? '—' : pct(y.percentGiven)}</td>
      <td class="num">${y.cumulativePercent === null ? '—' : pct(y.cumulativePercent)}</td>
    </tr>`,
    )
    .join('');
  return section(
    'History',
    `${renderCharts(s)}
<details class="table-view"><summary>Table view</summary><div class="scroll"><table>
<thead><tr><th>Year</th><th class="num">Gross income</th><th class="num">Given</th><th class="num">Target</th><th class="num">% of gross</th><th class="num">Cumulative</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6" class="meta">No data</td></tr>'}</tbody></table></div></details>`,
  );
}

function renderMilestones(m: { reached: Reached[]; next: Next[] }) {
  if (!m.reached.length && !m.next.length) return '';
  const next = m.next
    .slice(0, 6)
    .map((n) => {
      // Measured from the last milestone, not from zero, so each bar is one step.
      const pctDone = Math.max(0, Math.min(100, ((n.current - n.from) / (n.target - n.from)) * 100));
      return `<li class="ms-next">${iconSvg(n.icon)}<div class="ms-body">
        <div class="ms-text">${esc(n.text)}</div>
        <div class="meter thin" role="meter" aria-valuemin="${n.from}" aria-valuemax="${n.target}" aria-valuenow="${n.current}" aria-label="${esc(`${Math.round(pctDone)}% of the way`)}"><span class="fill" style="width:${pctDone.toFixed(1)}%"></span></div>
        <div class="sub lining">${usd(n.dollarsNeeded)} more${n.via ? ` to ${esc(n.via)}` : ''}</div></div></li>`;
    })
    .join('');
  const item = (r: Reached) => `<li>${iconSvg(r.icon)}<span class="ms-text">${esc(r.text)}</span><span class="ms-date">${when(r.date)}</span></li>`;
  const RECENT = 6; // the rest fold away: early milestones are small and many
  const older = m.reached.slice(RECENT);
  const reached =
    m.reached.slice(0, RECENT).map(item).join('') +
    (older.length ? `<li class="ms-fold"><details class="table-view ms-more"><summary>${older.length} earlier</summary><ul class="ms-list">${older.map(item).join('')}</ul></details></li>` : '');
  return section(
    'Milestones',
    `<div class="ms-cols">
    <div><h3 class="eyebrow">Next</h3><ul class="ms-list">${next || '<li class="meta">None.</li>'}</ul></div>
    <div><h3 class="eyebrow">Reached</h3><ul class="ms-list">${reached || '<li class="meta">None yet.</li>'}</ul></div>
  </div>`,
    `${m.reached.length} reached`,
  );
}

export function renderMain(s: Summary, meta: RenderMeta): string {
  const page: Page = meta.page ?? 'overview';
  const href = meta.href ?? ((p: string) => `/${p}`);
  const nav = `<nav class="nav" aria-label="Sections">${PAGES.map((p) => `<a href="${esc(href(p.path))}"${p.page === page ? ' aria-current="page"' : ''}>${esc(p.title)}</a>`).join('')}</nav>`;
  const body =
    page === 'over-time'
      ? s.years.length ? renderOverTime(s) : '<p class="meta" style="margin-top:2rem">No years to show yet.</p>'
      : page === 'milestones'
        ? renderMilestones(meta.milestones) || '<p class="meta" style="margin-top:2rem">No milestones yet.</p>'
        : page === 'giving'
          ? meta.breakdown ? section('Recipients', meta.breakdown) : '<p class="meta" style="margin-top:2rem">No gifts recorded yet.</p>'
          : `${renderScorecard(s.impact)}${renderPledge(s)}`;
  const first = s.years.length ? s.years[s.years.length - 1].year : null;
  const banners = [
    meta.error ? `<div class="banner bad" role="alert"><strong>Actual refresh failed:</strong> ${esc(meta.error)}${meta.refreshedAt ? ' Showing the last good data.' : ''}</div>` : '',
    ...meta.warnings.map((w) => `<div class="banner">${esc(w)}</div>`),
  ].join('');

  return `${meta.toolbar ?? ''}
<h1>Handprint</h1>
<p class="subtitle lining">${usd(s.totalGiven)} given${first ? ` since ${first}` : ''} · ${esc(s.pledge.label)}</p>
${nav}
${banners ? `<div style="margin-top:1.5rem">${banners}</div>` : ''}
${body}
${meta.footer ?? `<footer>${meta.refreshedAt ? `Refreshed ${esc(new Date(meta.refreshedAt).toLocaleString('en-US'))}` : 'Not loaded yet'} · <a href="/api/summary">JSON</a> · <a href="/export">Export</a></footer>`}`;
}

const moon = '<svg class="icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
const sun = '<svg class="icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

export function renderPage(s: Summary, meta: RenderMeta): string {
  const toolbar = `<div class="topbar"><span class="eyebrow">${esc(meta.brand ?? 'Handprint')}</span><button id="theme-btn" class="theme-btn" type="button" aria-label="Switch theme" title="Switch theme">${moon}${sun}</button></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Handprint</title>
<link rel="preload" href="/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/young-serif.woff2" as="font" type="font/woff2" crossorigin>
<style>${fontFace('/fonts/')}${STYLES}</style>
<script>${themeScript}</script></head>
<body style="margin:0"><div class="viz-root"><main>
${renderMain(s, { ...meta, toolbar })}
</main></div><script>${chartScript}${breakdownScript}</script></body></html>`;
}
