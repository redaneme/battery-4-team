import { test, expect } from '@playwright/test';
import { changeStatusByButton, createOrder, login } from './helpers';

/**
 * E2E-033 취소 직후에는 이전 페이지로 이동한다
 *
 * 정한 동작(PRD 7장): 취소 직후 이전 페이지(주문 목록)로 이동하고 오류 화면이 열리지 않는다.
 * 현재 구현: 삭제된 주문의 상세(/orders/{번호})로 이동해 HTTP 500 기본 오류 화면(Whitelabel Error Page)이 열린다.
 *           (알려진 결함: INTENT 9장 1번)
 *
 * 고치기 전까지 test.fail() 로 표시한다. 이 테스트는 "실패하는 것이 정상"이다.
 * 고치고 나면 test.fail() 줄을 지워 일반 테스트로 전환한다. (고친 뒤에도 test.fail() 이 남아 있으면
 * 테스트가 통과하면서 "예상한 실패가 일어나지 않았다"며 오히려 실패로 보고되어 알 수 있다.)
 */
test('E2E-033 취소 직후에는 이전 페이지(주문 목록)로 이동한다', async ({ page }) => {
  test.fail(true, '알려진 결함: 취소 후 삭제된 주문 상세로 이동해 HTTP 500 (INTENT 9장 1번)');

  await login(page);
  const id = await createOrder(page, { memo: 'E2E-033' });

  // 목록에서 들어와 상세로 간다 ("이전 페이지"는 주문 목록)
  await page.goto('/orders');
  await page.locator(`a[href="/orders/${id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${id}$`));

  await changeStatusByButton(page, '취소');

  // 정한 동작: 주문 목록으로 이동하고 오류 화면이 아니다
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole('heading', { name: '주문 목록' })).toBeVisible();
  await expect(page.getByText('Whitelabel Error Page')).toHaveCount(0);
});
