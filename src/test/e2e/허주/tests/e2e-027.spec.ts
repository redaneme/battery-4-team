import { expect, test } from '@playwright/test';
import { createOrder, login, readHistory } from './helpers';

// E2E-027 확정 → 진행으로 바꾸고 이력이 남는다 (PRD R7, INTENT 원칙 9)
test('E2E-027 확정 → 진행: 확인 창 문구, 배지, 안내, 이력 행', async ({ page }) => {
  await login(page);
  const id = await createOrder(page.request, { memo: 'E2E-027' });
  await page.goto(`/orders/${id}`);
  await expect(page.locator('h1 .badge')).toHaveText('확정');

  // 1~2. [진행(으)로 변경]을 누르고 확인 창 문구를 확인한 뒤 [확인]을 누른다
  let message = '';
  page.once('dialog', async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  await page.getByRole('button', { name: '진행(으)로 변경' }).click();

  await expect(page.locator('.alert.ok')).toContainText("상태를 '진행'(으)로 바꿨습니다");
  expect(message).toBe('진행(으)로 바꿉니다. 계속할까요?');
  await expect(page.locator('h1 .badge')).toHaveText('진행');

  // 이력에 '확정 → 진행, 변경한 사람 admin' 행이 추가된다
  expect(await readHistory(page)).toEqual([
    { from: '-', to: '확정', by: 'admin' },
    { from: '확정', to: '진행', by: 'admin' },
  ]);
});
