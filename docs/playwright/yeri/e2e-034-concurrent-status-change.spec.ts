import { test, expect } from '@playwright/test';
import { changeStatusByButton, createOrder, login, readHistory } from './helpers';

/**
 * E2E-034 두 사람이 같은 주문을 동시에 바꾸면 먼저 한 쪽만 인정된다
 *
 * 두 사람(브라우저 컨텍스트 2개, 각자 로그인)이 같은 '확정' 주문 상세를 열어 둔다.
 *   - A: [진행(으)로 변경] → 성공
 *   - B: (새로 고치지 않은 낡은 화면에서) [취소(으)로 변경] → 충돌로 거부
 * B 의 요청은 낙관적 락(version)에 걸려야 하고, A 의 변경이 덮어써지거나 주문이 삭제되면 안 된다.
 */
test('E2E-034 같은 주문을 동시에 바꾸면 먼저 한 쪽만 인정된다', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  try {
    await login(a);
    await login(b);
    const id = await createOrder(a, { memo: 'E2E-034' });

    // 두 사람이 같은 주문 상세를 연다 (같은 version 을 본다)
    await a.goto(`/orders/${id}`);
    await b.goto(`/orders/${id}`);
    await expect(a.locator('h1 .badge')).toHaveText('확정');
    await expect(b.locator('h1 .badge')).toHaveText('확정');

    // A 가 먼저 '진행'으로 바꾼다
    await changeStatusByButton(a, '진행');
    await expect(a.locator('h1 .badge')).toHaveText('진행');
    await expect(a.locator('.alert.ok')).toContainText("상태를 '진행'(으)로 바꿨습니다");

    // B 는 새로 고치지 않은 낡은 화면에서 '취소'를 누른다
    await changeStatusByButton(b, '취소');
    await expect(b.locator('.alert.error')).toContainText('다른 사용자가 먼저 이 주문을 변경했습니다');

    // 새로 고쳐도 상태는 '진행'이고 주문은 삭제되지 않았으며 이력에는 A 의 변경만 있다
    await b.goto(`/orders/${id}`);
    await expect(b.locator('h1 .badge')).toHaveText('진행');
    expect(await readHistory(b)).toEqual(['- → 확정', '확정 → 진행']);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
