import { expect, test } from '@playwright/test';
import { ITEMS, garmentPng, mockServices } from './fixtures';

test('a full day: add clothes, plan the office, log, rate, reject, check, back up and restore', async ({ page }) => {
  await mockServices(page);

  // Settings: free Gemini key and a city for the forecast.
  await page.goto('/#/settings');
  await page.getByLabel('Gemini API key').fill('test-key-123456');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/^test.*3456$/)).toBeVisible();
  await page.getByLabel('Search your city').fill('Bengaluru');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: /Bengaluru/ }).click();

  // Bulk add: all photos at once, each one reviewed and saved.
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByTestId('gallery-input').first().setInputFiles(ITEMS.map((i) => ({ name: i.file, mimeType: 'image/png', buffer: garmentPng(i.hex) })));
  for (const item of ITEMS) {
    await expect(page.getByLabel('Name')).toHaveValue(item.tag.name, { timeout: 30_000 });
    const save = page.getByRole('button', { name: 'Save item' });
    await expect(save).toBeEnabled();
    await save.click();
  }
  await expect(page.getByRole('heading', { name: 'Wardrobe', level: 1 })).toBeVisible();
  await expect(page.getByText(`${ITEMS.length} pieces`)).toBeVisible();

  // Ask in plain words; Gemini (mocked) understands it, the rules build outfits, the stylist reorders them.
  await page.getByRole('link', { name: 'Ask' }).click();
  await page.getByLabel('Ask', { exact: true }).fill('office tomorrow');
  await page.getByLabel('Ask', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Outfits for office' })).toBeVisible();
  await expect(page.getByText('Stylist reviewed')).toBeVisible();
  const cards = page.locator('article[aria-label^="Outfit scored"]');
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText('Crisp and office-ready')).toBeVisible();

  // Wear this: tag it and save to the log.
  await cards.first().getByRole('button', { name: 'Wear this' }).click();
  await page.getByLabel('Add a tag').fill('client meeting');
  await page.getByRole('button', { name: 'Save to log' }).click();
  await expect(page.getByText('Saved to your log')).toBeVisible();
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('#client meeting')).toBeVisible();
  await page.getByRole('radio', { name: '4 stars' }).click();
  await expect(page.getByText(/Rated 4/)).toBeVisible();
  // Reject a color pairing and confirm it is gone.
  await page.goBack();
  await expect(cards.first()).toBeVisible();
  await cards.first().getByRole('button', { name: 'Reject' }).click();
  const colorOption = page.getByRole('radiogroup', { name: 'Color pairing' }).getByRole('radio').first();
  const label = (await colorOption.textContent())?.trim() ?? '';
  await colorOption.click();
  await page.getByRole('button', { name: 'Never show this' }).click();
  await expect(page.getByText(`Hidden: ${label}`)).toBeVisible();
  await expect(page.getByText(/hidden by your rejections/)).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  // Check my outfit and teach the app.
  await page.getByRole('link', { name: 'Check' }).click();
  for (const [slot, name] of [['Top', 'White shirt'], ['Bottom', 'Black jeans'], ['Shoes', 'White sneakers']]) {
    await page.getByRole('button', { name: new RegExp(`^${slot}`) }).click();
    await page.getByRole('dialog').getByText(name, { exact: true }).click();
  }
  await expect(page.getByText('Light top, dark jeans: clean contrast')).toBeVisible();
  await page.getByRole('button', { name: 'Ask stylist' }).click();
  await expect(page.getByText('Sharp and simple. The contrast reads well.')).toBeVisible();
  await page.getByRole('button', { name: 'I like this' }).click();
  await expect(page.getByText(/Similar outfits will rank higher/)).toBeVisible();

  // Back up, archive an item, restore, and the item is back.
  await page.getByRole('link', { name: 'Settings' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up now' }).click();
  const file = await (await download).path();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Black shirt' }).click();
  await page.getByRole('button', { name: 'Remove (archive)' }).click();
  await expect(page.getByText(`${ITEMS.length - 1} pieces`)).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('restore-input').setInputFiles(file!);
  await expect(page.getByText('Restore this backup?')).toBeVisible();
  await page.getByRole('button', { name: 'Replace all data' }).click();
  await expect(page.getByText(/Restored/)).toBeVisible();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByText(`${ITEMS.length} pieces`)).toBeVisible();
});

test('works offline without AI: keyword questions and rules-only outfits', async ({ page, context }) => {
  await page.goto('/#/ask');
  await expect(page.getByRole('heading', { name: 'What are we wearing?' })).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel('Ask', { exact: true }).fill('how many white shirts do I have?');
  await page.getByLabel('Ask', { exact: true }).press('Enter');
  await expect(page.getByText(/don't have any white shirts|You have/)).toBeVisible();
  await expect(page.getByText(/Understood as/)).toBeVisible();
  await context.setOffline(false);
});
