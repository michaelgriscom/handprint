// Read-only share links for the browser build: the whole export, deflated and
// base64url-encoded into the URL fragment. Nothing is uploaded; the fragment never
// leaves the browser, and whoever opens the link gets a snapshot they can keep or close.
import { Bundle, parseBundle } from './view';

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes.slice().buffer as ArrayBuffer]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Compact form of a bundle, without the export timestamp and derived `year` fields. */
export async function encodeShare(b: Bundle): Promise<string> {
  const lean = { c: b.configYaml, d: b.donations.map((d) => [d.date, d.amount, d.recipient, d.note ?? '', d.ea === false ? 0 : 1]) };
  return b64url(await pipe(new TextEncoder().encode(JSON.stringify(lean)), new CompressionStream('deflate-raw')));
}

export async function decodeShare(s: string): Promise<Bundle> {
  let lean: any;
  try {
    lean = JSON.parse(new TextDecoder().decode(await pipe(unb64url(s), new DecompressionStream('deflate-raw'))));
  } catch {
    throw new Error('This share link is damaged or incomplete.');
  }
  if (typeof lean?.c !== 'string' || !Array.isArray(lean.d)) throw new Error('This share link is not a giving tracker snapshot.');
  const donations = lean.d.map((r: unknown[]) => ({ date: r[0], amount: r[1], recipient: r[2], note: r[3] || undefined, ea: r[4] !== 0, source: 'csv' }));
  return parseBundle(JSON.stringify({ format: 'pledge-tracker', version: 1, exportedAt: '', configYaml: lean.c, donations })).bundle;
}

export const SHARE_PARAM = 'share=';
export const shareFromHash = (hash: string): string | null => (hash.startsWith('#' + SHARE_PARAM) ? hash.slice(1 + SHARE_PARAM.length) : null);
