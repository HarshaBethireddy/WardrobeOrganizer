import { ITEM_TYPES, ATTR_LABELS, FORMALITY_LABELS } from '@/domain/taxonomy';
import { SHADES, FAMILIES } from '@/domain/palette';
import type { OccasionProfile } from '@/domain/occasions';
import type { Item } from '@/domain/types';
import { getType } from '@/domain/taxonomy';
import { getShade } from '@/domain/palette';

const list = (o: Record<string, string>) => Object.keys(o).join(', ');

export const TAG_SYSTEM = `You catalog menswear from photos for a personal wardrobe app.
The photo shows ONE clothing item or one pair of shoes, from any angle, possibly on a bed, floor or hanger.
Describe it using ONLY the allowed values. Be precise about details:
- closure: zipper vs buttons vs half-zip (a "t-shirt with zipper" is half-zip), laces/slip-on for shoes.
- sleeve: sleeveless (tank tops), short, long.
- denim: wash (raw/dark/medium/light/black/grey/acid/ombre/bleached; "ombre" = gradient or two-tone shaded denim such as blue fading to green) and distress (none/faded/ripped/heavy).
- pattern: graphic = large print or slogan; small-logo = small chest logo only.
- canOpen: true for button-up shirts that can be worn open over a tee.
- formality 1-5: ${Object.entries(FORMALITY_LABELS).map(([k, v]) => `${k}=${v}`).join(', ')}. Ripped/shaded jeans and graphic tees are casual (2 or less). A zip casual jacket is less formal than a buttoned one.
- warmth 1-3: 1=light, 2=medium, 3=warm.
- primaryShade = the main garment color (ignore the background), secondaryShade = a clear second color or "none".
- name: a short name like "Black zip jacket" or "Blue-green shaded jeans".
Set isClothing=false if it is not clothing or shoes, and itemCount to the number of separate garments visible.`;

export function tagPrompt(): string {
  return [
    'Allowed types: ' + ITEM_TYPES.map((t) => `${t.id} (${t.label})`).join(', '),
    'Allowed shades: ' + SHADES.map((s) => `${s.id} (${s.name} ${s.hex})`).join(', '),
    ...Object.entries(ATTR_LABELS).map(([k, v]) => `Allowed ${k}: ${list(v.values)}`),
    'Return the JSON object only.',
  ].join('\n');
}

export const shortItem = (i: Item) => `${i.id}: ${i.name} (${getType(i.type).label}, ${getShade(i.primaryShade)?.name ?? i.primaryShade}, ${i.attrs.material})`;

export const PARSE_SYSTEM = `You turn a request to a personal wardrobe app into a JSON request. Kinds:
- inventory: questions about owned clothes ("how many white shirts", "show my black stuff", "any ripped jeans"). mode=count for "how many", otherwise list. Use families for color words (white includes off-white, ivory, cream), shades for exact shades, types for garment types ("shirt" means button-up shirts only), categories for broad words (tops, layers, outerwear, bottoms, shoes; "pants" = bottoms). attributes are "key:value" strings, e.g. "distress:ripped", "closure:zipper".
- outfit: asking what to wear. occasionId from the list, date as YYYY-MM-DD (default today), include/exclude item ids mentioned ("with my beige jacket", "no black shirt").
- log: asking what was worn on a date or range. from/to as YYYY-MM-DD; optional occasionId and tags.
- unknown: anything else.
Use only ids from the lists.`;

export function parsePrompt(text: string, today: string, timeZone: string, occasions: OccasionProfile[], items: Item[]): string {
  return [
    `Today is ${today} (${new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}), time zone ${timeZone}.`,
    'Occasions: ' + occasions.map((o) => `${o.id} (${o.name})`).join(', '),
    'Types: ' + ITEM_TYPES.map((t) => t.id).join(', '),
    'Families: ' + FAMILIES.map((f) => f.id).join(', '),
    'Shades: ' + SHADES.map((s) => s.id).join(', '),
    'Attribute keys: ' + Object.entries(ATTR_LABELS).map(([k, v]) => `${k}=[${list(v.values)}]`).join('; '),
    'Owned items:',
    ...items.slice(0, 250).map(shortItem),
    `Request: """${text.slice(0, 400)}"""`,
  ].join('\n');
}

export const REVIEW_SYSTEM = `You are a menswear stylist. Reorder the given outfits from best to worst for the occasion and weather.
For each outfit give a reason of at most 15 words and an optional concern ("" if none). Use only the given ids; include each id once.`;

export function reviewPrompt(occ: OccasionProfile, weather: string, outfits: { id: string; text: string }[]): string {
  return [`Occasion: ${occ.name}. ${occ.description}`, `Weather: ${weather}`, 'Outfits:', ...outfits.map((o) => `${o.id}: ${o.text}`)].join('\n');
}

export const CHECK_SYSTEM = `You are a menswear stylist giving a quick honest opinion on an outfit for an occasion.
Reply with an opinion of exactly two sentences. If one swap from the listed alternatives would clearly improve it, give swapSlot and swapItemId and a short swapReason; otherwise swapSlot="none", swapItemId="" and swapReason="".`;

export function checkPrompt(occ: OccasionProfile, weather: string, outfit: string, alternatives: string[]): string {
  return [`Occasion: ${occ.name}. ${occ.description}`, `Weather: ${weather}`, `Outfit: ${outfit}`, 'Alternatives the user owns:', ...alternatives].join('\n');
}
