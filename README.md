# Wardrobe Stylist

A free, personal wardrobe app for one Android phone. Add each piece of clothing with one photo; the app reads the type, color and details, suggests outfits that suit the occasion and the weather, answers questions like "how many white shirts do I have?", keeps a dated log of what you wore, and learns from your ratings and rejections.

Everything stays on the phone. There is no account, no server and no cost.

## What it does

- **Add clothes:** one photo per item, any angle, several at once. Gemini (free tier) tags the type, details (zipper, buttons, sleeveless, ripped, wash or shade), colors, formality and warmth. You confirm or fix any tag with one tap. Colors are also measured from the photo's pixels.
- **Outfits for an occasion:** Office (smart casual), Casual, Date, Party, Festive, Gym, Travel, Home, plus your own. Every sensible combination is built (top + bottom + shoes, jackets, open shirts over tees, knit layers), filtered by the occasion and the forecast, and ranked by the style rules. Gemini then reorders the best ones with one-line reasons.
- **Ask in plain words:** "office tomorrow", "how many white shirts do I have?", "what did I wear last Friday?", "what goes with my beige jacket?". Works offline with a built-in keyword parser.
- **Log:** "Wear this" saves the outfit with the date, tags, an optional note, a mirror selfie and a 1-5 rating. Calendar and list views.
- **Reject:** block an exact outfit, two items together, a color pairing (for example black tops with green bottoms) or an item. Undo any of these in Settings.
- **Check my outfit:** put an outfit together and see its score, the reasons and the stylist's opinion. "I like this" teaches the app.
- **Backup:** one file with everything, including photos. Your API keys are never included.

## Install on your Android phone

1. Open the app's GitHub Pages address in **Chrome** on the phone.
2. Tap the menu (three dots), then **Install app** (or **Add to Home screen**).
3. Open it from the home screen. It works offline from then on.
4. In **Settings > Backup**, tap **Protect storage** if it is not protected yet.

## Get a free Gemini key (no billing)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and sign in.
2. Create an API key in a **new project without a billing account**. Without billing, no charges are possible.
3. Optional but recommended: in the Google Cloud console, restrict the key to the **Generative Language API**.
4. In the app, open **Settings > AI**, paste the key under Gemini and tap **Test connection**.

The model ID is a setting (default `gemini-3.8-flash`), so a model rename never breaks the app. Free-tier requests (clothing photos and text) may be used by Google to improve its products. Selfies never leave the phone.

## If the free AI goes away

The app needs AI only to read photos and to understand free-form text. Outfits, counts, the log and rejections run on the phone without it.

- **Another free cloud AI:** in Settings, choose Groq (free tier, default vision model `qwen/qwen3.8-27b`) or OpenRouter (pick a free vision model whose ID ends in `:free`) as the main or fallback provider. On a rate limit, server error or timeout, the app tries the fallback, then tags by hand or uses the keyword parser.
- **On-device AI:** Settings > AI > **Download on-device AI** (about 54 MB on phones with GPU support, 94 MB otherwise). Marqo FashionSigLIP then tags photos offline. Fields it is unsure about stay blank for you.
- **No AI:** colors come from the photo pixels and you tap the type and details.

A model running on your PC is not supported: an HTTPS web app cannot call a plain-HTTP server on your Wi-Fi.

## Backups

Your data lives only on the phone. Back up after adding clothes and at least every two weeks (the app reminds you after 14 days): **Settings > Backup > Back up now**, then save the file to Google Drive or email it to yourself. **Restore** shows what the file contains and asks before replacing anything.
## Put it online for free (GitHub Pages)

GitHub Pages is free for public repositories. The repository holds only code: no keys, photos or personal data ever leave your phone.

1. Create an empty **public** repository on GitHub, for example `wardrobe`.
2. In this folder run:
   ```
   git remote add origin https://github.com/<you>/wardrobe.git
   git push -u origin main
   ```
3. On GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` lints, type-checks, runs the unit and end-to-end tests, builds with the right base path and deploys. The address is `https://<you>.github.io/wardrobe/`.

Prefer private code? Cloudflare Pages is free for private repositories: build command `npm run build`, output folder `dist`.

## Develop

Requires Node.js 20 or newer. On Windows PowerShell use `npm.cmd` if script execution is disabled.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (Vitest), including the style test outfits |
| `npm run test:e2e` | End-to-end test on a phone-sized Chromium (AI and weather mocked) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Production build into `dist/` (set `BASE_PATH=/repo-name/` for Pages) |
| `npm run verify:dist` | Checks the build: manifest, offline service worker, icons, CSP, black theme |
| `npm run icons` | Regenerates the app icons |
| `npm run labels` | Rebuilds the on-device label embeddings (`public/models/`) with the FashionSigLIP text model |

## How outfits are scored

The rules live in `src/engine/style-rules.ts` and use item properties, never specific items, so they work for anything you buy later:

- **Color:** the best fit among contrast (light top, dark bottom), tonal (white + cream + beige), monochrome, a neutral base with one accent, and color-wheel pairs. Shades that almost match (two navies, faded vs deep black) are penalized using the CIEDE2000 color difference.
- **Formality:** pieces at a similar level of dress, matched to the occasion.
- **Shoes and layers:** shoes that suit the bottoms; layers that stand apart from the top.
- **Weather:** at 30 °C or more no jackets; below 16 °C layers rank higher; at 10 °C or less a layer is required if you own one; suede is penalized on rainy days.
- **Rotation:** items worn in the last 4 days (a setting) move down; identical items share the penalty.
- **Your taste:** wears, ratings and likes nudge similar outfits by at most 15 points. Rejections always win.

Sources for each rule: [docs/style-sources.md](docs/style-sources.md).

**Tuning:** change the named constants at the top of `style-rules.ts` and run `npm test`. About 60 test outfits in `tests/style-cases.ts` must keep passing (good ones score 70 or more, bad ones 45 or less, blocked ones are stopped). Add your own cases to teach the rules your taste.

## On-device AI accuracy check

To check FashionSigLIP on your own photos: download on-device AI, set the main and fallback providers to None, add your 13 example items, and count how many types came out right (target: 11 or more). Record the result here:

| Date | Phone | Correct types (of 13) | Notes |
| --- | --- | --- | --- |
| | | | |

## Privacy and security

- API keys are typed into Settings, stored only on the phone, shown masked and left out of backups.
- Only clothing photos and short text go to the AI provider you choose. Selfies never leave the phone.
- A Content Security Policy limits network access to the AI providers, Open-Meteo and Hugging Face (for the one-time on-device model download).
- Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0), free for non-commercial use without a key.

## Credits

Marqo FashionSigLIP (on-device tagging), Transformers.js and ONNX Runtime Web, Inter typeface (SIL Open Font License), Lucide icons, Motion for animations, Dexie for storage.
