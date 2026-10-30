import type { AttrKey, Category, ItemAttrs, Slot } from './types';
import { getShade } from './palette';

export interface ItemTypeDef {
  id: string;
  label: string;
  plural: string;
  category: Category;
  /** Slots the item can fill. The first one is its usual slot. */
  slots: Slot[];
  formality: number;
  warmth: number;
  athletic?: boolean;
  ethnic?: boolean;
  defaults: Partial<ItemAttrs>;
  synonyms: string[];
}

export const CATEGORIES: { id: Category; label: string; plural: string }[] = [
  { id: 'tops', label: 'Top', plural: 'Tops' },
  { id: 'layers', label: 'Layer', plural: 'Layers' },
  { id: 'outerwear', label: 'Outerwear', plural: 'Outerwear' },
  { id: 'bottoms', label: 'Bottom', plural: 'Bottoms' },
  { id: 'shoes', label: 'Shoes', plural: 'Shoes' },
];

export const ITEM_TYPES: ItemTypeDef[] = [
  // Tops
  { id: 'tshirt', label: 'T-shirt', plural: 'T-shirts', category: 'tops', slots: ['base'], formality: 2, warmth: 1,
    defaults: { sleeve: 'short', neck: 'crew', material: 'cotton' },
    synonyms: ['t-shirt', 't-shirts', 'tshirt', 'tshirts', 't shirt', 't shirts', 'tee', 'tees'] },
  { id: 'polo', label: 'Polo', plural: 'Polos', category: 'tops', slots: ['base'], formality: 3, warmth: 1,
    defaults: { closure: 'buttons', sleeve: 'short', neck: 'polo-collar', material: 'cotton' },
    synonyms: ['polo', 'polos', 'polo shirt', 'polo shirts', 'polo tshirt', 'polo tshirts', 'polo t-shirt', 'polo t-shirts', 'polo tee', 'polotshirt'] },
  { id: 'shirt', label: 'Shirt', plural: 'Shirts', category: 'tops', slots: ['base', 'mid'], formality: 3, warmth: 1,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'spread-collar', material: 'cotton', canOpen: true },
    synonyms: ['shirt', 'shirts', 'button-up', 'button up', 'button-down shirt', 'formal shirt', 'formal shirts', 'casual shirt', 'casual shirts', 'oxford shirt', 'dress shirt', 'dress shirts'] },
  { id: 'tank', label: 'Tank top', plural: 'Tank tops', category: 'tops', slots: ['base'], formality: 1, warmth: 1,
    defaults: { sleeve: 'sleeveless', neck: 'scoop', material: 'cotton' },
    synonyms: ['tank', 'tanks', 'tank top', 'tank tops', 'singlet', 'singlets', 'vest', 'vests', 'banian', 'muscle tee', 'sleeveless top', 'sleeveless tops'] },
  { id: 'henley', label: 'Henley', plural: 'Henleys', category: 'tops', slots: ['base'], formality: 2, warmth: 1,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'henley', material: 'cotton' }, synonyms: ['henley', 'henleys'] },
  { id: 'turtleneck', label: 'Turtleneck', plural: 'Turtlenecks', category: 'tops', slots: ['base'], formality: 3, warmth: 2,
    defaults: { sleeve: 'long', neck: 'turtleneck', material: 'knit' }, synonyms: ['turtleneck', 'turtlenecks', 'polo neck', 'mock neck'] },
  { id: 'kurta', label: 'Kurta', plural: 'Kurtas', category: 'tops', slots: ['base'], formality: 3, warmth: 1, ethnic: true,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'band-collar', material: 'cotton' }, synonyms: ['kurta', 'kurtas', 'kurti', 'sherwani'] },
  // Layers
  { id: 'sweatshirt', label: 'Sweatshirt', plural: 'Sweatshirts', category: 'layers', slots: ['base', 'mid'], formality: 2, warmth: 2,
    defaults: { sleeve: 'long', neck: 'crew', material: 'fleece' }, synonyms: ['sweatshirt', 'sweatshirts', 'crewneck sweatshirt'] },
  { id: 'sweater', label: 'Sweater', plural: 'Sweaters', category: 'layers', slots: ['mid', 'base'], formality: 3, warmth: 2,
    defaults: { sleeve: 'long', neck: 'crew', material: 'knit' },
    synonyms: ['sweater', 'sweaters', 'jumper', 'jumpers', 'pullover', 'pullovers', 'knit', 'knits', 'knitwear'] },
  { id: 'cardigan', label: 'Cardigan', plural: 'Cardigans', category: 'layers', slots: ['mid'], formality: 3, warmth: 2,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'v-neck', material: 'knit' }, synonyms: ['cardigan', 'cardigans'] },
  { id: 'hoodie', label: 'Hoodie', plural: 'Hoodies', category: 'layers', slots: ['mid', 'base'], formality: 1, warmth: 2,
    defaults: { sleeve: 'long', neck: 'hooded', material: 'fleece' }, synonyms: ['hoodie', 'hoodies', 'hoody', 'hooded sweatshirt'] },
  { id: 'vest', label: 'Waistcoat / Nehru jacket', plural: 'Waistcoats', category: 'layers', slots: ['mid'], formality: 4, warmth: 1,
    defaults: { closure: 'buttons', sleeve: 'sleeveless', neck: 'band-collar', material: 'wool' },
    synonyms: ['waistcoat', 'waistcoats', 'nehru jacket', 'nehru jackets', 'modi jacket', 'gilet'] },
  // Outerwear
  { id: 'jacket', label: 'Jacket', plural: 'Jackets', category: 'outerwear', slots: ['outer'], formality: 3, warmth: 2,
    defaults: { closure: 'zipper', sleeve: 'long', material: 'synthetic' },
    synonyms: ['jacket', 'jackets', 'zip jacket', 'zipper jacket', 'harrington', 'light jacket'] },
  { id: 'denim-jacket', label: 'Denim jacket', plural: 'Denim jackets', category: 'outerwear', slots: ['outer'], formality: 2, warmth: 2,
    defaults: { closure: 'buttons', sleeve: 'long', material: 'denim', wash: 'medium' },
    synonyms: ['denim jacket', 'denim jackets', 'jean jacket', 'jean jackets', 'trucker jacket'] },
  { id: 'bomber', label: 'Bomber jacket', plural: 'Bomber jackets', category: 'outerwear', slots: ['outer'], formality: 2, warmth: 2,
    defaults: { closure: 'zipper', sleeve: 'long', material: 'synthetic' }, synonyms: ['bomber', 'bombers', 'bomber jacket', 'bomber jackets', 'varsity jacket'] },
  { id: 'leather-jacket', label: 'Leather jacket', plural: 'Leather jackets', category: 'outerwear', slots: ['outer'], formality: 3, warmth: 2,
    defaults: { closure: 'zipper', sleeve: 'long', material: 'leather' }, synonyms: ['leather jacket', 'leather jackets', 'biker jacket'] },
  { id: 'blazer', label: 'Blazer', plural: 'Blazers', category: 'outerwear', slots: ['outer'], formality: 4, warmth: 2,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'lapel', material: 'wool' },
    synonyms: ['blazer', 'blazers', 'sport coat', 'sports coat', 'suit jacket'] },
  { id: 'overshirt', label: 'Overshirt', plural: 'Overshirts', category: 'outerwear', slots: ['outer'], formality: 3, warmth: 1,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'spread-collar', material: 'cotton' }, synonyms: ['overshirt', 'overshirts', 'shacket', 'shirt jacket'] },
  { id: 'coat', label: 'Coat', plural: 'Coats', category: 'outerwear', slots: ['outer'], formality: 4, warmth: 3,
    defaults: { closure: 'buttons', sleeve: 'long', neck: 'lapel', material: 'wool' },
    synonyms: ['coat', 'coats', 'overcoat', 'overcoats', 'trench', 'trench coat', 'peacoat', 'topcoat'] },
  { id: 'puffer', label: 'Puffer jacket', plural: 'Puffer jackets', category: 'outerwear', slots: ['outer'], formality: 2, warmth: 3,
    defaults: { closure: 'zipper', sleeve: 'long', material: 'synthetic' },
    synonyms: ['puffer', 'puffers', 'puffer jacket', 'down jacket', 'quilted jacket', 'winter jacket'] },
  { id: 'windbreaker', label: 'Windbreaker', plural: 'Windbreakers', category: 'outerwear', slots: ['outer'], formality: 1, warmth: 1,
    defaults: { closure: 'zipper', sleeve: 'long', material: 'synthetic' }, synonyms: ['windbreaker', 'windbreakers', 'windcheater', 'rain jacket', 'raincoat', 'anorak'] },
  { id: 'track-jacket', label: 'Track jacket', plural: 'Track jackets', category: 'outerwear', slots: ['outer'], formality: 1, warmth: 1, athletic: true,
    defaults: { closure: 'zipper', sleeve: 'long', material: 'synthetic' }, synonyms: ['track jacket', 'track jackets', 'track top'] },
  // Bottoms
  { id: 'jeans', label: 'Jeans', plural: 'Jeans', category: 'bottoms', slots: ['bottom'], formality: 3, warmth: 2,
    defaults: { material: 'denim', wash: 'medium', fit: 'regular' }, synonyms: ['jeans', 'jean', 'denims', 'denim pants', 'denim jeans'] },
  { id: 'chinos', label: 'Chinos', plural: 'Chinos', category: 'bottoms', slots: ['bottom'], formality: 3, warmth: 1,
    defaults: { material: 'cotton', fit: 'slim' }, synonyms: ['chinos', 'chino', 'khakis', 'chino pants'] },
  { id: 'trousers', label: 'Trousers', plural: 'Trousers', category: 'bottoms', slots: ['bottom'], formality: 4, warmth: 2,
    defaults: { material: 'wool', fit: 'tapered' }, synonyms: ['trousers', 'trouser', 'formal pants', 'dress pants', 'slacks', 'formal trousers'] },
  { id: 'cargo', label: 'Cargo pants', plural: 'Cargo pants', category: 'bottoms', slots: ['bottom'], formality: 2, warmth: 2,
    defaults: { material: 'cotton', fit: 'relaxed' }, synonyms: ['cargo', 'cargos', 'cargo pants', 'cargo trousers'] },
  { id: 'joggers', label: 'Joggers', plural: 'Joggers', category: 'bottoms', slots: ['bottom'], formality: 1, warmth: 2,
    defaults: { material: 'jersey', fit: 'tapered' }, synonyms: ['joggers', 'jogger', 'sweatpants', 'sweat pants', 'lowers'] },
  { id: 'track-pants', label: 'Track pants', plural: 'Track pants', category: 'bottoms', slots: ['bottom'], formality: 1, warmth: 1, athletic: true,
    defaults: { material: 'synthetic' }, synonyms: ['track pants', 'trackpants', 'trackies'] },
  { id: 'shorts', label: 'Shorts', plural: 'Shorts', category: 'bottoms', slots: ['bottom'], formality: 2, warmth: 1,
    defaults: { material: 'cotton' }, synonyms: ['shorts', 'short pants', 'bermudas', 'chino shorts'] },
  { id: 'gym-shorts', label: 'Gym shorts', plural: 'Gym shorts', category: 'bottoms', slots: ['bottom'], formality: 1, warmth: 1, athletic: true,
    defaults: { material: 'synthetic' }, synonyms: ['gym shorts', 'running shorts', 'sports shorts'] },
  { id: 'pyjama', label: 'Pyjama / churidar', plural: 'Pyjamas', category: 'bottoms', slots: ['bottom'], formality: 3, warmth: 1, ethnic: true,
    defaults: { material: 'cotton' }, synonyms: ['pyjama', 'pyjamas', 'pajama', 'pajamas', 'churidar', 'churidars', 'dhoti', 'salwar'] },
  // Shoes
  { id: 'sneakers', label: 'Sneakers', plural: 'Sneakers', category: 'shoes', slots: ['shoes'], formality: 2, warmth: 1,
    defaults: { closure: 'laces', material: 'leather' }, synonyms: ['sneakers', 'sneaker', 'kicks', 'trainers', 'casual shoes'] },
  { id: 'running-shoes', label: 'Running shoes', plural: 'Running shoes', category: 'shoes', slots: ['shoes'], formality: 1, warmth: 1, athletic: true,
    defaults: { closure: 'laces', material: 'mesh' }, synonyms: ['running shoes', 'sports shoes', 'runners', 'training shoes', 'gym shoes'] },
  { id: 'loafers', label: 'Loafers', plural: 'Loafers', category: 'shoes', slots: ['shoes'], formality: 4, warmth: 1,
    defaults: { closure: 'slip-on', material: 'leather' }, synonyms: ['loafers', 'loafer', 'moccasins', 'penny loafers'] },
  { id: 'formal-shoes', label: 'Formal shoes', plural: 'Formal shoes', category: 'shoes', slots: ['shoes'], formality: 5, warmth: 1,
    defaults: { closure: 'laces', material: 'leather' },
    synonyms: ['formal shoes', 'oxfords', 'oxford shoes', 'derby', 'derbies', 'derby shoes', 'brogues', 'dress shoes', 'monk straps'] },
  { id: 'boots', label: 'Boots', plural: 'Boots', category: 'shoes', slots: ['shoes'], formality: 3, warmth: 2,
    defaults: { closure: 'laces', material: 'leather' }, synonyms: ['boots', 'boot', 'chelsea boots', 'chelseas', 'chukkas', 'desert boots'] },
  { id: 'sandals', label: 'Sandals', plural: 'Sandals', category: 'shoes', slots: ['shoes'], formality: 1, warmth: 1,
    defaults: { closure: 'straps', material: 'leather' }, synonyms: ['sandals', 'sandal', 'floaters'] },
  { id: 'slides', label: 'Slides / flip-flops', plural: 'Slides', category: 'shoes', slots: ['shoes'], formality: 1, warmth: 1,
    defaults: { closure: 'slip-on', material: 'synthetic' }, synonyms: ['slides', 'flip flops', 'flip-flops', 'slippers', 'chappals', 'chappal', 'crocs'] },
  { id: 'mojari', label: 'Mojari / juttis', plural: 'Mojaris', category: 'shoes', slots: ['shoes'], formality: 3, warmth: 1, ethnic: true,
    defaults: { closure: 'slip-on', material: 'leather' }, synonyms: ['mojari', 'mojaris', 'jutti', 'juttis', 'kolhapuri', 'kolhapuris'] },
];
const TYPE_MAP = new Map(ITEM_TYPES.map((t) => [t.id, t]));
export const TYPE_IDS = ITEM_TYPES.map((t) => t.id);

export function getType(id: string): ItemTypeDef {
  const t = TYPE_MAP.get(id);
  if (!t) throw new Error(`Unknown item type: ${id}`);
  return t;
}
export function findType(id: string | undefined): ItemTypeDef | undefined {
  return id ? TYPE_MAP.get(id) : undefined;
}
export function categoryOf(typeId: string): Category {
  return getType(typeId).category;
}
export function canFill(typeId: string, slot: Slot): boolean {
  return getType(typeId).slots.includes(slot);
}

export const ATTR_LABELS: Record<AttrKey, { label: string; values: Record<string, string> }> = {
  closure: { label: 'Closure', values: { none: 'None', buttons: 'Buttons', zipper: 'Zipper', 'half-zip': 'Half-zip', snaps: 'Snaps', laces: 'Laces', 'slip-on': 'Slip-on', straps: 'Straps' } },
  sleeve: { label: 'Sleeves', values: { na: 'N/A', sleeveless: 'Sleeveless', short: 'Short', 'three-quarter': '3/4', long: 'Full' } },
  neck: { label: 'Neck / collar', values: { na: 'N/A', crew: 'Crew', 'v-neck': 'V-neck', 'polo-collar': 'Polo collar', 'button-down': 'Button-down', 'spread-collar': 'Spread collar', 'band-collar': 'Band / mandarin', hooded: 'Hooded', turtleneck: 'Turtleneck', lapel: 'Lapel', henley: 'Henley', scoop: 'Scoop' } },
  pattern: { label: 'Pattern', values: { solid: 'Solid', stripes: 'Stripes', checks: 'Checks', graphic: 'Graphic', print: 'Print', floral: 'Floral', textured: 'Textured', colorblock: 'Color-block', camo: 'Camo', 'small-logo': 'Small logo' } },
  wash: { label: 'Denim wash', values: { na: 'N/A', raw: 'Raw', dark: 'Dark', medium: 'Medium', light: 'Light', black: 'Black', grey: 'Grey', acid: 'Acid / stone', ombre: 'Ombre / shaded', bleached: 'Bleached' } },
  distress: { label: 'Distress', values: { none: 'Clean', faded: 'Faded', ripped: 'Ripped', heavy: 'Heavily ripped' } },
  fit: { label: 'Fit', values: { na: 'N/A', slim: 'Slim', regular: 'Regular', relaxed: 'Relaxed', oversized: 'Oversized', skinny: 'Skinny', straight: 'Straight', tapered: 'Tapered', wide: 'Wide' } },
  material: { label: 'Material', values: { cotton: 'Cotton', linen: 'Linen', denim: 'Denim', wool: 'Wool', knit: 'Knit', leather: 'Leather', suede: 'Suede', synthetic: 'Synthetic', silk: 'Silk', fleece: 'Fleece', corduroy: 'Corduroy', canvas: 'Canvas', mesh: 'Mesh', jersey: 'Jersey', other: 'Other' } },
};

export const FORMALITY_LABELS: Record<number, string> = { 1: 'Lounge / sport', 2: 'Casual', 3: 'Smart casual', 4: 'Business', 5: 'Formal' };
export const WARMTH_LABELS: Record<number, string> = { 1: 'Light', 2: 'Medium', 3: 'Warm' };

export function isDenim(typeId: string, attrs: Pick<ItemAttrs, 'material'>): boolean {
  return attrs.material === 'denim' || typeId === 'jeans' || typeId === 'denim-jacket';
}

/** Attribute groups worth showing for an item type. */
export function relevantAttrs(typeId: string, attrs: Pick<ItemAttrs, 'material'>): AttrKey[] {
  const cat = getType(typeId).category;
  const list: AttrKey[] = [];
  if (cat === 'tops' || cat === 'layers' || cat === 'outerwear') list.push('closure', 'sleeve', 'neck');
  if (cat === 'shoes') list.push('closure');
  list.push('pattern');
  if (cat !== 'shoes') list.push('fit');
  list.push('material');
  if (isDenim(typeId, attrs)) list.push('wash');
  if (cat === 'bottoms' || isDenim(typeId, attrs)) list.push('distress');
  return list;
}

export const BASE_ATTRS: ItemAttrs = {
  closure: 'none', sleeve: 'na', neck: 'na', pattern: 'solid', wash: 'na', distress: 'none', fit: 'regular', material: 'cotton', canOpen: false,
};

export function defaultAttrs(typeId: string): ItemAttrs {
  const t = getType(typeId);
  const attrs: ItemAttrs = { ...BASE_ATTRS, ...t.defaults };
  if (t.category === 'shoes') attrs.fit = 'na';
  return attrs;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Formality from the item type, adjusted by details (zip vs buttons, rips, washes, graphics). */
export function defaultFormality(typeId: string, attrs: ItemAttrs): number {
  const t = getType(typeId);
  let f = t.formality;
  if ((typeId === 'jacket' || typeId === 'overshirt') && attrs.closure === 'zipper') f -= 1;
  if (typeId === 'shirt' && attrs.sleeve === 'short') f -= 1;
  if (attrs.pattern === 'graphic' || attrs.pattern === 'camo') f -= 1;
  if (attrs.distress === 'ripped') f -= 1;
  if (attrs.distress === 'heavy') f -= 2;
  if (['light', 'acid', 'ombre', 'bleached'].includes(attrs.wash)) f -= 1;
  if (attrs.material === 'linen' && t.category === 'tops') f -= 0;
  return clamp(f, 1, 5);
}

export function defaultWarmth(typeId: string, attrs: ItemAttrs): number {
  const t = getType(typeId);
  let w = t.warmth;
  if (attrs.sleeve === 'sleeveless') w = 1;
  if ((attrs.material === 'wool' || attrs.material === 'fleece') && t.category !== 'shoes') w += 1;
  if (attrs.material === 'linen' || attrs.material === 'mesh') w -= 1;
  return clamp(w, 1, 3);
}

/** Short human name, e.g. "Black zip jacket" or "Blue-green shaded jeans". */
export function autoName(typeId: string, shadeId: string | undefined, attrs: ItemAttrs): string {
  const t = getType(typeId);
  const shade = shadeId ? getShade(shadeId)?.name : undefined;
  const bits: string[] = [];
  if (typeId === 'jacket' && attrs.closure === 'zipper') bits.push('zip');
  if (typeId === 'jacket' && attrs.closure === 'buttons') bits.push('button');
  if (attrs.distress === 'ripped' || attrs.distress === 'heavy') bits.push('ripped');
  if (attrs.wash === 'ombre') bits.push('shaded');
  if (attrs.wash === 'acid') bits.push('acid-wash');
  if (typeId === 'polo' && attrs.sleeve === 'long') bits.push('full-sleeve');
  if (typeId === 'shirt' && attrs.sleeve === 'short') bits.push('half-sleeve');
  if (attrs.pattern !== 'solid' && attrs.pattern !== 'small-logo' && attrs.pattern !== 'textured') bits.push(ATTR_LABELS.pattern.values[attrs.pattern].toLowerCase());
  const label = t.label.toLowerCase().replace('t-shirt', 'T-shirt');
  const name = [shade, ...bits, label].filter(Boolean).join(' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}
