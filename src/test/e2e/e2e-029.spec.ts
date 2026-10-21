import { expect, test } from '@playwright/test';
import { changeStatus, createOrder, login, readHistory } from './huju-helpers';

// E2E-029 진행 → 완료로 바꾸면 더 바꿀 수 없다 (PRD R7, INTENT 원칙 9)
test('E2E-029 진행 → 완료 후에는 변경 버튼이 없고 이력이 3행이다', async ({ page }) => {
  await login(page);
  const id = await createOrder(page.request, { memo: 'E2E-029' });
  await changeStatus(page.request, id, 'IN_PROGRESS'); // 사전 조건: 상태 '진행'
  await page.goto(`/orders/${id}`);
  await expect(page.locator('h1 .badge')).toHaveText('진행');

  // 1. [완료(으)로 변경]을 누르고 확인한다
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '완료(으)로 변경' }).click();

  await expect(page.locator('h1 .badge')).toHaveText('완료');
  await expect(page.locator('.actions button')).toHaveCount(0);
  await expect(page.getByText('최종 상태라 더 바꿀 수 없습니다.')).toBeVisible();
  expect(await readHistory(page)).toEqual([
    { from: '-', to: '확정', by: 'admin' },
    { from: '확정', to: '진행', by: 'admin' },
    { from: '진행', to: '완료', by: 'admin' },
  ]);
});
