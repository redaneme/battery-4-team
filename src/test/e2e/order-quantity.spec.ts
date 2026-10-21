import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

const COUNTRIES = ['CHINA', 'JAPAN', 'VIETNAM', 'INDONESIA'] as const;
type Country = (typeof COUNTRIES)[number];

const gauge = (page: Page, c: Country) => page.locator(`.gauge[data-c="${c}"] .gnum`);
const total = (page: Page) => page.locator('#total');

/** 입력칸에 값을 넣고 포커스를 옮겨 change 이벤트를 일으킨다 */
async function setValue(input: ReturnType<Page['locator']>, value: number | string) {
  await input.fill(String(value));
  await input.press('Tab');
}

async function readGauges(page: Page): Promise<Record<Country, number>> {
  const out = {} as Record<Country, number>;
  for (const c of COUNTRIES) out[c] = Number(await gauge(page, c).inputValue());
  return out;
}

async function expectGauges(page: Page, expected: Record<Country, number>) {
  for (const c of COUNTRIES) await expect(gauge(page, c), c).toHaveValue(String(expected[c]));
}

test.describe('2. 주문 수량 입력', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/orders/new');
    await expect(total(page)).toHaveValue('12000');
  });

  test('E2E-006 수량 게이지를 조정해도 나라별 합계가 총 수량과 같다', async ({ page }) => {
    const sum = async () => Object.values(await readGauges(page)).reduce((a, b) => a + b, 0);

    // 1: 총 10,000 -> 각 2,500
    await setValue(total(page), 10000);
    await expectGauges(page, { CHINA: 2500, JAPAN: 2500, VIETNAM: 2500, INDONESIA: 2500 });
    expect(await sum()).toBe(10000);

    // 2: 12,000 (각 3,000) 에서 중국 4,000
    await page.reload();
    await setValue(gauge(page, 'CHINA'), 4000);
    await expectGauges(page, { CHINA: 4000, JAPAN: 2000, VIETNAM: 3000, INDONESIA: 3000 });
    expect(await sum()).toBe(12000);

    // 3: 이어서 인도네시아 4,000 -> 맨 왼쪽(중국)이 조정된다
    await setValue(gauge(page, 'INDONESIA'), 4000);
    await expectGauges(page, { CHINA: 3000, JAPAN: 2000, VIETNAM: 3000, INDONESIA: 4000 });
    expect(await sum()).toBe(12000);

    // 4: 다시 각 3,000 에서 중국 9,000 -> 중국+일본(6,000)까지만
    await page.reload();
    await setValue(gauge(page, 'CHINA'), 9000);
    await expectGauges(page, { CHINA: 6000, JAPAN: 0, VIETNAM: 3000, INDONESIA: 3000 });
    expect(await sum()).toBe(12000);
  });

  test('E2E-007 총 수량에 1 미만을 넣으면 이전 값으로 돌아간다', async ({ page }) => {
    const before = await readGauges(page);
    for (const bad of ['0', '-5']) {
      await setValue(total(page), bad);
      await expect(total(page), bad).toHaveValue('12000');
      await expectGauges(page, before);
    }
  });

  test('E2E-008 총 수량이 상한을 넘으면 계산하지 않고 이유를 알리고, 경계값은 계산된다', async ({ page }) => {
    const run = page.getByRole('button', { name: '시뮬레이션 실행' });
    const options = page.locator('#options .option');

    // 1: 100,001 거부
    await setValue(total(page), 100001);
    await run.click();
    await expect(page.locator('#inputError')).toBeVisible();
    await expect(page.locator('#inputError')).toContainText('총 생산 필요 수는 100,000K 이하여야 합니다');
    await expect(page.locator('#result')).toBeHidden();

    // 2: 100,000 계산됨
    await setValue(total(page), 100000);
    await run.click();
    await expect(options).toHaveCount(3);
    await expect(page.locator('#inputError')).toBeHidden();

    // 3: 1K 계산됨
    await setValue(total(page), 1);
    await run.click();
    await expect(options).toHaveCount(3);
    await expect(page.locator('#inputError')).toBeHidden();
  });

  test('E2E-009 API 로 음수·0 수량을 보내면 이유와 함께 400 이다', async ({ page }) => {
    const negative = await page.request.post('/api/simulate', { data: { orders: { CHINA: -1 } } });
    expect(negative.status()).toBe(400);
    expect((await negative.json()).error).toBe('중국 주문 수량은 0 이상이어야 합니다');

    const zero = await page.request.post('/api/simulate', {
      data: { orders: { CHINA: 0, JAPAN: 0, VIETNAM: 0, INDONESIA: 0 } },
    });
    expect(zero.status()).toBe(400);
    expect((await zero.json()).error).toBe('총 생산 필요 수는 1K 이상이어야 합니다');
  });

  test('E2E-010 입력을 바꾸면 이전 결과가 사라진다', async ({ page }) => {
    const run = page.getByRole('button', { name: '시뮬레이션 실행' });
    const result = page.locator('#result');

    // 나라별 수량을 바꾸는 경우
    await run.click();
    await expect(result).toBeVisible();
    await setValue(gauge(page, 'CHINA'), 2000);
    await expect(result).toBeHidden();
    await expect(page.getByRole('button', { name: '주문 확정' })).toBeHidden();

    // 총 수량을 바꾸는 경우
    await run.click();
    await expect(result).toBeVisible();
    await setValue(total(page), 8000);
    await expect(result).toBeHidden();

    // 다시 시뮬레이션하면 확정할 수 있다
    await run.click();
    await expect(result).toBeVisible();
    await expect(page.getByRole('button', { name: '주문 확정' })).toBeVisible();
  });
});
