import { test, expect } from '@playwright/test';

test('로그인하면 주문 목록으로 이동한다', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('admin');
  await page.locator('form button[type="submit"], form input[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/orders$/);
});
