import { expect, test, type Page } from '@playwright/test';
import { createOrder, listRow, login, normalize } from './common-helpers';

// E2E-022 마스터를 바꿔도 확정한 주문은 그대로고, 새 주문만 새 기준을 따른다 (PRD R4·R5·R8, INTENT 원칙 4)

/** 주문 상세에서 확정 당시 내용을 읽는다. */
async function readDetail(page: Page, id: number) {
  await page.goto(`/orders/${id}`);
  await expect(page.locator('#summary h2')).toBeVisible();
  return {
    summary: normalize(await page.locator('#summary').innerText()),
    ships: normalize(await page.locator('#details > table.grid').nth(1).innerText()),
    daily: normalize(await page.locator('#details details').first().textContent()),
    master: normalize(await page.locator('#details details').last().textContent()),
  };
}

async function readListRow(page: Page, id: number) {
  await page.goto('/orders');
  return normalize(await listRow(page, id).innerText());
}

async function saveMaster(page: Page, values: { shipCount: string; maxDailyChina: string }) {
  await page.goto('/master');
  await page.fill('input[name=shipCount]', values.shipCount);
  await page.fill('input[name=maxDaily_CHINA]', values.maxDailyChina);
  await page.click('button.primary:has-text("저장")');
  await expect(page.locator('p.alert.ok')).toContainText('마스터 데이터를 저장했습니다');
}

test('E2E-022 마스터를 바꿔도 확정한 주문은 그대로, 새 주문만 새 기준을 따른다', async ({ page }) => {
  await login(page);

  // 원복에 쓸 현재 마스터 값을 기억해 둔다
  await page.goto('/master');
  const original = {
    shipCount: await page.inputValue('input[name=shipCount]'),
    maxDailyChina: await page.inputValue('input[name=maxDaily_CHINA]'),
  };

  // 1. 확정한 주문 1건의 상세·목록 값을 기록한다
  const oldId = await createOrder(page.request, { memo: 'E2E-022' });
  const before = await readDetail(page, oldId);
  const beforeRow = await readListRow(page, oldId);
  expect(before.master).toContain(`배 ${original.shipCount}척`);

  try {
    // 2. 중국 하루 최대 생산량 → 100, 배 척수 → 1 로 저장한다
    await saveMaster(page, { shipCount: '1', maxDailyChina: '100' });

    // 3. 같은 주문의 상세와 목록의 같은 행은 확정 당시 그대로다
    const after = await readDetail(page, oldId);
    expect(after).toEqual(before);
    expect(after.master).toContain(`배 ${original.shipCount}척`);
    expect(await readListRow(page, oldId)).toBe(beforeRow);

    // 4. 같은 수량으로 새로 시뮬레이션하고 확정한다 — 새 주문은 새 기준 값을 따른다
    await page.goto('/orders/new');
    await page.click('#runBtn');
    await expect(page.locator('#result')).toBeVisible();
    await page.click('#confirmBtn');
    await expect(page).toHaveURL(/\/orders\/\d+$/);
    const newId = Number(page.url().split('/').pop());
    expect(newId).toBeGreaterThan(oldId);

    const fresh = await readDetail(page, newId);
    expect(fresh.master).toContain('배 1척');
    expect(fresh.summary, '새 주문의 계산 결과는 달라야 한다').not.toBe(before.summary);

    // 과거 주문은 여전히 확정 당시 값이다
    expect(await readDetail(page, oldId)).toEqual(before);
  } finally {
    // 5. 정리: 마스터를 원복한다 (다른 시나리오의 기대 값을 위해 반드시)
    await saveMaster(page, original);
  }
});
