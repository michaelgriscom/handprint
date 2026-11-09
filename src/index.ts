import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { ActualEnv, fetchTransactions, RawTxn, toDonations } from './actual';
import { parseConfig, PledgeConfig } from './config';
import { parseDonationsCsv } from './csv';
import { pageFor, renderPage } from './render';
import { Donation } from './summary';
import { buildView, makeBundle } from './view';

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined || v === '') throw new Error(`${k} is required`);
  return v;
};

const CONFIG_PATH = env('CONFIG_PATH', '/config/config.yaml');
const DATA_DIR = env('DATA_DIR', '/data');
const PORT = Number(env('PORT', '8080'));
const REFRESH_MINUTES = Number(env('REFRESH_MINUTES', '360'));
const BRAND = process.env.BRAND || undefined; // label in the page's top bar
const CACHE_FILE = path.join(DATA_DIR, 'actual-cache.json');
const FONT_DIR = path.resolve(__dirname, '..', 'fonts');

const actualEnv: ActualEnv = {
  serverUrl: env('ACTUAL_SERVER_URL'),
  password: env('ACTUAL_SERVER_PASSWORD'),
  syncId: env('ACTUAL_SYNC_ID'),
  budgetPassword: process.env.ACTUAL_BUDGET_PASSWORD || undefined,
  dataDir: '/tmp/actual-data',
};

interface Cache {
  refreshedAt: string | null;
  txns: RawTxn[];
}
let cache: Cache = { refreshedAt: null, txns: [] };
let lastError: string | null = null;
let refreshing: Promise<void> | null = null;

try {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  console.log(`Loaded ${cache.txns.length} cached transactions from ${cache.refreshedAt}`);
} catch {
  // first start, or no /data volume
}

function refresh(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const txns = await fetchTransactions(actualEnv);
      cache = { refreshedAt: new Date().toISOString(), txns };
      lastError = null;
      try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      } catch (e) {
        console.warn(`Could not write ${CACHE_FILE}: ${(e as Error).message}`);
      }
      console.log(`Refreshed: ${txns.length} transactions`);
    } catch (e) {
      lastError = (e as Error).message || String(e);
      console.error(`Refresh failed: ${lastError}`);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function today(): string {
  // Local date in the container's TZ, not UTC.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function build() {
  const configYaml = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config: PledgeConfig = parseConfig(configYaml);
  const donations: Donation[] = toDonations(cache.txns, config);
  const csvWarnings: string[] = [];
  if (config.donationsCsv) {
    const p = path.resolve(path.dirname(CONFIG_PATH), config.donationsCsv);
    if (fs.existsSync(p)) donations.push(...parseDonationsCsv(fs.readFileSync(p, 'utf8')));
    else csvWarnings.push(`donations_csv ${config.donationsCsv} not found; skipping it.`);
  }
  const view = buildView(config, donations, today());
  return { ...view, warnings: [...csvWarnings, ...view.warnings], donations, configYaml };
}

function healthy() {
  if (!cache.refreshedAt || lastError) return false;
  return Date.now() - Date.parse(cache.refreshedAt) < 3 * REFRESH_MINUTES * 60_000;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = (code: number, type: string, body: string) => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };
  try {
    if (url.pathname === '/health') {
      return send(healthy() ? 200 : 503, 'application/json', JSON.stringify({ ok: healthy(), refreshedAt: cache.refreshedAt, error: lastError }));
    }
    if (url.pathname === '/refresh' && req.method === 'POST') {
      await refresh();
      return send(lastError ? 502 : 200, 'application/json', JSON.stringify({ refreshedAt: cache.refreshedAt, error: lastError }));
    }
    if (url.pathname === '/export') {
      const { configYaml, donations } = build();
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="handprint-${today()}.json"`,
        'cache-control': 'no-store',
      });
      return res.end(JSON.stringify(makeBundle(configYaml, donations), null, 1));
    }
    if (url.pathname === '/api/summary') {
      const { summary, donations, warnings } = build();
      return send(200, 'application/json', JSON.stringify({ ...summary, donations, warnings, refreshedAt: cache.refreshedAt, error: lastError }, null, 2));
    }
    const page = pageFor(url.pathname);
    if (page) {
      const { summary, warnings, breakdown, milestones } = build();
      return send(200, 'text/html; charset=utf-8', renderPage(summary, { page, brand: BRAND, refreshedAt: cache.refreshedAt, error: lastError, warnings, breakdown, milestones }));
    }
    // Vendored OFL fonts (see fonts/LICENSE.md), immutable so the browser keeps them.
    const font = /^\/fonts\/([a-z-]+\.woff2)$/.exec(url.pathname);
    if (font) {
      const file = path.join(FONT_DIR, font[1]);
      if (!fs.existsSync(file)) return send(404, 'text/plain', 'not found');
      res.writeHead(200, { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' });
      return res.end(fs.readFileSync(file));
    }
    send(404, 'text/plain', 'not found');
  } catch (e) {
    send(500, 'text/plain', `Error: ${(e as Error).message}`);
  }
});

server.listen(PORT, () => console.log(`Listening on :${PORT}, refreshing every ${REFRESH_MINUTES} min`));
void refresh();
setInterval(() => void refresh(), REFRESH_MINUTES * 60_000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
