import type { Item, ItemAttrs, OutfitSlots } from '@/domain/types';
import type { WeatherDay } from '@/engine/types';
import { mk, wx } from './helpers';

export interface StyleCase { label: string; occasion: string; expect: 'good' | 'bad' | 'blocked'; items: Item[]; slots: OutfitSlots; weather?: WeatherDay; pattern?: string }

const P = (type: string, shade: string, attrs: Partial<ItemAttrs> = {}) => mk(type, shade, attrs);
/** base, bottom, shoes, then optional outer and mid. */
function c(label: string, occasion: string, expect: StyleCase['expect'], base: Item, bottom: Item, shoes: Item | null, outer?: Item | null, mid?: Item | null, extra: Partial<StyleCase> = {}): StyleCase {
  const items = [base, bottom, shoes, outer, mid].filter((x): x is Item => !!x);
  const slots: OutfitSlots = { base: base.id, bottom: bottom.id };
  if (shoes) slots.shoes = shoes.id;
  if (outer) slots.outer = outer.id;
  if (mid) slots.mid = mid.id;
  return { label, occasion, expect, items, slots, ...extra };
}

const whiteSneakers = () => P('sneakers', 'white');
const loafers = (s = 'brown') => P('loafers', s);

export const GOOD: StyleCase[] = [
  c('contrast: white shirt, dark jeans, white sneakers', 'office', 'good', P('shirt', 'white'), P('jeans', 'denim-dark', { wash: 'dark' }), whiteSneakers(), null, null, { pattern: 'contrast' }),
  c('contrast: light blue shirt, navy chinos, brown loafers', 'office', 'good', P('shirt', 'light-blue'), P('chinos', 'navy'), loafers()),
  c('contrast: white shirt, charcoal trousers, black formal shoes', 'office', 'good', P('shirt', 'white'), P('trousers', 'charcoal'), P('formal-shoes', 'black')),
  c('contrast: black tee, light grey chinos, white sneakers', 'date', 'good', P('tshirt', 'black'), P('chinos', 'light-grey'), whiteSneakers()),
  c('contrast: white tee, black jeans, white sneakers', 'casual', 'good', P('tshirt', 'white'), P('jeans', 'black', { wash: 'black' }), whiteSneakers()),
  c('contrast: white shirt, black jeans, black boots', 'party', 'good', P('shirt', 'white'), P('jeans', 'black', { wash: 'black' }), P('boots', 'black')),
  c('layers: white shirt, beige button jacket, dark jeans', 'office', 'good', P('shirt', 'white'), P('jeans', 'denim-dark', { wash: 'dark' }), whiteSneakers(), P('jacket', 'beige', { closure: 'buttons' })),
  c('contrast: heather grey sweatshirt, dark jeans', 'casual', 'good', P('sweatshirt', 'heather-grey'), P('jeans', 'denim-dark', { wash: 'dark' }), whiteSneakers()),
  c('tonal: white shirt, cream chinos, tan loafers', 'date', 'good', P('shirt', 'white'), P('chinos', 'cream'), loafers('tan'), null, null, { pattern: 'tonal' }),
  c('tonal: off-white tee, beige chinos', 'casual', 'good', P('tshirt', 'off-white'), P('chinos', 'beige'), whiteSneakers()),
  c('tonal greys: heather tee, charcoal joggers', 'casual', 'good', P('tshirt', 'heather-grey'), P('joggers', 'charcoal'), whiteSneakers()),
  c('tonal greens: sage tee, forest green chinos', 'casual', 'good', P('tshirt', 'sage'), P('chinos', 'forest-green'), whiteSneakers()),
  c('tonal blues: light blue shirt, navy blazer, navy chinos', 'office', 'good', P('shirt', 'light-blue'), P('chinos', 'navy'), loafers(), P('blazer', 'navy')),
  c('monochrome: all black for a party', 'party', 'good', P('shirt', 'black'), P('jeans', 'black', { wash: 'black' }), P('boots', 'black'), null, null, { pattern: 'monochrome' }),
  c('monochrome: navy polo, navy chinos', 'casual', 'good', P('polo', 'navy'), P('chinos', 'navy'), whiteSneakers()),
  c('accent: burgundy shirt, dark jeans', 'casual', 'good', P('shirt', 'burgundy'), P('jeans', 'denim-dark', { wash: 'dark' }), whiteSneakers()),
  c('accent: olive overshirt over white tee, dark jeans', 'casual', 'good', P('tshirt', 'white'), P('jeans', 'denim-dark', { wash: 'dark' }), whiteSneakers(), P('overshirt', 'olive')),
  c('accent: mustard sweater over white shirt, navy chinos', 'date', 'good', P('shirt', 'white'), P('chinos', 'navy'), loafers(), null, P('sweater', 'mustard')),
  c('navy + rust: rust tee, navy chinos', 'casual', 'good', P('tshirt', 'rust'), P('chinos', 'navy'), whiteSneakers()),
  c('color wheel: sky blue shirt, teal chinos', 'casual', 'good', P('shirt', 'sky-blue'), P('chinos', 'teal'), whiteSneakers()),
  c('muted pair: dusty rose tee, sage chinos', 'casual', 'good', P('tshirt', 'dusty-rose'), P('chinos', 'sage'), whiteSneakers()),
  c('open shirt over white tee, khaki chinos', 'casual', 'good', P('tshirt', 'white'), P('chinos', 'khaki'), whiteSneakers(), null, P('shirt', 'light-blue', { pattern: 'checks' })),
  c('open olive shirt over black tank, black jeans', 'casual', 'good', P('tank', 'black'), P('jeans', 'black', { wash: 'black' }), whiteSneakers(), null, P('shirt', 'olive')),
  c('navy sweater over white shirt, grey trousers', 'office', 'good', P('shirt', 'white'), P('trousers', 'grey'), P('formal-shoes', 'black'), null, P('sweater', 'navy')),
  c('camel coat, white shirt, navy chinos, brown boots', 'date', 'good', P('shirt', 'white'), P('chinos', 'navy'), P('boots', 'brown'), P('coat', 'camel')),
  c('12\u00b0C: blazer over white shirt, grey trousers', 'office', 'good', P('shirt', 'white'), P('trousers', 'grey'), loafers('black'), P('blazer', 'navy'), null, { weather: wx(12, 6) }),
  c('32\u00b0C: white tank, khaki shorts, slides', 'casual', 'good', P('tank', 'white'), P('shorts', 'khaki'), P('slides', 'black'), null, null, { weather: wx(33, 26) }),
  c('festive: cream kurta, white pyjama, mojaris', 'festive', 'good', P('kurta', 'cream'), P('pyjama', 'white'), P('mojari', 'tan')),
  c('festive: maroon kurta, cream churidar, mojaris', 'festive', 'good', P('kurta', 'maroon'), P('pyjama', 'cream'), P('mojari', 'tan')),
  c('gym: black tee, grey gym shorts, running shoes', 'gym', 'good', P('tshirt', 'black'), P('gym-shorts', 'grey'), P('running-shoes', 'white')),
  c('travel: grey hoodie, black joggers, white sneakers', 'travel', 'good', P('hoodie', 'heather-grey'), P('joggers', 'black'), whiteSneakers()),
];
export const BAD: StyleCase[] = [
  c('near-miss navies', 'office', 'bad', P('shirt', 'navy'), P('chinos', 'midnight-navy'), loafers()),
  c('faded black next to deep black', 'office', 'bad', P('shirt', 'black'), P('jeans', 'faded-black', { wash: 'black', distress: 'faded' }), P('sneakers', 'black')),
  c('same-wash denim on denim', 'casual', 'bad', P('tshirt', 'white'), P('jeans', 'denim-medium'), whiteSneakers(), P('denim-jacket', 'denim-medium')),
  c('clashing brights: yellow and royal blue', 'casual', 'bad', P('tshirt', 'yellow'), P('shorts', 'royal-blue'), whiteSneakers()),
  c('clashing brights: red and royal blue', 'casual', 'bad', P('tshirt', 'red'), P('chinos', 'royal-blue'), whiteSneakers()),
  c('stripes with checks', 'casual', 'bad', P('tshirt', 'navy', { pattern: 'stripes' }), P('shorts', 'khaki', { pattern: 'checks' }), whiteSneakers()),
  c('floral shirt with camo cargos', 'casual', 'bad', P('shirt', 'sky-blue', { pattern: 'floral' }), P('cargo', 'olive', { pattern: 'camo' }), whiteSneakers()),
  c('three accent colors', 'casual', 'bad', P('shirt', 'purple'), P('chinos', 'orange'), P('sneakers', 'green')),
  c('unrelated accents: purple and mustard', 'casual', 'bad', P('tshirt', 'purple'), P('chinos', 'mustard'), whiteSneakers()),
  c('near-miss whites: white shirt, ivory chinos', 'date', 'bad', P('shirt', 'white'), P('chinos', 'ivory'), whiteSneakers()),
  c('near-miss greys: heather tee, light grey joggers', 'casual', 'bad', P('tshirt', 'heather-grey'), P('joggers', 'light-grey'), whiteSneakers()),
  c('near-miss browns: tan overshirt, camel chinos', 'casual', 'bad', P('tshirt', 'white'), P('chinos', 'camel'), whiteSneakers(), P('overshirt', 'tan')),
  c('near-miss blacks: faded black tee, black jeans', 'party', 'bad', P('tshirt', 'faded-black'), P('jeans', 'black', { wash: 'black' }), P('boots', 'black')),
];

export const BLOCKED: StyleCase[] = [
  c('sleeveless at the office', 'office', 'blocked', P('tank', 'white'), P('chinos', 'navy'), whiteSneakers()),
  c('blazer with gym shorts', 'casual', 'blocked', P('tshirt', 'white'), P('gym-shorts', 'black'), whiteSneakers(), P('blazer', 'navy')),
  c('ripped jeans at the office', 'office', 'blocked', P('shirt', 'white'), P('jeans', 'denim-medium', { distress: 'ripped' }), whiteSneakers()),
  c('graphic tee at the office', 'office', 'blocked', P('tshirt', 'black', { pattern: 'graphic' }), P('chinos', 'stone'), whiteSneakers()),
  c('shaded jeans at the office', 'office', 'blocked', P('shirt', 'black'), P('jeans', 'teal', { wash: 'ombre' }), whiteSneakers()),
  c('slides at the office', 'office', 'blocked', P('shirt', 'white'), P('chinos', 'navy'), P('slides', 'black')),
  c('hoodie under a blazer at the office', 'office', 'blocked', P('shirt', 'white'), P('trousers', 'grey'), loafers(), P('blazer', 'navy'), P('hoodie', 'grey')),
  c('tank top under a blazer', 'casual', 'blocked', P('tank', 'white'), P('chinos', 'navy'), loafers(), P('blazer', 'navy')),
  c('open shirt over a button-up shirt', 'casual', 'blocked', P('shirt', 'white'), P('chinos', 'navy'), whiteSneakers(), null, P('shirt', 'light-blue')),
  c('kurta with a denim jacket', 'festive', 'blocked', P('kurta', 'cream'), P('pyjama', 'white'), P('mojari', 'tan'), P('denim-jacket', 'denim-medium')),
  c('sneakers at a wedding', 'festive', 'blocked', P('kurta', 'cream'), P('pyjama', 'white'), whiteSneakers()),
  c('formal shoes at the gym', 'gym', 'blocked', P('tshirt', 'black'), P('gym-shorts', 'black'), P('formal-shoes', 'black')),
  c('jeans at the gym', 'gym', 'blocked', P('tshirt', 'black'), P('jeans', 'denim-dark'), P('running-shoes', 'white')),
  c('two knit layers', 'casual', 'blocked', P('sweater', 'navy'), P('chinos', 'khaki'), whiteSneakers(), null, P('cardigan', 'grey')),
  c('jacket at 33\u00b0C', 'casual', 'blocked', P('tshirt', 'white'), P('chinos', 'khaki'), whiteSneakers(), P('bomber', 'olive'), null, { weather: wx(33, 27) }),
  c('sleeveless on a date', 'date', 'blocked', P('tank', 'black'), P('jeans', 'black', { wash: 'black' }), P('boots', 'black')),
];

export const ALL_CASES = [...GOOD, ...BAD, ...BLOCKED];
