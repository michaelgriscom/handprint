// Browser-only build: no server, no Actual. Data comes from an imported export
// (or config.yaml + donations.csv) and lives in this browser's localStorage.
import { breakdownScript } from '../breakdown';
import { chartScript } from '../charts';
import { parseConfig } from '../config';
import { parseDonationsCsv } from '../csv';
import { pageFor, renderMain } from '../render';
import { fontFace, STYLES } from '../theme';
import { decodeShare, encodeShare, SHARE_PARAM, shareFromHash } from '../share';
import { Bundle, buildView, makeBundle, parseBundle } from '../view';
import { SAMPLE_CONFIG, sampleDonations } from './sample';

const KEY = 'pledge-tracker:v1';
const SHARED_KEY = 'pledge-tracker:shared'; // sessionStorage: a snapshot opened from a share link
const app = document.getElementById('app')!;


function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load(): { bundle: Bundle; shared: boolean } | null {
  for (const [store, shared] of [[sessionStorage, true], [localStorage, false]] as const) {
    const text = store.getItem(shared ? SHARED_KEY : KEY);
    if (!text) continue;
    try {
      return { bundle: parseBundle(text).bundle, shared };
    } catch {
      store.removeItem(shared ? SHARED_KEY : KEY);
    }
  }
  return null;
}

async function shareLink(b: Bundle): Promise<string> {
  return `${location.origin}${location.pathname}#${SHARE_PARAM}${await encodeShare(b)}`;
}

function save(b: Bundle) {
  localStorage.setItem(KEY, JSON.stringify(b));
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Reads picked files: one export (.json), or config.yaml plus an optional donations.csv. */
async function importFiles(files: FileList): Promise<Bundle> {
  const list = [...files];
  const json = list.find((f) => f.name.toLowerCase().endsWith('.json'));
  if (json) return parseBundle(await json.text()).bundle;
  const yaml = list.find((f) => /\.ya?ml$/i.test(f.name));
  if (!yaml) throw new Error('Pick an export (.json), or config.yaml with an optional donations.csv.');
  const configYaml = await yaml.text();
  parseConfig(configYaml); // validate before saving
  const csv = list.find((f) => f.name.toLowerCase().endsWith('.csv'));
  return makeBundle(configYaml, csv ? parseDonationsCsv(await csv.text()) : []);
}

function download(b: Bundle) {
  const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `handprint-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function picker(onPick: (files: FileList) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.json,.yaml,.yml,.csv';
  input.addEventListener('change', () => input.files && input.files.length && onPick(input.files));
  input.click();
}

function render(error?: string, notice?: string) {
  const loaded = load();
  const bundle = loaded?.bundle ?? null;
  const shared = loaded?.shared ?? false;
  const errHtml = (error ? `<div class="err" role="alert">${esc(error)}</div>` : '') + (notice ?? '');
  const doImport = () =>
    picker(async (files) => {
      try {
        save(await importFiles(files));
        render();
      } catch (e) {
        render((e as Error).message);
      }
    });

  if (!bundle) {
    app.innerHTML = `<div class="empty">
      <h1>Handprint</h1>
      <p>What you've given against your income, who received it, and a rough estimate of what it did.</p>
      <p>Data stays in this browser. Import an export from the self-hosted tracker, or a <code>config.yaml</code> and <code>donations.csv</code>. Common EA charities are recognised automatically.</p>
      ${errHtml}
      <div class="actions"><button class="btn primary" data-act="import">Import data</button><button class="btn" data-act="sample">Try sample data</button></div>
    </div>`;
    app.querySelector('[data-act="import"]')!.addEventListener('click', doImport);
    app.querySelector('[data-act="sample"]')!.addEventListener('click', () => {
      save(makeBundle(SAMPLE_CONFIG, sampleDonations(today())));
      render();
    });
    return;
  }

  let view;
  try {
    view = buildView(parseConfig(bundle.configYaml), bundle.donations, today());
  } catch (e) {
    localStorage.removeItem(KEY);
    return render(`Stored data could not be read and was cleared: ${(e as Error).message}`);
  }
  const toolbar = shared
    ? `<div class="toolbar"><span class="note">Shared snapshot · viewing only, nothing stored</span>
    <button class="btn" data-act="keep">Save to this browser</button><button class="btn" data-act="close">Close</button></div>${errHtml}`
    : `<div class="toolbar"><span class="note">Stored in this browser only${bundle.exportedAt ? ` · exported ${esc(new Date(bundle.exportedAt).toLocaleDateString('en-US'))}` : ''}</span>
    <button class="btn" data-act="import">Import</button><button class="btn" data-act="export">Export</button><button class="btn" data-act="share">Share</button><button class="btn" data-act="clear">Clear</button></div>${errHtml}`;
  const footer = shared
    ? `<footer>A read-only snapshot carried in the link itself. Nothing was uploaded or stored.</footer>`
    : `<footer>Computed in your browser from data in its local storage. Nothing is uploaded.</footer>`;
  const page = pageFor(location.hash) ?? 'overview';
  app.innerHTML = renderMain(view.summary, { page, href: (p) => `#${p}`, refreshedAt: null, error: null, warnings: view.warnings, breakdown: view.breakdown, milestones: view.milestones, toolbar, footer });
  if (shared) {
    app.querySelector('[data-act="keep"]')!.addEventListener('click', () => {
      if (!localStorage.getItem(KEY) || confirm('Replace the giving data already saved in this browser with this snapshot?')) {
        save(bundle);
        sessionStorage.removeItem(SHARED_KEY);
        render();
      }
    });
    app.querySelector('[data-act="close"]')!.addEventListener('click', () => {
      sessionStorage.removeItem(SHARED_KEY);
      render();
    });
  } else {
    app.querySelector('[data-act="import"]')!.addEventListener('click', doImport);
    app.querySelector('[data-act="export"]')!.addEventListener('click', () => download(bundle));
    app.querySelector('[data-act="share"]')!.addEventListener('click', async () => {
      const url = await shareLink(bundle);
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        // clipboard needs a secure context; the field below still lets them copy by hand
      }
      render(undefined, `<div class="banner share-out"><strong>${copied ? 'Link copied.' : 'Share link:'}</strong> Anyone who opens it sees a read-only snapshot of this page; the data travels in the link (${Math.round(url.length / 1024)} KB), not through a server.<input class="share-url" readonly value="${esc(url)}"></div>`);
      (app.querySelector('.share-url') as HTMLInputElement | null)?.select();
    });
    app.querySelector('[data-act="clear"]')!.addEventListener('click', () => {
      if (confirm('Remove all giving data from this browser? Export first if you want a copy.')) {
        localStorage.removeItem(KEY);
        render();
      }
    });
  }
  // The interactive layers are shared with the server page as script strings.
  new Function(chartScript)();
  new Function(breakdownScript)();
}

// On michaelgris.com the host page already defines the theme tokens and fonts; standalone
// builds bring their own (the woff2 files sit next to app.js in fonts/).
const host = getComputedStyle(document.documentElement);
const style = document.createElement('style');
style.textContent = (host.getPropertyValue('--font-young-serif').trim() ? '' : fontFace('fonts/')) + STYLES;
document.head.append(style);
if (host.getPropertyValue('--accent').trim()) document.querySelector('.viz-root')?.classList.add('embedded');
// A share link carries the data in the fragment: decode it into sessionStorage, then
// drop the fragment so page routing (#history etc.) works as normal.
const incoming = shareFromHash(location.hash);
if (incoming) {
  decodeShare(incoming)
    .then((b) => {
      sessionStorage.setItem(SHARED_KEY, JSON.stringify(b));
      history.replaceState(null, '', location.pathname + location.search);
      render();
    })
    .catch((e: Error) => {
      history.replaceState(null, '', location.pathname + location.search);
      render(e.message);
    });
} else {
  render();
}
addEventListener('hashchange', () => {
  if (shareFromHash(location.hash)) return location.reload();
  render();
  scrollTo(0, 0);
});
