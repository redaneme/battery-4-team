import { test, expect, type Page } from '@playwright/test';
import { changeStatusByButton, chipCount, createOrder, login } from './helpers';

/**
 * E2E-032 확정·진행 주문을 취소하면 목록에서 사라지고 이력은 남는다
 *
 * 취소하면 주문 행은 삭제되고 상태 이력만 남는다(확정된 정책).
 *   - 주문 목록에서 해당 주문이 사라진다.
 *   - 취소해도 '취소' 칩 건수는 늘지 않고, '취소' 필터에도 나오지 않는다.
 *   - 확정 주문과 진행 주문 모두 같은 결과다.
 *
 * 한계: 시나리오의 "DB(order_status_history)에 이력이 남아 있다" 확인은 화면에서 볼 수 없고
 *       Playwright 에서 DB 에 붙을 수 없어 이 테스트에 넣지 않았다. (JUnit/수동 확인 필요)
 * 참고: 취소 직후 이동하는 화면은 현재 HTTP 500 이다(E2E-033). 이 테스트는 그 화면을 보지 않고
 *       목록을 직접 연다.
 */
async function expectCancelRemovesOrder(page: Page, orderId: number) {
  // 취소 전 상태 기록
  await page.goto('/orders');
  const canceledBefore = await chipCount(page, '취소');

  // 상세에서 취소
  await page.goto(`/orders/${orderId}`);
  await changeStatusByButton(page, '취소');

  // 목록을 직접 연다: 주문이 사라졌고, 전체 건수는 표의 행 수와 맞는다
  await page.goto('/orders');
  await expect(page.locator(`a[href="/orders/${orderId}"]`)).toHaveCount(0);
  expect(await chipCount(page, '전체')).toBe(await page.locator('table tbody tr').count());

  // '취소' 건수는 늘지 않고, '취소' 필터에도 나오지 않는다
  const canceledAfter = await chipCount(page, '취소');
  expect(canceledAfter).toBe(canceledBefore);
  await page.goto('/orders?status=CANCELED');
  await expect(page.locator(`a[href="/orders/${orderId}"]`)).toHaveCount(0);
  if (canceledAfter === 0) {
    await expect(page.getByText('주문이 없습니다.')).toBeVisible();
  }
}

test.describe('E2E-032 취소하면 주문은 삭제된다', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("'확정' 주문을 취소하면 목록에서 사라진다", async ({ page }) => {
    const id = await createOrder(page, { memo: 'E2E-032 확정' });
    await expectCancelRemovesOrder(page, id);
  });

  test("'진행' 주문을 취소해도 목록에서 사라진다", async ({ page }) => {
    const id = await createOrder(page, { memo: 'E2E-032 진행' });
    await page.goto(`/orders/${id}`);
    await changeStatusByButton(page, '진행');
    await expect(page.locator('h1 .badge')).toHaveText('진행');
    await expectCancelRemovesOrder(page, id);
  });
});
