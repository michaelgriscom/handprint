// Visual language borrowed from michaelgris.com: cream/charcoal surfaces, Newsreader
// body, Young Serif headings, hairline rules instead of cards, one navy accent.
// Token names match the site's so an embedded build can inherit its theme; the
// standalone pages define them on .viz-root:not(.embedded).

/** @font-face for the vendored OFL fonts; `base` is the URL prefix of the woff2 files. */
export const fontFace = (base: string) => `
@font-face{font-family:"Newsreader";src:url("${base}newsreader-latin.woff2") format("woff2");font-weight:200 800;font-style:normal;font-display:swap}
@font-face{font-family:"Newsreader";src:url("${base}newsreader-latin-italic.woff2") format("woff2");font-weight:200 800;font-style:italic;font-display:swap}
@font-face{font-family:"Young Serif";src:url("${base}young-serif.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}`;

const LIGHT = `--background:#fdfcf9;--surface:#f4f2ec;--foreground:#1e2026;--subtle:#62646b;--accent:#2a5189;--muted:#eae8e2;--border:#e3e0d8`;
const DARK = `--background:#16181c;--surface:#1e2126;--foreground:#e4e2dd;--subtle:#9a9ca3;--accent:#97b6e6;--muted:#2c2f36;--border:#2b2e34`;
// Chart series. Slots 1–3 validated all-pairs on each surface (CVD ΔE ≥ 8.6, normal ≥ 17);
// the rest validated for adjacency only. Dark slot 1 is a deeper blue than the site's
// link accent so it clears the chroma floor as a data mark.
const CHART_LIGHT = `--cat-0:#2a5189;--cat-1:#a06b01;--cat-2:#008d65;--cat-3:#8365b3;--cat-4:#b3594b;--cat-5:#827a03;--cat-6:#af5674;--cat-7:#398b50;--series:#2a5189;--ink-on-cat:#fff`;
const CHART_DARK = `--cat-0:#6185c8;--cat-1:#b68028;--cat-2:#2ea37a;--cat-3:#a98be0;--cat-4:#d27a6a;--cat-5:#a88822;--cat-6:#c66b89;--cat-7:#5eac6e;--series:#6185c8;--ink-on-cat:#16181c`;

export const STYLES = `
.viz-root:not(.embedded){${LIGHT};color-scheme:light}
[data-theme=dark] .viz-root:not(.embedded){${DARK};color-scheme:dark}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .viz-root:not(.embedded){${DARK};color-scheme:dark}}
.viz-root{${CHART_LIGHT}}
[data-theme=dark] .viz-root{${CHART_DARK}}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .viz-root{${CHART_DARK}}}

.viz-root{--serif:var(--font-newsreader,"Newsreader","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif);--display:var(--font-young-serif,"Young Serif","Iowan Old Style",Georgia,serif);
  background:var(--background);color:var(--foreground);font-family:var(--serif);font-size:1.05rem;line-height:1.5;font-kerning:normal;font-variant-numeric:oldstyle-nums proportional-nums;-webkit-font-smoothing:antialiased;min-height:100svh}
.viz-root *,.viz-root *::before,.viz-root *::after{box-sizing:border-box}
.viz-root main{max-width:40rem;margin:0 auto;padding:1.75rem 1.25rem 2.5rem}
.viz-root.embedded{min-height:0;background:transparent}
@media (min-width:40rem){.viz-root main{padding:2.5rem 1.5rem 3rem}}
.viz-root ::selection{background:color-mix(in oklab,var(--accent) 25%,transparent)}

.num,.lining{font-variant-numeric:lining-nums tabular-nums}
.viz-root h1,.viz-root h2,.viz-root h3{font-family:var(--display);font-weight:400;color:var(--foreground);font-variant-numeric:lining-nums;text-wrap:balance;margin:0}
.viz-root h1{font-size:2.25rem;line-height:1.1}
@media (min-width:40rem){.viz-root h1{font-size:2.75rem}}
.meta,.sub,.stat-label,.score-unit,.ms-date,.legend{color:var(--subtle)}
.meta{font-style:italic;font-size:.95rem}
.subtitle{margin:.6rem 0 0;color:var(--subtle);font-style:italic;font-size:1.05rem}
.eyebrow{font-family:var(--serif);color:var(--subtle);letter-spacing:.08em;text-transform:uppercase;font-variant-numeric:lining-nums tabular-nums;font-size:.78rem;font-style:normal}
.viz-root a{color:var(--accent);text-decoration:underline;text-decoration-color:color-mix(in oklab,var(--accent) 40%,transparent);text-underline-offset:.18em;text-decoration-thickness:1px;transition:text-decoration-color .15s,text-decoration-thickness .15s}
.viz-root a:hover{text-decoration-color:var(--accent);text-decoration-thickness:2px}
a.src{font-size:.85em;color:var(--subtle);text-decoration-color:color-mix(in oklab,var(--subtle) 40%,transparent)}a.src:hover{color:var(--accent)}

.topbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:2rem}
.theme-btn{display:grid;place-items:center;width:2.25rem;height:2.25rem;border:0;background:none;color:var(--subtle);cursor:pointer;border-radius:.375rem}
.theme-btn:hover{color:var(--foreground)}.theme-btn .icon{width:1.25rem;height:1.25rem}
.theme-btn .sun{display:none}[data-theme=dark] .theme-btn .sun{display:block}[data-theme=dark] .theme-btn .moon{display:none}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .theme-btn .sun{display:block}:root:not([data-theme=light]) .theme-btn .moon{display:none}}

section.block{margin-top:3rem}
.nav{display:flex;flex-wrap:wrap;gap:.25rem 1.5rem;margin-top:1.75rem;padding-bottom:.8rem;border-bottom:1px solid var(--border);font-size:1.02rem}
.nav a{color:var(--subtle);text-decoration:none;padding:.15rem 0}
.nav a:hover{color:var(--foreground);text-decoration:none}
.nav a[aria-current]{color:var(--foreground);text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:.35em}
section.block:first-of-type{margin-top:2.25rem}
.rule-h{display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem}
.rule-h h2{font-size:1.45rem;line-height:1.2;white-space:nowrap}
.rule-h::after{content:"";flex:1;height:1px;background:var(--border)}
.rule-h .meta{white-space:nowrap}
h3.eyebrow{font-family:var(--serif);margin:1.75rem 0 .6rem}
h3.eyebrow:first-child{margin-top:0}
.prose{line-height:1.6}.prose p{margin:0 0 .9em}

.banner{border-left:2px solid var(--accent);background:var(--surface);padding:.6rem .9rem;margin:0 0 1rem;font-size:.95rem;border-radius:0 .25rem .25rem 0}
.banner.bad{border-left-color:#c0453f;background:color-mix(in oklab,#c0453f 10%,var(--surface))}

.stat{border-top:2px solid var(--accent);padding-top:.6rem;min-width:0}
.stat-value{font-family:var(--display);font-variant-numeric:lining-nums tabular-nums;font-size:clamp(1.6rem,5.5vw,2.25rem);line-height:1.1;color:var(--foreground);display:flex;align-items:center;gap:.45rem}
.stat-value .icon{width:1.15rem;height:1.15rem;flex:none;color:var(--accent)}
.stat-label{margin-top:.35rem;font-size:.92rem;line-height:1.35}
.stat.sm{border-top-width:1px;border-top-color:var(--border)}.stat.sm .stat-value{font-size:1.4rem}
.stat.accent .stat-value{color:var(--accent)}
.stats{display:grid;gap:1.25rem 1.5rem;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:40rem){.stats.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.stats.cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}}

.meter{position:relative;height:6px;border-radius:3px;background:var(--muted);margin-top:1rem}
.meter .fill{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--accent)}
.meter .marker{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--foreground);border-radius:1px}
.meter.thin{height:4px;border-radius:2px;margin-top:.45rem}
.legend{font-size:.85rem;margin:.6rem 0 0;display:flex;flex-wrap:wrap;gap:.3rem 1rem;align-items:center}
.lk,.sw{display:inline-block;vertical-align:middle;margin-right:.4rem}
.lk{width:.9rem;height:2px;border-radius:1px}.sw{width:.6rem;height:.6rem;border-radius:2px}
.lk.given,.sw.given{background:var(--series)}.lk.target{background:var(--foreground)}.sw.marker{width:2px;height:.8rem;background:var(--foreground)}
.sw.income{background:color-mix(in oklab,var(--subtle) 55%,transparent)}.sw.income.est{background:repeating-linear-gradient(135deg,color-mix(in oklab,var(--subtle) 55%,transparent) 0 2px,transparent 2px 4px)}

.chart{position:relative}.chart svg{display:block;width:100%;height:auto;overflow:visible}
.chart-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem 1rem;margin:1.5rem 0 .25rem}.chart-head:first-child{margin-top:0}
.chart-head h3{font-family:var(--serif);font-size:.95rem;font-style:italic;color:var(--subtle)}.chart-head .legend{margin:0}
.chart .grid{stroke:var(--border);stroke-width:1}.chart .axis{stroke:color-mix(in oklab,var(--subtle) 50%,transparent);stroke-width:1}
.chart .tick{fill:var(--subtle);font-family:var(--serif);font-size:12.5px;font-variant-numeric:lining-nums tabular-nums}
.m-income{fill:color-mix(in oklab,var(--subtle) 55%,transparent)}.m-income.est{fill:url(#hatch)}
.chart .hatch-ink{stroke:color-mix(in oklab,var(--subtle) 70%,transparent)}
.m-line{fill:none;stroke:var(--series);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.m-line.target{stroke:var(--foreground);stroke-width:1.5}
.m-dot{fill:var(--series);stroke:var(--background);stroke-width:2}.m-dot.target{fill:var(--foreground)}
.ref-label,.end-label{font-family:var(--serif);font-size:12.5px;fill:var(--subtle);font-variant-numeric:lining-nums tabular-nums}.end-label{fill:var(--foreground)}
.hit{fill:transparent;outline:none}.hit.on{fill:var(--foreground);fill-opacity:.05}
.tooltip{position:absolute;pointer-events:none;background:var(--background);border:1px solid var(--border);border-radius:.375rem;padding:.5rem .7rem;font-size:.85rem;box-shadow:0 6px 20px rgb(0 0 0/.12);min-width:11rem;z-index:2;line-height:1.45}
.tooltip .tt-year{font-family:var(--display);margin-bottom:.2rem}.tooltip .row{display:flex;align-items:center;gap:.4rem;white-space:nowrap}
.tooltip strong{font-weight:500;font-variant-numeric:lining-nums tabular-nums}.tooltip .row span:last-child{color:var(--subtle)}
.key{display:inline-block;width:.6rem;height:2px;border-radius:1px}.key.income{background:color-mix(in oklab,var(--subtle) 55%,transparent)}.key.given,.key.line{background:var(--series)}.key.target{background:var(--foreground)}.key.none{background:none}

.table-view{margin-top:1rem}
.table-view summary{cursor:pointer;color:var(--subtle);font-size:.9rem;font-style:italic;list-style:none;user-select:none}
.table-view summary::-webkit-details-marker{display:none}
.table-view summary::before{content:"";display:inline-block;width:.4em;height:.4em;border-right:1.5px solid;border-bottom:1.5px solid;margin-right:.6em;transform:translateY(-.15em) rotate(-45deg);transition:transform .2s}
.table-view[open] summary::before{transform:translateY(-.25em) rotate(45deg)}
.table-view summary:hover{color:var(--foreground)}
.scroll{overflow-x:auto;margin-top:.75rem}
.viz-root table{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:lining-nums tabular-nums}
.viz-root th,.viz-root td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid var(--border);font-weight:400;white-space:nowrap}
.viz-root thead th{color:var(--subtle);border-bottom-color:color-mix(in oklab,var(--subtle) 50%,transparent)}
.viz-root tbody th{padding-left:0}.viz-root td.num,.viz-root th.num{text-align:right}
.badge{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--subtle);margin-left:.3rem}

.ms-list{list-style:none;margin:0;padding:0}
.ms-list li{display:flex;align-items:center;gap:.8rem;padding:.55rem 0;border-bottom:1px solid var(--border)}
.ms-list li:last-child{border-bottom:0}
.ms-list .icon{width:1.1rem;height:1.1rem;flex:none;color:var(--accent)}
.ms-next{align-items:flex-start!important}.ms-next .icon{margin-top:.25rem}
.ms-body{flex:1;min-width:0}.ms-body .sub{font-size:.85rem;margin-top:.25rem}
.ms-text{flex:1;min-width:0}.ms-date{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;font-variant-numeric:lining-nums tabular-nums}
.ms-cols{display:grid;gap:0 2.5rem}
@media (min-width:40rem){.ms-cols{grid-template-columns:1fr 1fr}}
.ms-more{margin-top:.5rem}.ms-more summary{cursor:pointer;color:var(--subtle);font-size:.9rem;font-style:italic;list-style:none}
.ms-more summary::-webkit-details-marker{display:none}.ms-more summary:hover{color:var(--foreground)}

.breakdown{position:relative}
.filters{display:grid;gap:1rem 2rem;padding-bottom:1.25rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border)}
@media (min-width:40rem){.filters{grid-template-columns:1fr 1fr}.filters .range{grid-column:1/-1}}
.control{display:flex;flex-direction:column;gap:.45rem;min-width:0}
.control-label{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;color:var(--subtle);font-size:.92rem}
.control-label output{color:var(--foreground);font-variant-numeric:lining-nums tabular-nums;white-space:nowrap}
.range .sliders{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
.viz-root input[type=range]{width:100%;accent-color:var(--accent);cursor:pointer;margin:0}
.viz-root input[type=range]:focus-visible,.viz-root button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.presets{display:flex;gap:.35rem}
.viz-root .btn,.presets button,.chip,.seg-ctl button{font:inherit;font-size:.85rem;line-height:1.2;border:1px solid var(--border);background:var(--surface);color:var(--subtle);border-radius:.375rem;padding:.3rem .65rem;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
.viz-root .btn:hover,.presets button:hover,.chip:hover,.seg-ctl button:hover{color:var(--foreground);border-color:var(--subtle)}
.viz-root .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--background)}
.chips{display:flex;flex-wrap:wrap;gap:.35rem}
.chip{display:inline-flex;align-items:center;gap:.4rem}.chip .sw{margin:0}
.chip[aria-pressed=true]{color:var(--foreground);border-color:var(--subtle)}.chip[aria-pressed=false]{opacity:.55}.chip[aria-pressed=false] .sw{background:var(--muted)!important}
.seg-ctl{display:inline-flex}.seg-ctl button{border-radius:0;margin-left:-1px}
.seg-ctl button:first-child{border-radius:.375rem 0 0 .375rem;margin-left:0}.seg-ctl button:last-child{border-radius:0 .375rem .375rem 0}
.seg-ctl button[aria-checked=true]{background:var(--foreground);border-color:var(--foreground);color:var(--background);position:relative;z-index:1}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

.split{display:flex;gap:2px;height:26px;margin-top:1.5rem}
.seg{border-radius:3px;min-width:3px;display:flex;align-items:center;padding-left:.5rem;overflow:hidden;outline:none}
.seg span{font-size:.78rem;font-variant-numeric:lining-nums tabular-nums;color:var(--ink-on-cat);white-space:nowrap}.seg.narrow span{visibility:hidden}
.seg:hover,.seg:focus{filter:brightness(1.08)}
.split-legend .li{display:inline-flex;align-items:center}
.rrow{display:grid;grid-template-columns:minmax(7rem,12rem) 1fr;gap:.9rem;align-items:center;padding:.35rem 0;border-bottom:1px solid var(--border);outline:none}
.rrow:last-child{border-bottom:0}.rrow:hover,.rrow:focus{background:color-mix(in oklab,var(--foreground) 4%,transparent)}
.rname{font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rtrack{display:flex;align-items:center;gap:.5rem;min-width:0}.rbar{height:14px;border-radius:0 3px 3px 0;flex:none}
.rval{font-size:.85rem;color:var(--subtle);font-variant-numeric:lining-nums tabular-nums;white-space:nowrap}

.viz-root footer{margin-top:3.5rem;padding-top:1.25rem;border-top:1px solid var(--border);color:var(--subtle);font-size:.9rem;font-style:italic;line-height:1.5}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-bottom:1.5rem}
.toolbar .note{margin-right:auto;font-size:.9rem;font-style:italic;color:var(--subtle)}
.empty{max-width:34rem;margin:6vh auto 0}.empty h1{margin-bottom:.75rem}.empty p{color:var(--subtle);line-height:1.6}
.empty .actions{display:flex;gap:.6rem;margin:1.5rem 0}.empty code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;background:color-mix(in oklab,var(--muted) 70%,transparent);padding:.1em .35em;border-radius:.25rem}
.share-url{display:block;width:100%;margin-top:.5rem;font:inherit;font-size:.8rem;padding:.35rem .5rem;border:1px solid var(--border);border-radius:.25rem;background:var(--background);color:var(--subtle)}
.err{border-left:2px solid #c0453f;background:color-mix(in oklab,#c0453f 10%,var(--surface));padding:.6rem .9rem;margin:1rem 0;font-size:.95rem}
`;

/** Standalone theme toggle, mirroring the site's: data-theme on <html>, saved under "theme". */
export const themeScript = `
(() => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const sys = () => (mq.matches ? 'dark' : 'light');
  const saved = () => { try { const t = localStorage.getItem('theme'); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
  const apply = (t) => { document.documentElement.dataset.theme = t; };
  apply(saved() ?? sys());
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { next === sys() ? localStorage.removeItem('theme') : localStorage.setItem('theme', next); } catch {}
    apply(next);
  });
  mq.addEventListener('change', () => { if (!saved()) apply(sys()); });
})();`;
