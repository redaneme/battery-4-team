import { test, expect } from '@playwright/test';

test('비밀번호가 틀리면 로그인 화면에 머물고 오류 메시지가 보인다', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('wrong-password');
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/login(;jsessionid=.*)?$/);
  await expect(page.locator('.alert.error')).toBeVisible();
});
