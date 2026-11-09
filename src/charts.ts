import { Summary, YearSummary } from './summary';

// Server-rendered SVG. Colors come from CSS custom properties on .viz-root so the
// light/dark steps swap in one place; marks never carry text.

const W = 640; // matches the 40rem column, so 12.5px text renders at 12.5px
const PAD = { l: 46, r: 62, t: 10, b: 24 };

const compact = (n: number) =>
  n === 0 ? '0' : n.toLocaleString('en-US', { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 });
const usd = (n: number) => `$${compact(n)}`;

/** Clean round ticks (1, 2, 2.5 or 5 × 10^k), ending at or above max. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let i = 0; ticks.length === 0 || ticks[ticks.length - 1] < max - step * 1e-9; i++) ticks.push(Math.round(i * step * 1e6) / 1e6);
  return ticks;
}

/** A column with a 4px rounded data-end, square at the baseline. */
function column(x: number, w: number, y: number, base: number, cls: string) {
  const h = base - y;
  if (h <= 0.5) return '';
  const r = Math.min(4, h, w / 2);
  return `<path class="${cls}" d="M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z"/>`;
}

function grid(ticks: number[], y: (v: number) => number, fmt: (n: number) => string) {
  return ticks
    .map((t) => `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${PAD.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`)
    .join('');
}

interface Band { year: number; x: number; w: number }

function bands(years: YearSummary[]): Band[] {
  const w = (W - PAD.l - PAD.r) / years.length;
  return years.map((y, i) => ({ year: y.year, x: PAD.l + i * w, w }));
}

const barW = (b: Band) => Math.min(24, b.w * 0.6);

function yearAxis(bs: Band[], base: number) {
  const every = bs[0] && bs[0].w < 40 ? 2 : 1; // every other year when crowded
  return (
    bs
      .map((b, i) => (i % every === 0 || i === bs.length - 1 ? `<text class="tick" x="${b.x + b.w / 2}" y="${base + 18}" text-anchor="middle">${b.year}</text>` : ''))
      .join('') + `<line class="axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${base}" y2="${base}"/>`
  );
}

/** Transparent full-band hit targets; the tooltip reads the year from them. */
function hits(bs: Band[], top: number, base: number) {
  return bs.map((b) => `<rect class="hit" data-year="${b.year}" tabindex="0" x="${b.x}" y="${top}" width="${b.w}" height="${base - top}"/>`).join('');
}

function incomeChart(ys: YearSummary[], bs: Band[]) {
  const H = 160;
  const base = H - PAD.b;
  const ticks = niceTicks(Math.max(1, ...ys.map((y) => y.income?.gross ?? 0)), 2);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => base - (v / top) * (base - PAD.t);
  const marks = ys
    .map((s, i) => {
      const b = bs[i];
      const w = barW(b);
      return s.income ? column(b.x + (b.w - w) / 2, w, y(s.income.gross), base, `m-income${s.income.status === 'estimate' ? ' est' : ''}`) : '';
    })
    .join('');
  // Estimated years are hatched, so the distinction survives print and colour-blindness.
  const defs = `<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line class="hatch-ink" x1="0" y1="0" x2="0" y2="6" stroke-width="2.5"/></pattern></defs>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gross income by year; values in the table view">${defs}${grid(ticks, y, usd)}${marks}${yearAxis(bs, base)}${hits(bs, PAD.t, base)}</svg>`;
}

/** Running totals: every gift counts toward given; only years with income add to the target. */
export function cumulative(ys: YearSummary[]) {
  let given = 0;
  let target = 0;
  let anyTarget = false;
  return ys.map((s) => {
    given += s.given;
    if (s.target !== null) {
      target += s.target;
      anyTarget = true;
    }
    return { year: s.year, given, target: anyTarget && s.target !== null ? target : null };
  });
}

function cumulativeChart(ys: YearSummary[], bs: Band[], percent: number) {
  const H = 240;
  const base = H - PAD.b;
  const cum = cumulative(ys);
  const ticks = niceTicks(Math.max(1, ...cum.map((c) => Math.max(c.given, c.target ?? 0))), 4);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => base - (v / top) * (base - PAD.t);
  const cx = (i: number) => bs[i].x + bs[i].w / 2;
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${cx(i)},${y(v)}`;
      pen = true;
    });
    return d;
  };
  const gi = cum.length - 1;
  let ti = -1;
  cum.forEach((c, i) => { if (c.target !== null) ti = i; });

  // End labels only where they won't collide; otherwise the legend and tooltip carry the values.
  const labels: string[] = [];
  const gy = y(cum[gi].given);
  const ty = ti >= 0 ? y(cum[ti].target!) : null;
  const apart = ty === null || Math.abs(gy - ty) >= 14 || Math.abs(cx(gi) - cx(ti)) > 70;
  if (apart) {
    labels.push(`<text class="end-label" x="${cx(gi) + 10}" y="${gy + 4}">${usd(cum[gi].given)}</text>`);
    if (ty !== null) labels.push(`<text class="ref-label" x="${cx(ti) + 10}" y="${ty + 4}">${usd(cum[ti].target!)}</text>`);
  }
  const dots =
    `<circle class="m-dot" cx="${cx(gi)}" cy="${gy}" r="4"/>` +
    (ty !== null ? `<circle class="m-dot target" cx="${cx(ti)}" cy="${ty}" r="4"/>` : '');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative given against cumulative ${percent}% target; values in the table view">${grid(ticks, y, usd)}<path class="m-line target" d="${path(cum.map((c) => c.target))}"/><path class="m-line" d="${path(cum.map((c) => c.given))}"/>${dots}${labels.join('')}${yearAxis(bs, base)}${hits(bs, PAD.t, base)}</svg>`;
}

export function renderCharts(s: Summary): string {
  const ys = [...s.years].reverse(); // oldest first
  if (!ys.length) return '';
  const bs = bands(ys);
  const cum = cumulative(ys);
  const data = Object.fromEntries(
    ys.map((y, i) => [
      y.year,
      { gross: y.income?.gross ?? null, estimate: y.income?.status === 'estimate', given: y.given, pct: y.percentGiven, cumGiven: cum[i].given, cumTarget: cum[i].target, cum: y.cumulativePercent },
    ]),
  );
  const est = ys.some((y) => y.income?.status === 'estimate');
  return `<div class="chart" data-chart>
  <div class="chart-head"><h3>Gross income</h3>${est ? '<span class="legend"><span><span class="sw income"></span>final</span><span><span class="sw income est"></span>estimate</span></span>' : ''}</div>
  ${incomeChart(ys, bs)}
  <div class="chart-head"><h3>Given vs. target, cumulative</h3><span class="legend"><span><span class="lk given"></span>given</span><span><span class="lk target"></span>${s.pledge.kind === 'further' ? 'pledge target' : `${s.percent}% target`}</span></span></div>
  ${cumulativeChart(ys, bs, s.percent)}
  <div class="tooltip" hidden></div>
  <script type="application/json" class="chart-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
}

// One readout per year, shared by both charts; the same on focus as on hover.
// DOM built with textContent only.
export const chartScript = `
(() => {
  for (const root of document.querySelectorAll('[data-chart]')) {
    const data = JSON.parse(root.querySelector('.chart-data').textContent);
    const tip = root.querySelector('.tooltip');
    const fmt = (n) => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US');
    const row = (value, label, key) => {
      const r = document.createElement('div'); r.className = 'row';
      const k = document.createElement('span'); k.className = 'key ' + (key || 'none'); r.append(k);
      const v = document.createElement('strong'); v.textContent = value;
      const l = document.createElement('span'); l.textContent = ' ' + label;
      r.append(v, l); return r;
    };
    const clear = () => root.querySelectorAll('.hit.on').forEach((n) => n.classList.remove('on'));
    const show = (el, x, y) => {
      const d = data[el.dataset.year]; if (!d) return;
      tip.replaceChildren();
      const h = document.createElement('div'); h.className = 'tt-year'; h.textContent = el.dataset.year; tip.append(h);
      tip.append(row(fmt(d.gross), d.gross == null ? 'income not set' : 'gross' + (d.estimate ? ' (estimate)' : ''), 'income'));
      tip.append(row(fmt(d.given), 'given' + (d.pct == null ? '' : ' · ' + d.pct.toFixed(1) + '% of gross'), 'none'));
      tip.append(row(fmt(d.cumGiven), 'given, cumulative', 'given'));
      if (d.cumTarget != null) tip.append(row(fmt(d.cumTarget), 'target, cumulative', 'target'));
      if (d.cum != null) tip.append(row(d.cum.toFixed(2) + '%', 'of gross, cumulative', 'none'));
      tip.hidden = false;
      const box = root.getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(x - box.left + 14, box.width - tip.offsetWidth - 4)) + 'px';
      tip.style.top = (y - box.top + 14) + 'px';
      clear();
      root.querySelectorAll('.hit[data-year="' + el.dataset.year + '"]').forEach((n) => n.classList.add('on'));
    };
    const hide = () => { tip.hidden = true; clear(); };
    for (const el of root.querySelectorAll('.hit')) {
      el.addEventListener('pointermove', (e) => show(el, e.clientX, e.clientY));
      el.addEventListener('pointerleave', hide);
      el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top + 20); });
      el.addEventListener('blur', hide);
    }
  }
})();`;
