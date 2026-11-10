import { categoryOf, PledgeConfig } from './config';
import { Donation } from './summary';

// "Where it went": one filter row (year range + category toggles) scoping a
// category split and ranked recipients. Rendered client-side from an
// embedded JSON payload; every name goes into the DOM via textContent.

export function renderBreakdown(donations: Donation[], config: PledgeConfig, today: string): string {
  const given = donations.filter((d) => d.amount !== 0);
  if (!given.length) return '';
  const cats = [...config.categories.map((c) => c.name)];
  const rows = given.map((d) => {
    const c = categoryOf(d.recipient, config);
    if (!cats.includes(c)) cats.push(c);
    return { y: d.year, a: d.amount, r: d.recipient, c, e: d.ea !== false };
  });
  const years = rows.map((r) => r.y);
  const used = new Set(rows.map((r) => r.c));
  const payload = {
    rows,
    cats: cats.filter((c) => used.has(c)).slice(0, 8), // only categories with gifts; eight colour slots
    min: Math.min(...years),
    max: Math.max(Number(today.slice(0, 4)), ...years),
  };
  return `<div class="breakdown" data-breakdown>
  <div class="filters" role="group" aria-label="Filters">
    <div class="control range">
      <span class="control-label"><span>Years</span><output class="range-out"></output></span>
      <div class="sliders">
        <label><span class="sr">From</span><input type="range" class="from" min="${payload.min}" max="${payload.max}" value="${payload.min}"></label>
        <label><span class="sr">To</span><input type="range" class="to" min="${payload.min}" max="${payload.max}" value="${payload.max}"></label>
      </div>
      <div class="presets"><button type="button" data-preset="all">All years</button><button type="button" data-preset="now">This year</button></div>
    </div>
    <div class="control"><span class="control-label"><span>Categories</span></span><div class="chips"></div></div>
    <div class="control"><span class="control-label"><span>Alignment</span></span><div class="seg-ctl" role="radiogroup" aria-label="EA alignment"><button type="button" role="radio" aria-checked="true" data-ea="all">All</button><button type="button" role="radio" aria-checked="false" data-ea="ea">EA-aligned</button><button type="button" role="radio" aria-checked="false" data-ea="other">Other</button></div></div>
  </div>
  <div class="stats cols-3 bd-kpis"></div>
  <div class="split-wrap"><div class="split" role="img"></div><div class="legend split-legend"></div></div>
  <h3 class="eyebrow">By recipient</h3>
  <div class="ranked"></div>
  <div class="tooltip" hidden></div>
  <script type="application/json" class="bd-data">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
</div>`;
}

export const breakdownScript = `
(() => {
  const root = document.querySelector('[data-breakdown]'); if (!root) return;
  const D = JSON.parse(root.querySelector('.bd-data').textContent);
  const $ = (s) => root.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const from = $('.from'), to = $('.to'), tip = $('.tooltip');
  const on = new Set(D.cats);
  let eaMode = 'all';
  for (const b of root.querySelectorAll('[data-ea]')) b.addEventListener('click', () => {
    eaMode = b.dataset.ea;
    for (const n of root.querySelectorAll('[data-ea]')) n.setAttribute('aria-checked', String(n === b));
    render();
  });
  const colorOf = (c) => 'var(--cat-' + Math.max(0, D.cats.indexOf(c)) + ')';

  const chips = $('.chips');
  for (const c of D.cats) {
    const b = el('button', 'chip'); b.type = 'button'; b.setAttribute('aria-pressed', 'true');
    const sw = el('span', 'sw'); sw.style.background = colorOf(c); b.append(sw, document.createTextNode(c));
    b.addEventListener('click', () => {
      if (on.has(c) && on.size === 1) { D.cats.forEach((x) => on.add(x)); } // last one off: reset to all
      else if (on.has(c)) on.delete(c); else on.add(c);
      for (const n of chips.querySelectorAll('.chip')) n.setAttribute('aria-pressed', String(on.has(n.textContent)));
      render();
    });
    chips.append(b);
  }
  for (const b of root.querySelectorAll('[data-preset]')) b.addEventListener('click', () => {
    if (b.dataset.preset === 'all') { from.value = D.min; to.value = D.max; } else { from.value = D.max; to.value = D.max; }
    render();
  });
  from.addEventListener('input', () => { if (+from.value > +to.value) to.value = from.value; render(); });
  to.addEventListener('input', () => { if (+to.value < +from.value) from.value = to.value; render(); });

  const tile = (label, value, sub) => {
    const t = el('div', 'stat sm');
    const v = el('div', 'stat-value'); v.append(el('span', null, value)); t.append(v);
    t.append(el('div', 'stat-label', label + (sub ? ' · ' + sub : '')));
    return t;
  };
  const showTip = (e, lines) => {
    tip.replaceChildren(...lines.map((l, i) => el('div', i ? 'row' : 'tt-year', l)));
    tip.hidden = false;
    const box = root.getBoundingClientRect();
    tip.style.left = Math.max(4, Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 4)) + 'px';
    tip.style.top = (e.clientY - box.top + 14) + 'px';
  };
  const hideTip = () => { tip.hidden = true; };
  const hover = (node, lines) => {
    node.tabIndex = 0;
    node.addEventListener('pointermove', (e) => showTip(e, lines));
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); showTip({ clientX: r.left + 20, clientY: r.top + 10 }, lines); });
    node.addEventListener('blur', hideTip);
  };

  function render() {
    const lo = +from.value, hi = +to.value;
    $('.range-out').textContent = lo === hi ? String(lo) : lo + '–' + hi;
    const rows = D.rows.filter((r) => r.y >= lo && r.y <= hi && on.has(r.c) && (eaMode === 'all' || (eaMode === 'ea') === r.e));
    const total = rows.reduce((s, r) => s + r.a, 0);

    const byCat = new Map(), byRec = new Map();
    for (const r of rows) {
      byCat.set(r.c, (byCat.get(r.c) || 0) + r.a);
      const k = byRec.get(r.r) || { r: r.r, c: r.c, a: 0, n: 0 };
      k.a += r.a; k.n += 1; byRec.set(r.r, k);
    }

    $('.bd-kpis').replaceChildren(
      tile('given', usd(total), ''),
      tile(rows.filter((r) => r.a > 0).length === 1 ? 'gift' : 'gifts', String(rows.filter((r) => r.a > 0).length), eaMode === 'all' ? '' : eaMode === 'ea' ? 'EA-aligned' : 'not EA-aligned'),
      tile(byRec.size === 1 ? 'recipient' : 'recipients', String(byRec.size), on.size === D.cats.length ? '' : [...on].join(', ')),
    );

    // Tall segmented bar: one whole split into categories, in config order.
    const split = $('.split'); split.replaceChildren();
    const legend = $('.split-legend'); legend.replaceChildren();
    const parts = D.cats.filter((c) => (byCat.get(c) || 0) > 0);
    split.setAttribute('aria-label', 'Split by category: ' + parts.map((c) => c + ' ' + usd(byCat.get(c))).join(', '));
    for (const c of parts) {
      const v = byCat.get(c), share = total > 0 ? v / total : 0;
      const seg = el('div', 'seg'); seg.style.flexGrow = String(v); seg.style.background = colorOf(c);
      const label = Math.round(share * 100) + '%';
      const span = el('span', null, label);
      seg.append(span);
      hover(seg, [c, usd(v) + ' · ' + label]);
      split.append(seg);
      const li = el('span', 'li'); const sw = el('span', 'sw'); sw.style.background = colorOf(c); li.append(sw, document.createTextNode(c)); legend.append(li);
    }
    requestAnimationFrame(() => { for (const s of split.querySelectorAll('.seg')) s.classList.toggle('narrow', s.firstChild.offsetWidth + 16 > s.offsetWidth); });

    // Ranked horizontal bars, largest first; the tail folds into one row.
    const ranked = $('.ranked'); ranked.replaceChildren();
    let list = [...byRec.values()].filter((x) => x.a > 0).sort((a, b) => b.a - a.a);
    const MAX = 12;
    if (list.length > MAX) {
      const tail = list.slice(MAX - 1);
      list = list.slice(0, MAX - 1).concat([{ r: 'Other (' + tail.length + ' recipients)', c: null, a: tail.reduce((s, x) => s + x.a, 0), n: tail.reduce((s, x) => s + x.n, 0), tail: true }]);
    }
    const top = list.length ? list[0].a : 1;
    for (const x of list) {
      const row = el('div', 'rrow');
      const name = el('div', 'rname', x.r);
      const track = el('div', 'rtrack');
      const bar = el('div', 'rbar'); bar.style.width = 'calc(' + Math.max(0.5, (x.a / top) * 100) + '% - ' + (x.a / top) * 84 + 'px)'; // leave room for the value label
      bar.style.background = x.tail ? 'var(--subtle)' : colorOf(x.c);
      track.append(bar, el('span', 'rval', usd(x.a)));
      row.append(name, track);
      hover(row, [x.r, usd(x.a) + ' · ' + (total > 0 ? (x.a / total * 100).toFixed(1) : 0) + '% of selection', x.n + (x.n === 1 ? ' gift' : ' gifts') + (x.c ? ' · ' + x.c : '')]);
      ranked.append(row);
    }
    if (!list.length) ranked.append(el('p', 'meta', 'No gifts match these filters.'));

  }
  render();
})();`;
