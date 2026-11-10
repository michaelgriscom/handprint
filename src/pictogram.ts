import { ICONS } from './icons';

// Unit charts for the impact figures: one glyph per unit while that stays countable,
// otherwise one glyph per round batch. The last glyph fills partway for a fraction.

const ONE_EACH = 50; // up to this many, every unit gets its own glyph
const MAX = 25; // otherwise, the most glyphs a row may hold

/** Two significant figures: these are rough estimates, so more digits would overstate them. */
export const round2sig = (n: number) => (n > 0 ? Number(n.toPrecision(2)) : 0);

/** How many units one glyph stands for (1, 2, 5, 10, 20, 50, ...). */
export function glyphScale(n: number): number {
  if (n <= ONE_EACH) return 1;
  for (let m = 1; ; m *= 10) for (const k of [2, 5, 10]) if (n / (k * m) <= MAX) return k * m;
}

/** Whole glyphs, plus how much of one more to fill (0 when it would be a sliver). */
export function glyphCount(n: number): { each: number; full: number; part: number } {
  const each = glyphScale(n);
  const units = n / each;
  let full = Math.floor(units + 1e-9);
  let part = Math.round((units - full) * 10) / 10;
  if (part >= 1) { full += 1; part = 0; }
  return { each, full, part };
}

// A filled figure on a 12×24 grid; everything else reuses the 24×24 stroke icons.
const PERSON =
  '<circle cx="6" cy="3.5" r="3"/><path d="M2.5 8h7a2.5 2.5 0 0 1 2.5 2.5v6a1.2 1.2 0 0 1-2.4 0v-5H9v11.2a1.4 1.4 0 0 1-2.8 0v-6.2h-.4v6.2a1.4 1.4 0 0 1-2.8 0V11.5h-.6v5a1.2 1.2 0 0 1-2.4 0v-6A2.5 2.5 0 0 1 2.5 8Z"/>';

/** Units that count people get silhouettes. */
export const isPeople = (unit: string) => /^(lives|life|people|persons?|child|children|infants?|famil|girls|boys|women|men|students|patients)/i.test(unit.trim());

function glyph(icon: string, people: boolean): string {
  return people
    ? `<svg class="g person" viewBox="0 0 12 24" fill="currentColor">${PERSON}</svg>`
    : `<svg class="g" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon] ?? ICONS.sparkle}</svg>`;
}

/** The glyph row for an (already rounded) amount, with a key when a glyph stands for more than one. */
export function pictogram(amount: number, unit: string, icon: string, large = false): string {
  const { each, full, part } = glyphCount(amount);
  if (full + part <= 0) return '';
  const g = glyph(icon, isPeople(unit));
  const partial = part > 0 ? `<span class="part">${g}<span style="clip-path:inset(0 ${Math.round((1 - part) * 100)}% 0 0)">${g}</span></span>` : '';
  const key = each > 1 ? `<div class="picto-key">${g} = ${each.toLocaleString('en-US', { notation: each >= 10_000 ? 'compact' : 'standard' })}</div>` : '';
  return `<div class="picto${large ? ' lg' : ''}" aria-hidden="true">${g.repeat(full)}${partial}</div>${key}`;
}
