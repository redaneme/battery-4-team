import { test, expect } from '@playwright/test';

/**
 * 시뮬레이션 TC: 주문 수량을 넣고 "시뮬레이션 실행"을 누르면 경로 3가지 안이 나오는지 확인한다.
 * 시뮬레이션은 계산만 하고 저장하지 않으므로 DB에 주문이 남지 않는다.
 */
test('시뮬레이션을 실행하면 경로 3가지 안이 표시되고, 안을 바꾸면 요약이 바뀐다', async ({ page }) => {
  // 로그인
  await page.goto('/login');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('admin');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/orders$/);

  // 주문 추가 화면: 처음에는 결과가 보이지 않는다
  await page.goto('/orders/new');
  await expect(page.locator('#result')).toBeHidden();

  // 기본 수량(총 12,000K)으로 시뮬레이션 실행
  await page.getByRole('button', { name: '시뮬레이션 실행' }).click();

  // 결과 영역과 3가지 안이 나타난다
  await expect(page.locator('#result')).toBeVisible();
  const options = page.locator('#options .option');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toContainText('운항비 최소');
  await expect(options.nth(1)).toContainText('가장 빠르게');
  await expect(options.nth(2)).toContainText('가까운 곳부터');

  // 처음에는 "운항비 최소" 안이 선택되어 있고, 요약에도 그 이름이 나온다
  await expect(options.nth(0)).toHaveClass(/selected/);
  await expect(page.locator('#summary')).toContainText('운항비 최소');

  // "가장 빠르게" 안을 누르면 선택과 요약이 바뀐다
  await options.nth(1).click();
  await expect(options.nth(1)).toHaveClass(/selected/);
  await expect(page.locator('#summary')).toContainText('가장 빠르게');
});
