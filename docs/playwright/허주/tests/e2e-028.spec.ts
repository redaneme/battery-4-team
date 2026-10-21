import { expect, test } from '@playwright/test';
import { createOrder, login, readHistory } from './helpers';

// E2E-028 확인 창에서 취소하면 상태가 바뀌지 않는다 (PRD R7, INTENT 원칙 9)
test('E2E-028 확인 창에서 [취소]를 누르면 상태와 이력이 그대로다', async ({ page }) => {
  await login(page);
  const id = await createOrder(page.request, { memo: 'E2E-028' });
  await page.goto(`/orders/${id}`);
  const before = await readHistory(page);
  expect(before).toHaveLength(1);

  // 1~2. [진행(으)로 변경]을 누르고 확인 창에서 [취소]를 누른다
  let message = '';
  page.once('dialog', async (dialog) => {
    message = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '진행(으)로 변경' }).click();
  await expect.poll(() => message).toBe('진행(으)로 바꿉니다. 계속할까요?');
  await page.waitForTimeout(500); // 잘못 제출되었다면 이동·안내가 생길 시간

  // 상태는 '확정', 이력 행 수도 그대로, 안내 메시지도 없다
  await expect(page.locator('h1 .badge')).toHaveText('확정');
  expect(await readHistory(page)).toEqual(before);
  await expect(page.locator('.alert')).toHaveCount(0);

  // 새로 읽어도 서버의 상태는 '확정'이다
  await page.reload();
  await expect(page.locator('h1 .badge')).toHaveText('확정');
  expect(await readHistory(page)).toEqual(before);
});
