import { expect, test } from '@playwright/test';
import { changeStatus, createOrder, login } from './common-helpers';

// E2E-030 화면에는 허용된 다음 상태 버튼만 있다 (PRD R7, INTENT 원칙 9)
test('E2E-030 확정은 [진행·취소], 진행은 [완료·취소] 버튼만 있다', async ({ page }) => {
  await login(page);
  const confirmed = await createOrder(page.request, { memo: 'E2E-030 확정' });
  const inProgress = await createOrder(page.request, { memo: 'E2E-030 진행' });
  await changeStatus(page.request, inProgress, 'IN_PROGRESS');

  // 1. '확정' 주문 상세의 변경 버튼
  await page.goto(`/orders/${confirmed}`);
  await expect(page.locator('h1 .badge')).toHaveText('확정');
  expect((await page.locator('.actions button').allInnerTexts()).map((t) => t.trim())).toEqual([
    '진행(으)로 변경',
    '취소(으)로 변경',
  ]);

  // 2. '진행' 주문 상세의 변경 버튼
  await page.goto(`/orders/${inProgress}`);
  await expect(page.locator('h1 .badge')).toHaveText('진행');
  expect((await page.locator('.actions button').allInnerTexts()).map((t) => t.trim())).toEqual([
    '완료(으)로 변경',
    '취소(으)로 변경',
  ]);
});
