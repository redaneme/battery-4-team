import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** 시나리오의 기본 주문: 4개국 각 3,000K (총 12,000K) */
export const DEFAULT_ORDERS = { CHINA: 3000, JAPAN: 3000, VIETNAM: 3000, INDONESIA: 3000 };

export type RouteType = 'COST' | 'FAST' | 'NEAR';

/** 화면에서 admin / admin 으로 로그인한다. 이후 page.request 도 같은 로그인 상태를 쓴다. */
export async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await page.click('button.primary');
  await expect(page).toHaveURL(/\/orders$/);
}

/** 빈칸·줄바꿈을 한 칸 공백으로 줄인다. */
export const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** API 로 시뮬레이션한다. */
export async function simulate(request: APIRequestContext, orders = DEFAULT_ORDERS) {
  const res = await request.post('/api/simulate', { data: { orders } });
  expect(res.status()).toBe(200);
  return res.json() as Promise<{ master: { version: number }; options: any[] }>;
}

/** API 로 주문을 확정하고 주문 번호를 돌려준다. (화면 흐름은 시나리오별 테스트에서 따로 확인한다) */
export async function createOrder(
  request: APIRequestContext,
  opts: { routeType?: RouteType; memo?: string; orders?: typeof DEFAULT_ORDERS } = {},
) {
  const orders = opts.orders ?? DEFAULT_ORDERS;
  const sim = await simulate(request, orders);
  const res = await request.post('/api/orders', {
    data: { orders, routeType: opts.routeType ?? 'COST', masterVersion: sim.master.version, memo: opts.memo ?? '' },
  });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: number };
  return id;
}

/** 상태를 직접 요청으로 바꾼다. (사전 조건 만들기용) */
export async function changeStatus(
  request: APIRequestContext,
  id: number,
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED',
) {
  const detail = await (await request.get(`/orders/${id}`)).text();
  const version = detail.match(/name="version" value="(\d+)"/)?.[1];
  expect(version, `주문 #${id} 의 version 을 찾지 못했다`).toBeTruthy();
  const res = await request.post(`/orders/${id}/status`, { form: { status, version: version! } });
  expect(res.status()).toBe(200);
}

/** 주문 상세의 '상태 이력' 표 행(텍스트)들 */
export function historyRows(page: Page) {
  return page
    .locator('section.card', { has: page.locator('h2', { hasText: '상태 이력' }) })
    .locator('tbody tr');
}

/** 이력 행을 [일시 제외] 이전 상태·새 상태·변경한 사람 으로 읽는다. */
export async function readHistory(page: Page) {
  const rows = historyRows(page);
  const n = await rows.count();
  const out: { from: string; to: string; by: string }[] = [];
  for (let i = 0; i < n; i++) {
    const cells = await rows.nth(i).locator('td').allInnerTexts();
    out.push({ from: normalize(cells[1]), to: normalize(cells[2]), by: normalize(cells[3]) });
  }
  return out;
}

/** 목록에서 주문 한 줄 */
export function listRow(page: Page, id: number) {
  return page.locator('table.grid tbody tr', {
    has: page.getByRole('link', { name: `#${id}`, exact: true }),
  });
}
