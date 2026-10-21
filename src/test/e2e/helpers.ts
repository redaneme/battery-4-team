import { expect, type Page } from '@playwright/test';

/** 기본 주문: 4개국 각 3,000K (총 12,000K) */
export const DEFAULT_ORDERS = { CHINA: 3000, JAPAN: 3000, VIETNAM: 3000, INDONESIA: 3000 };

export type RouteType = 'COST' | 'FAST' | 'NEAR';

/** admin/admin 으로 로그인해 주문 목록까지 들어간다. */
export async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill('admin');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/orders$/);
}

/** 현재 마스터 데이터(JSON). */
export async function getMaster(page: Page) {
  const res = await page.request.get('/api/master');
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/**
 * 화면을 거치지 않고 API 로 주문을 확정해 주문 번호를 돌려준다. (테스트 준비용)
 * 다른 테스트가 그 사이 마스터를 바꾸면 서버가 409 로 거부하므로 마스터 버전을 다시 읽어 재시도한다.
 */
export async function createOrder(
  page: Page,
  opts: { routeType?: RouteType; memo?: string; orders?: Record<string, number> } = {},
): Promise<number> {
  for (let attempt = 1; ; attempt++) {
    const master = await getMaster(page);
    const res = await page.request.post('/api/orders', {
      data: {
        orders: opts.orders ?? DEFAULT_ORDERS,
        routeType: opts.routeType ?? 'COST',
        masterVersion: master.version,
        memo: opts.memo ?? null,
      },
    });
    if (res.status() === 409 && attempt < 5) continue;
    expect(res.ok(), `주문 확정 API 실패: ${res.status()}`).toBeTruthy();
    return (await res.json()).id as number;
  }
}

/** 주문 상세에서 [OO(으)로 변경] 버튼을 누르고 확인 창을 수락한다. */
export async function changeStatusByButton(page: Page, label: '진행' | '완료' | '취소') {
  page.once('dialog', (dialog) => dialog.accept());
  // 요청이 서버에 도달해 응답을 받을 때까지 기다린다. (바로 다른 화면으로 이동하면 요청이 끊길 수 있다)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/status') && r.request().method() === 'POST'),
    page.getByRole('button', { name: `${label}(으)로 변경` }).click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
}

/** 주문 목록의 상태 칩 건수. label 은 '전체', '확정', '진행', '완료', '취소'. */
export async function chipCount(page: Page, label: string): Promise<number> {
  const text = await page.locator('.filters .chip', { hasText: label }).locator('.count').innerText();
  return Number(text.trim());
}

/** 주문 상세 HTML 의 숨은 version 값. 변경 버튼이 없는 최종 상태 주문에는 없다. */
export async function readVersion(page: Page, orderId: number): Promise<number> {
  const html = await (await page.request.get(`/orders/${orderId}`)).text();
  const m = html.match(/name="version"\s+value="(\d+)"/);
  expect(m, '상세 화면에서 version 값을 찾지 못했다').not.toBeNull();
  return Number(m![1]);
}

/** 화면에 버튼이 없는 상태 변경 요청을 직접 보낸다. 리다이렉트된 상세 화면의 HTML 을 돌려준다. */
export async function postStatus(page: Page, orderId: number, status: string, version: number): Promise<string> {
  const res = await page.request.post(`/orders/${orderId}/status`, { form: { status, version: String(version) } });
  return res.text();
}

/** 주문 상세 화면의 상태 이력 행(이전 → 새 상태)을 읽는다. */
export async function readHistory(page: Page): Promise<string[]> {
  const rows = page.locator('section:has(h2:text("상태 이력")) tbody tr');
  const n = await rows.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const cells = await rows.nth(i).locator('td').allInnerTexts();
    out.push(`${cells[1].trim()} → ${cells[2].trim()}`);
  }
  return out;
}

/** 마스터 JSON 을 /master 폼 값으로 바꾼다. (원복용) */
function masterToForm(m: any): Record<string, string> {
  const form: Record<string, string> = {};
  for (const f of m.factories) {
    form[`maxDaily_${f.country}`] = String(f.maxDaily);
    form[`stockLimit_${f.country}`] = String(f.stockLimit);
    form[`unitCost_${f.country}`] = String(f.unitCost);
  }
  for (const r of m.routes) {
    form[`days_${r.from}_${r.to}`] = String(r.days);
  }
  form.shipCount = String(m.shipCount);
  form.shipDailyCost = String(m.shipDailyCostWon / 100_000_000);
  return form;
}

/** 마스터를 주어진 값으로 되돌린다. 마스터를 바꾸는 테스트는 끝에서 반드시 호출한다. */
export async function restoreMaster(page: Page, original: any) {
  const res = await page.request.post('/master', { form: masterToForm(original), maxRedirects: 0 });
  expect([200, 302]).toContain(res.status());
}
