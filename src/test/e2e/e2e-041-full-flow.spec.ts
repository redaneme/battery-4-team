import { test, expect } from '@playwright/test';
import { changeStatusByButton, chipCount, login, readHistory } from './helpers';

/**
 * E2E-041 로그인부터 완료·로그아웃까지 한 번에 진행한다 (대표 스모크 테스트)
 *
 * 로그인 → 주문 추가 → 시뮬레이션 → '운항비 최소' 선택·메모·확정 → 진행 → 완료
 * → 목록의 '완료' 필터 → 로그아웃. 화면만 사용해 끝까지 이어지는지 본다.
 *
 * 주문이 1건 생기고 '완료' 상태라 취소할 수 없다. (테스트 DB 에 남는다)
 * 건수는 다른 테스트가 동시에 주문을 만들 수 있어 "늘었다(>=)"로 확인한다.
 */
test('E2E-041 로그인부터 완료·로그아웃까지 한 번에 진행한다', async ({ page }) => {
  // 1. 로그인
  await login(page);
  const completedBefore = await chipCount(page, '완료');

  // 2. [주문 추가]에서 기본 수량으로 시뮬레이션
  await page.locator('header').getByRole('link', { name: '주문 추가' }).click();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await page.getByRole('button', { name: '시뮬레이션 실행' }).click();
  await expect(page.locator('#options .option')).toHaveCount(3);

  // 3. '운항비 최소'를 선택하고 메모를 적어 [주문 확정] → 상세 화면, 상태 '확정'
  // (다른 테스트가 그 사이 마스터를 바꿔 확정이 거부되면 다시 시뮬레이션해서 확정한다. 최대 3번)
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.locator('#options .option', { hasText: '운항비 최소' }).click();
    await expect(page.locator('#summary')).toContainText('운항비 최소');
    await page.locator('#memo').fill('E2E-041 종단 흐름');
    await page.getByRole('button', { name: '주문 확정' }).click();
    const moved = await page
      .waitForURL(/\/orders\/\d+$/, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (moved) break;
    await expect(page.locator('#confirmError')).toContainText('마스터 데이터가 바뀌었습니다');
    await page.getByRole('button', { name: '시뮬레이션 실행' }).click();
    await expect(page.locator('#options .option')).toHaveCount(3);
  }
  await expect(page).toHaveURL(/\/orders\/\d+$/);
  const orderId = Number(page.url().match(/\/orders\/(\d+)$/)![1]);
  await expect(page.locator('h1 .badge')).toHaveText('확정');

  // 4. '진행' → '완료'로 차례로 바꾼다 → 이력 3행, 더 바꿀 수 없다
  await changeStatusByButton(page, '진행');
  await expect(page.locator('h1 .badge')).toHaveText('진행');
  await changeStatusByButton(page, '완료');
  await expect(page.locator('h1 .badge')).toHaveText('완료');
  expect(await readHistory(page)).toEqual(['- → 확정', '확정 → 진행', '진행 → 완료']);
  await expect(page.getByText('최종 상태라 더 바꿀 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: /으\)로 변경/ })).toHaveCount(0);

  // 5. 주문 목록에서 '완료' 칩 → 방금 주문이 보이고 '완료' 건수가 늘었다
  await page.getByRole('link', { name: '목록으로' }).click();
  await page.locator('.filters .chip', { hasText: '완료' }).click();
  await expect(page).toHaveURL(/status=COMPLETED/);
  const row = page.locator('table tbody tr', { has: page.locator(`a[href="/orders/${orderId}"]`) });
  await expect(row).toBeVisible();
  await expect(row.locator('.badge')).toHaveText('완료');
  expect(await chipCount(page, '완료')).toBeGreaterThanOrEqual(completedBefore + 1);

  // 6. 로그아웃 → 로그인 화면, 다시 /orders 에 가도 로그인 화면
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login$/);
});
