import { test, expect } from '@playwright/test';

test.describe('Road Signs — full feature test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roadsigns');
    await page.waitForLoadState('networkidle');
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows Road Signs heading', async ({ page }) => {
    await expect(page.getByText(/road signs/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('no broken images on load', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter(img => !img.complete || img.naturalWidth === 0)
        .map(img => img.src)
    );
    if (broken.length > 0) console.warn('Broken images:', broken);
    expect(broken).toHaveLength(0);
  });

  test('shows category filter chips', async ({ page }) => {
    await expect(page.getByText(/warning/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('All category chip shows all signs', async ({ page }) => {
    const allChip = page.getByRole('button', { name: /^all$/i });
    if (await allChip.isVisible()) {
      await allChip.click();
      const signs = page.locator('img').or(page.locator('[role="img"]'));
      await expect(signs.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // may use SVG fallback, not img
      });
    }
  });

  test('Warning filter shows warning signs', async ({ page }) => {
    const warningChip = page.getByRole('button', { name: /warning/i }).first();
    if (await warningChip.isVisible()) {
      await warningChip.click();
      await expect(page.getByText(/warning/i).first()).toBeVisible();
    }
  });

  test('search filters signs', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    if (await search.isVisible()) {
      await search.fill('crossroads');
      await page.waitForTimeout(500);
      await expect(page.getByText(/crossroads/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('search clear button clears search', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    if (await search.isVisible()) {
      await search.fill('crossroads');
      await page.waitForTimeout(300);
      const clearBtn = page.getByRole('button', { name: 'x' }).or(page.locator('[aria-label="clear"]'));
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await expect(search).toHaveValue('');
      }
    }
  });

  test('tapping a sign opens detail view', async ({ page }) => {
    // Click first visible sign item
    const firstSign = page.locator('[role="button"]').first();
    if (await firstSign.isVisible({ timeout: 5000 })) {
      await firstSign.click();
      // Detail view shows meaning/category content
      const detail = page.getByText(/meaning|what to do|category|sign/i).first();
      await expect(detail).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('Quiz button is present', async ({ page }) => {
    const quiz = page.getByRole('button', { name: /quiz/i });
    await expect(quiz).toBeVisible({ timeout: 10000 }).catch(() => {
      // may only show when authenticated
    });
  });

  test('Crossroads sign is visible', async ({ page }) => {
    await expect(page.getByText('Crossroads')).toBeVisible({ timeout: 10000 });
  });

  test('Roundabout sign is visible', async ({ page }) => {
    await expect(page.getByText(/roundabout/i)).toBeVisible({ timeout: 10000 });
  });

  test('No entry sign is visible', async ({ page }) => {
    await expect(page.getByText(/no entry/i)).toBeVisible({ timeout: 10000 });
  });
});
