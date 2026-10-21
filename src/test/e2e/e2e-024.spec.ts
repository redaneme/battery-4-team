import { expect, test, type Page } from '@playwright/test';
import { changeStatus, createOrder, login, normalize } from './huju-helpers';

// E2E-024 상태 필터와 건수가 맞다 (PRD R6, INTENT 원칙 9)
// '취소' 건수는 취소한 주문이 삭제되어 늘지 않는다(PRD 7장). DB 에 따라 달라질 수 있으니 값은 정하지 않고 행 수와 같은지만 본다.
const LABELS = ['전체', '확정', '진행', '완료', '취소'] as const;

async function readChips(page: Page) {
  const out: Record<string, number> = {};
  for (const text of await page.locator('.filters .chip').allInnerTexts()) {
    const m = normalize(text).match(/^(\S+)\s+(\d+)$/);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

test('E2E-024 칩의 건수는 실제 행 수와 같고, 칩을 누르면 그 상태의 주문만 보인다', async ({ page }) => {
  await login(page);
  // 사전 조건: 확정·진행·완료 주문이 각각 1건 이상
  await createOrder(page.request, { memo: 'E2E-024 확정' });
  const inProgress = await createOrder(page.request, { memo: 'E2E-024 진행' });
  await changeStatus(page.request, inProgress, 'IN_PROGRESS');
  const done = await createOrder(page.request, { memo: 'E2E-024 완료' });
  await changeStatus(page.request, done, 'IN_PROGRESS');
  await changeStatus(page.request, done, 'COMPLETED');

  // 1. 칩의 건수를 읽는다
  await page.goto('/orders');
  const counts = await readChips(page);
  expect(Object.keys(counts).sort()).toEqual([...LABELS].sort());
  expect(counts['확정']).toBeGreaterThanOrEqual(1);
  expect(counts['진행']).toBeGreaterThanOrEqual(1);
  expect(counts['완료']).toBeGreaterThanOrEqual(1);
  expect(counts['전체'], '전체 = 확정+진행+완료+취소').toBe(counts['확정'] + counts['진행'] + counts['완료'] + counts['취소']);

  const rows = page.locator('table.grid tbody tr.clickable');
  expect(await rows.count(), '전체 칩의 건수와 행 수').toBe(counts['전체']);

  // 각 칩의 건수가 실제 행 수와 같고, 그 상태의 주문만 있다
  for (const label of ['확정', '진행', '완료', '취소']) {
    await page.locator('.filters .chip', { hasText: new RegExp(`^\\s*${label}\\s`) }).click();
    await expect(page.locator('.filters .chip.active')).toContainText(label);
    expect(await rows.count(), `${label} 칩의 건수와 행 수`).toBe(counts[label]);
    for (const t of await page.locator('table.grid tbody tr.clickable td:nth-child(7)').allInnerTexts()) {
      expect(normalize(t)).toBe(label);
    }
  }

  // 2. '진행' 칩을 누른다 — 진행 주문만 보이고 '진행' 칩이 활성 표시다
  await page.locator('.filters .chip', { hasText: /^\s*진행\s/ }).click();
  await expect(page).toHaveURL(/status=IN_PROGRESS/);
  await expect(page.locator('.filters .chip.active')).toContainText('진행');
  expect(await rows.count()).toBe(counts['진행']);
});
