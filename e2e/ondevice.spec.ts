import { expect, test } from '@playwright/test';
import { garmentPng } from './fixtures';

// Downloads the real FashionSigLIP image model (about 61 MB) from Hugging Face. Run with: ONDEVICE=1 npm run test:e2e
test.skip(!process.env.ONDEVICE, 'Set ONDEVICE=1 to download and run the real on-device model');

test('on-device AI downloads, loads in the browser runtime and tags a photo offline', async ({ page, context }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Download on-device AI' }).click();
  const status = page.getByTestId('ondevice-status').filter({ hasText: /^Ready: runs on|session|ConvInteger|failed|missing|backend/i });
  await expect(status).toBeVisible({ timeout: 840_000 });
  console.log('on-device status:', await status.textContent());
  await expect(page.getByText(/^Ready: runs on/)).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByTestId('gallery-input').first().setInputFiles({ name: 'jeans.png', mimeType: 'image/png', buffer: garmentPng('#2a3b57') });
  await expect(page.getByText('Tagged on this phone')).toBeVisible({ timeout: 180_000 });
  console.log('picked type chip:', await page.locator('button[aria-pressed="true"]').allTextContents());
  await context.setOffline(false);
  expect(errors.filter((e) => /ConvInteger|session/i.test(e))).toEqual([]);
});
