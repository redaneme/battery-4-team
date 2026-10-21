import { test, expect } from '@playwright/test';
import { createOrder, login, postStatus, readHistory, readVersion } from './helpers';

/**
 * E2E-031 허용되지 않은 상태 변경은 직접 요청해도 거부된다
 *
 * 화면에는 허용된 다음 상태 버튼만 있지만, 서버도 같은 규칙으로 막는지 확인한다.
 * 버튼이 없는 요청이라 상태 변경 요청을 직접 보낸다(page.request).
 *   1. '확정' 주문을 '완료'로 바로 바꾸기(단계 건너뛰기)
 *   2. '완료' 주문을 '취소'로 바꾸기(최종 상태)
 * 두 경우 모두 상태가 그대로이고 이력 행이 늘지 않아야 한다.
 */
test('E2E-031 허용되지 않은 상태 변경은 직접 요청해도 거부된다', async ({ page }) => {
  await login(page);

  // 1. 확정 → 완료 (건너뛰기)
  const confirmedId = await createOrder(page, { memo: 'E2E-031 확정' });
  const confirmedVersion = await readVersion(page, confirmedId);

  const html1 = await postStatus(page, confirmedId, 'COMPLETED', confirmedVersion);
  expect(html1).toContain('확정 상태에서는 완료(으)로 바꿀 수 없습니다');

  await page.goto(`/orders/${confirmedId}`);
  await expect(page.locator('h1 .badge')).toHaveText('확정');
  expect(await readHistory(page)).toEqual(['- → 확정']);

  // 2. 완료 → 취소 (최종 상태). 완료 주문은 화면에 version 이 없어 변경 횟수로 계산한다.
  const doneId = await createOrder(page, { memo: 'E2E-031 완료' });
  const v0 = await readVersion(page, doneId);
  await postStatus(page, doneId, 'IN_PROGRESS', v0);
  await postStatus(page, doneId, 'COMPLETED', v0 + 1);

  const html2 = await postStatus(page, doneId, 'CANCELED', v0 + 2);
  expect(html2).toContain('완료 상태에서는 취소(으)로 바꿀 수 없습니다');

  await page.goto(`/orders/${doneId}`);
  await expect(page.locator('h1 .badge')).toHaveText('완료');
  await expect(page.getByText('최종 상태라 더 바꿀 수 없습니다.')).toBeVisible();
  expect(await readHistory(page)).toEqual(['- → 확정', '확정 → 진행', '진행 → 완료']);
});
