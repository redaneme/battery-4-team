import { expect, test, type Page } from '@playwright/test';
import { createOrder, login, normalize, simulate } from './huju-helpers';

// E2E-026 주문 상세에서 일별 재고를 지도 애니메이션으로 볼 수 있다 (PRD R6)
// 일별 생산·비용 표에는 재고 열이 없고, 재고는 지도 애니메이션 슬라이더로 일별 확인한다.
// (표에 재고 열이 추가되면 아래 '표에 재고 열이 없다' 확인을 표 확인으로 바꾼다.)

const COUNTRY: Record<string, string> = { CHINA: '중국', JAPAN: '일본', VIETNAM: '베트남', INDONESIA: '인도네시아' };

/** 슬라이더를 day 일로 옮긴다. */
async function setDay(page: Page, day: number) {
  await page.locator('[data-slider]').evaluate((el, d) => {
    (el as HTMLInputElement).value = String(d);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, day);
  await expect(page.locator('.anim-day')).toContainText(`${day}일 /`);
}

/** 지도 위 나라별 재고 숫자를 읽는다. (한국은 재고 표시가 없다) */
async function readStocks(page: Page) {
  const out: Record<string, number> = {};
  const ports = page.locator('.port');
  for (let i = 0; i < (await ports.count()); i++) {
    const stock = ports.nth(i).locator('.pstock');
    if (await stock.count()) {
      const name = normalize(await ports.nth(i).locator('.pname').innerText());
      out[name] = Number(normalize(await stock.innerText()).replace(/,/g, ''));
    }
  }
  return out;
}

test('E2E-026 슬라이더를 옮기면 나라별 일별 재고가 보이고, 수거한 날 그 나라 재고는 0이 된다', async ({ page }) => {
  await login(page);
  const sim = await simulate(page.request);
  const plan = sim.options.find((o) => o.type === 'COST'); // 서버가 계산한 일별 재고가 기대값이다
  const id = await createOrder(page.request, { routeType: 'COST', memo: 'E2E-026' });

  // 1. 확정한 주문의 상세를 연다 — 일별 표에는 재고 열이 없다
  await page.goto(`/orders/${id}`);
  const headers = await page
    .locator('#details details')
    .first()
    .locator('thead th')
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''));
  expect(headers.some((h) => h.includes('재고')), `일별 표 머리글: ${headers.join(', ')}`).toBe(false);

  // 2. 슬라이더를 0일, 1일, 3일, 11일(그리고 각 수거일과 그 전날)로 옮기며 나라별 재고를 읽는다
  const stops = plan.ships.flatMap((s: any) => s.trips.flatMap((t: any) => t.stops)) as {
    country: string;
    arriveDay: number;
  }[];
  const days = new Set<number>([0, 1, 3, 11]);
  stops.forEach((s) => {
    days.add(s.arriveDay);
    days.add(s.arriveDay - 1);
  });
  const checkDays = [...days].filter((d) => d >= 0 && d <= plan.totalDays).sort((a, b) => a - b);

  for (const day of checkDays) {
    await setDay(page, day);
    const ui = await readStocks(page);
    for (const [code, label] of Object.entries(COUNTRY)) {
      expect(ui[label], `${day}일 ${label} 재고`).toBe(plan.stock[code][day]);
    }
  }

  // 0일은 모든 나라가 0, 1일은 생산이 시작되어 모든 나라가 0보다 크다
  await setDay(page, 0);
  expect(Object.values(await readStocks(page))).toEqual([0, 0, 0, 0]);
  await setDay(page, 1);
  for (const [label, value] of Object.entries(await readStocks(page))) expect(value, `1일 ${label}`).toBeGreaterThan(0);

  // 수거한 날 그 나라 재고는 0으로 돌아간다
  for (const stop of stops) {
    await setDay(page, stop.arriveDay);
    expect((await readStocks(page))[COUNTRY[stop.country]], `${stop.arriveDay}일 ${COUNTRY[stop.country]} 수거 후 재고`).toBe(0);
  }
});
