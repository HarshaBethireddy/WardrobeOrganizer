# Style rules and where they come from

Every outfit score comes from `src/engine/style-rules.ts` (scoring) and `src/engine/filters.ts` plus `src/domain/occasions.ts` (hard rules). The rules use item properties (type, formality, layer, material, and each shade's lightness, chroma and hue), never specific items, so they work for anything you buy later.

The guides below were read in October 2026. Their advice is paraphrased here; follow the links for the originals.

## Sources

1. Westwood Hart, [A practical guide to pairing colours](https://westwoodhart.com/blogs/westwood-hart/mens-fashion-color-combinations-guide-pairing-colours): neutrals (black, grey, white, beige, brown, cream, navy, taupe) combine reliably and form the base of a wardrobe.
2. Westwood Hart, [How to match patterns and colors in men's style](https://westwoodhart.com/blogs/westwood-hart/how-match-patterns-colors-mens-style): neutrals in the largest garments; analogous colors for harmony; complementary colors for bold contrast, best in smaller pieces; let one or two pieces lead.
3. Real Men Real Style, [Color theory for men's style](https://www.realmenrealstyle.com/mans-introduction-color/): white shirts and grey or navy bases act as neutral canvases for accents.
4. color-analysis.app, [How to match clothes colors](https://color-analysis.app/blog/how-to-match-clothing-colors-guide): four reliable schemes (monochromatic, analogous, complementary, triad) plus a neutral where the eye can rest.
5. G-Face, [Streetwear color matching formulas](https://blog.gfacegear.com/blog/streetwear-color-matching): a neutral base with one accent, or a tonal outfit built from shades of one color.
6. Jos. A. Bank, [Men's smart casual guide](https://www.josbank.com/blog/mens-smart-casual-guide): chinos, trousers and dark clean jeans all work; frayed or rumpled pieces are casual, not smart casual.
7. DMARGE, [Smart casual dress code](https://dmarge.com/style/smart-casual-dress-code-men): jeans are fine in dark blue or black washes; ripped or distressed denim is not.
8. Nimble Made, [Smart casual dress code for men](https://www.nimble-made.com/blogs/news/smart-casual-dress-code-for-men): a collared shirt or polo, chinos or dark denim, clean shoes, and an optional jacket.
9. Sartoro, [What is smart casual](https://sartoro.co/blogs/sartorial/smart-casual-dress-code): at least one dressed-up piece, such as a collared shirt, a jacket or leather shoes.
10. The Jeans Blog, [How to wear double denim](https://thejeansblog.com/jeans-advice/how-to-wear-double-denim/): when wearing denim on denim, make the washes clearly different.
11. Black Lapel, [Mixing patterns with confidence](https://blacklapel.com/blogs/the-compass/mixing-patterns-with-confidence) and Mr. Cavaliere, [How to mix patterns](https://mrcavaliere.com/blogs/style-manual/how-to-mix-patterns-men): two patterns only work when their scale is managed.
12. CIE, CIEDE2000 color-difference formula (via the [culori](https://culorijs.org/) library): the standard way to measure how different two colors look.

## Rules and their sources

| Rule | Where in code | Sources |
| --- | --- | --- |
| Light top with dark bottom (or the reverse) scores as clean contrast | `colorAnalysis`, `CONTRAST_L` | 3, 10 |
| Tonal: clearly different shades of one color story (white + cream + beige, light blue + navy) | `isTonal`, `TONAL_GROUPS` | 4, 5 |
| Monochrome: one shade head to toe (all black) | `isMonochrome` | 4, 5 |
| Neutral base plus one accent color | `neutral-accent` pattern | 1, 2, 5 |
| Two accents that are neighbors or opposites on the color wheel | `color-wheel` pattern | 2, 4 |
| Soft, muted accent pairs sit together | `muted` pattern, `MUTED_C` | 1, 4 |
| Two accents that are neither neighbors nor opposites, or three or more accents, are penalized | `unrelatedAccents`, `tooManyAccents` | 2, 4 |
| Two bright, saturated colors from different families clash | `brightClash` | 2 |
| Shades that almost match (two navies, faded vs deep black, white vs ivory) look like a mistake; the CIEDE2000 difference between `MATCH_DE` and `CLEAR_DE` triggers a penalty | `nearMiss`, `src/lib/colorMath.ts` | 10, 12 |
| Denim on denim needs clearly different washes | `denimSameWash` | 10 |
| Two bold patterns compete (the app can't judge pattern scale, so it plays safe) | `boldPatterns` | 2, 11 |
| Every piece at a similar level of dress; a spread of more than 2 levels is filtered out | `formalityScore`, `MAX_FORMALITY_SPREAD` | 6, 9 |
| Shoes match the bottoms' level of dress; white sneakers keep casual bottoms clean | `shoeScore` | 6, 8 |
| Office means smart casual: shirts and polos, chinos or clean dark, blue or black jeans, clean shoes, a jacket on top; no tank tops, ripped or shaded jeans, or graphic tees | `occasions.ts` (office) | 6, 7, 8, 9 |
| A plain tee at the office only under a jacket | `minUpperFormality` | 9 |

## Tuning

Change the named constants at the top of `style-rules.ts` (`WEIGHTS`, `PATTERN_SCORES`, `PENALTIES`, `WEATHER`) and run `npm test`. The test outfits in `tests/style-cases.ts` (good outfits must score 70 or more, bad ones 45 or less, blocked ones must be stopped) catch rule changes that make outfits look worse. To add your own taste, add outfits to that file. Style links you send later can be turned into new cases the same way.
