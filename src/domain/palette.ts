export type Family =
  | 'white' | 'black' | 'grey' | 'beige' | 'brown' | 'blue' | 'teal' | 'green' | 'red' | 'pink' | 'purple' | 'yellow' | 'orange' | 'multi';

export interface Shade {
  id: string;
  name: string;
  hex: string;
  family: Family;
  /** Neutrals (whites, blacks, greys, beiges, browns, navy, denim, olive) act as a base for accents. */
  neutral: boolean;
  warmth: 'warm' | 'cool' | 'neutral';
  aliases: string[];
}

const S = (id: string, name: string, hex: string, family: Family, neutral: boolean, warmth: Shade['warmth'], aliases: string[] = []): Shade => ({
  id, name, hex, family, neutral, warmth, aliases,
});

export const SHADES: Shade[] = [
  S('white', 'White', '#F7F7F5', 'white', true, 'neutral', ['pure white', 'bright white']),
  S('off-white', 'Off-white', '#ECE9E1', 'white', true, 'warm', ['off white', 'offwhite']),
  S('ivory', 'Ivory', '#F1EAD7', 'white', true, 'warm'),
  S('cream', 'Cream', '#EFE2C4', 'white', true, 'warm', ['ecru']),
  S('black', 'Black', '#111111', 'black', true, 'neutral', ['jet black', 'deep black']),
  S('faded-black', 'Faded black', '#2B2B2D', 'black', true, 'neutral', ['washed black', 'faded black']),
  S('charcoal', 'Charcoal', '#3A3D42', 'grey', true, 'cool'),
  S('dark-grey', 'Dark grey', '#55585D', 'grey', true, 'neutral', ['dark gray']),
  S('grey', 'Grey', '#85878B', 'grey', true, 'neutral', ['gray', 'mid grey']),
  S('heather-grey', 'Heather grey', '#A3A5A8', 'grey', true, 'neutral', ['heather gray', 'melange']),
  S('light-grey', 'Light grey', '#C6C8CB', 'grey', true, 'cool', ['light gray', 'silver']),
  S('beige', 'Beige', '#D8C6A5', 'beige', true, 'warm'),
  S('sand', 'Sand', '#CBB48C', 'beige', true, 'warm'),
  S('khaki', 'Khaki', '#B5A27A', 'beige', true, 'warm'),
  S('tan', 'Tan', '#C29A6B', 'beige', true, 'warm'),
  S('camel', 'Camel', '#B4834F', 'beige', true, 'warm'),
  S('stone', 'Stone', '#BDB6A6', 'beige', true, 'neutral', ['greige']),
  S('taupe', 'Taupe', '#8B7D6F', 'brown', true, 'neutral'),
  S('brown', 'Brown', '#6B4A33', 'brown', true, 'warm'),
  S('chocolate', 'Chocolate', '#452D20', 'brown', true, 'warm', ['dark brown']),
  S('cognac', 'Cognac', '#9A5A2E', 'brown', true, 'warm', ['tan leather']),
  S('navy', 'Navy', '#1F2A44', 'blue', true, 'cool', ['navy blue']),
  S('midnight-navy', 'Midnight navy', '#141B2D', 'blue', true, 'cool', ['midnight blue']),
  S('denim-dark', 'Dark denim', '#2A3B57', 'blue', true, 'cool', ['dark blue', 'indigo', 'dark denim', 'raw denim']),
  S('denim-medium', 'Mid denim', '#4D6B8E', 'blue', true, 'cool', ['mid blue', 'medium blue', 'denim blue']),
  S('denim-light', 'Light denim', '#8FA8C4', 'blue', true, 'cool', ['light denim', 'ice blue']),
  S('light-blue', 'Light blue', '#B7D0EA', 'blue', true, 'cool', ['baby blue', 'pale blue', 'oxford blue']),
  S('powder-blue', 'Powder blue', '#D3E2F1', 'blue', true, 'cool'),
  S('sky-blue', 'Sky blue', '#7FB6E8', 'blue', false, 'cool'),
  S('royal-blue', 'Royal blue', '#2D57C8', 'blue', false, 'cool', ['bright blue', 'cobalt']),
  S('teal', 'Teal', '#1E6E77', 'teal', false, 'cool', ['blue green', 'blue-green']),
  S('turquoise', 'Turquoise', '#3BA8A4', 'teal', false, 'cool', ['aqua']),
  S('petrol', 'Petrol', '#1D4B57', 'teal', false, 'cool', ['dark teal']),
  S('olive', 'Olive', '#5C5E36', 'green', true, 'warm', ['olive green', 'army green']),
  S('forest-green', 'Forest green', '#24452F', 'green', false, 'cool', ['bottle green', 'dark green']),
  S('sage', 'Sage', '#9DAE8A', 'green', false, 'warm', ['sage green']),
  S('mint', 'Mint', '#BFE2CD', 'green', false, 'cool', ['mint green']),
  S('green', 'Green', '#2E8B57', 'green', false, 'cool', ['emerald', 'kelly green']),
  S('red', 'Red', '#C1302D', 'red', false, 'warm', ['bright red']),
  S('burgundy', 'Burgundy', '#6B1F2B', 'red', false, 'warm', ['wine', 'oxblood']),
  S('maroon', 'Maroon', '#561D22', 'red', false, 'warm'),
  S('pink', 'Pink', '#F0B6C4', 'pink', false, 'warm', ['light pink', 'baby pink']),
  S('dusty-rose', 'Dusty rose', '#C4909A', 'pink', false, 'warm', ['rose', 'old rose']),
  S('lavender', 'Lavender', '#B8A9D6', 'purple', false, 'cool', ['lilac']),
  S('purple', 'Purple', '#5D3A7B', 'purple', false, 'cool', ['violet', 'plum']),
  S('mustard', 'Mustard', '#C69C26', 'yellow', false, 'warm'),
  S('yellow', 'Yellow', '#F2D23C', 'yellow', false, 'warm', ['bright yellow']),
  S('butter', 'Butter yellow', '#F3E5A3', 'yellow', false, 'warm', ['pale yellow', 'lemon']),
  S('rust', 'Rust', '#A3452A', 'orange', false, 'warm', ['brick']),
  S('terracotta', 'Terracotta', '#B65D3F', 'orange', false, 'warm'),
  S('orange', 'Orange', '#E37B2C', 'orange', false, 'warm', ['bright orange']),
  S('peach', 'Peach', '#F2BE9E', 'orange', false, 'warm', ['apricot']),
  S('multicolor', 'Multicolor', '#8A8A8A', 'multi', false, 'neutral', ['multicolour', 'colorful', 'colourful']),
];

export const FAMILIES: { id: Family; label: string; hex: string; words: string[] }[] = [
  { id: 'white', label: 'White', hex: '#F2F0EA', words: ['white', 'whites', 'whitish', 'white shade', 'white shades', 'shades of white'] },
  { id: 'black', label: 'Black', hex: '#111111', words: ['black', 'blacks'] },
  { id: 'grey', label: 'Grey', hex: '#85878B', words: ['grey', 'gray', 'greys', 'grays'] },
  { id: 'beige', label: 'Beige', hex: '#D0B88F', words: ['beige', 'beiges', 'nude'] },
  { id: 'brown', label: 'Brown', hex: '#6B4A33', words: ['brown', 'browns'] },
  { id: 'blue', label: 'Blue', hex: '#3A5D9A', words: ['blue', 'blues'] },
  { id: 'teal', label: 'Teal', hex: '#1E6E77', words: ['teal', 'teals'] },
  { id: 'green', label: 'Green', hex: '#3D7A4F', words: ['green', 'greens'] },
  { id: 'red', label: 'Red', hex: '#A3262B', words: ['red', 'reds'] },
  { id: 'pink', label: 'Pink', hex: '#E7A5B6', words: ['pink', 'pinks'] },
  { id: 'purple', label: 'Purple', hex: '#6E4B8E', words: ['purple', 'purples'] },
  { id: 'yellow', label: 'Yellow', hex: '#E2BE38', words: ['yellow', 'yellows'] },
  { id: 'orange', label: 'Orange', hex: '#D9732D', words: ['orange', 'oranges'] },
  { id: 'multi', label: 'Multicolor', hex: '#8A8A8A', words: ['multicolor', 'multicolour', 'multi color', 'multi-color'] },
];

export const SHADE_IDS = SHADES.map((s) => s.id);
export const FAMILY_IDS = FAMILIES.map((f) => f.id);
const SHADE_MAP = new Map(SHADES.map((s) => [s.id, s]));

export function getShade(id: string | undefined): Shade | undefined {
  return id ? SHADE_MAP.get(id) : undefined;
}
export function familyOf(id: string): Family {
  return SHADE_MAP.get(id)?.family ?? 'multi';
}
export function familyLabel(id: Family): string {
  return FAMILIES.find((f) => f.id === id)?.label ?? id;
}
export function shadesInFamily(family: Family): Shade[] {
  return SHADES.filter((s) => s.family === family);
}
