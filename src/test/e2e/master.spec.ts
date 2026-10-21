import { test, expect } from '@playwright/test';
import { getMaster, login, restoreMaster } from './helpers';

/**
 * 기준 정보(마스터 데이터) E2E: E2E-036 ~ E2E-040
 *
 * 마스터는 모든 사용자가 같은 값을 쓰므로, 값을 바꾸는 테스트는 서로 간섭한다.
 *  - 이 파일의 테스트는 한 번에 하나씩 순서대로 실행한다(serial).
 *  - 값을 바꾸는 테스트는 끝에서 반드시 원래 값으로 되돌린다(afterEach).
 *  - 다른 파일의 테스트와 동시에 돌리면 기대 값이 깨질 수 있으니 `--workers=1` 로 실행하는 것을 권한다.
 */
test.describe.configure({ mode: 'serial' });

let original: any; // 테스트 시작 시점의 마스터

test.beforeEach(async ({ page }) => {
  await login(page);
  original = await getMaster(page);
});

test.afterEach(async ({ page }) => {
  // 어떤 테스트가 값을 바꿨든 시작 시점 값으로 되돌린다
  await restoreMaster(page, original);
});

/** E2E-036 마스터 화면에 현재 값이 보인다 */
test('E2E-036 마스터 화면에 현재 값이 보인다', async ({ page }) => {
  await page.getByRole('link', { name: '마스터 데이터' }).click();
  await expect(page).toHaveURL(/\/master$/);
  await expect(page.getByRole('heading', { name: '마스터 데이터' })).toBeVisible();

  // 화면의 값이 서버가 알려 주는 현재 값과 같다 (초기값 DB 가 아니어도 통과하도록 API 값과 비교)
  for (const f of original.factories) {
    await expect(page.locator(`input[name="maxDaily_${f.country}"]`)).toHaveValue(String(f.maxDaily));
    await expect(page.locator(`input[name="stockLimit_${f.country}"]`)).toHaveValue(String(f.stockLimit));
    await expect(page.locator(`input[name="unitCost_${f.country}"]`)).toHaveValue(String(f.unitCost));
  }
  await expect(page.locator('input[name="shipCount"]')).toHaveValue(String(original.shipCount));
  await expect(page.locator('input[name="shipDailyCost"]')).toHaveValue(
    String(original.shipDailyCostWon / 100_000_000),
  );
  for (const r of original.routes) {
    await expect(page.locator(`input[name="days_${r.from}_${r.to}"]`)).toHaveValue(String(r.days));
  }

  // 공장·선박·항로 표가 있고, 확정 주문은 바뀌지 않는다는 안내가 있다
  await expect(page.getByRole('heading', { name: '공장' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '선박' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /항로/ })).toBeVisible();
  await expect(page.getByText('값을 바꿔도 이미 확정한 주문의 계획은 바뀌지 않습니다')).toBeVisible();
});

/** E2E-037 값을 바꿔 저장하면 유지되고 버전이 오른다 */
test('E2E-037 값을 바꿔 저장하면 유지되고 버전이 오른다', async ({ page }) => {
  const china = original.factories.find((f: any) => f.country === 'CHINA');
  const newMaxDaily = china.maxDaily + 100; // 예: 400 → 500

  // 1. 저장 전 version 기록
  const versionBefore = original.version;

  // 2. 중국 하루 최대 생산량을 바꿔 [저장]
  await page.goto('/master');
  await page.locator('input[name="maxDaily_CHINA"]').fill(String(newMaxDaily));
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/master$/);
  await expect(page.locator('.alert.ok')).toHaveText('마스터 데이터를 저장했습니다');

  // 3. 화면을 새로 고쳐도 값이 남아 있고, API 의 version 이 1 올라 있다
  await page.reload();
  await expect(page.locator('input[name="maxDaily_CHINA"]')).toHaveValue(String(newMaxDaily));
  const after = await getMaster(page);
  expect(after.factories.find((f: any) => f.country === 'CHINA').maxDaily).toBe(newMaxDaily);
  expect(after.version).toBe(versionBefore + 1);

  // 4. 정리(원복)는 afterEach 에서 한다
});

/** 기본 수량으로 시뮬레이션을 실행하고 '운항비 최소' 안의 소요 일수와 화면의 계획용 마스터 표를 돌려준다. */
async function simulateDefault(page: import('@playwright/test').Page) {
  await page.goto('/orders/new');
  await page.getByRole('button', { name: '시뮬레이션 실행' }).click();
  await expect(page.locator('#options .option')).toHaveCount(3);
  await expect(page.locator('#options .option').first()).toHaveClass(/selected/); // 운항비 최소
  const daysText = await page
    .locator('#summary .stats div', { hasText: '소요 일수' })
    .locator('b')
    .innerText();
  return Number(daysText.replace('일', '').trim());
}

/** E2E-038 바뀐 마스터 값이 새 시뮬레이션에 반영된다 */
test('E2E-038 바뀐 마스터 값이 새 시뮬레이션에 반영된다', async ({ page }) => {
  const china = original.factories.find((f: any) => f.country === 'CHINA');

  // 1. 기본 수량으로 시뮬레이션해 '운항비 최소'의 소요 일수를 기록한다
  const daysBefore = await simulateDefault(page);

  // 2. 마스터에서 중국 하루 최대 생산량을 크게 줄여(예: 400 → 100) 저장한다
  await page.goto('/master');
  await page.locator('input[name="maxDaily_CHINA"]').fill('100');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.alert.ok')).toHaveText('마스터 데이터를 저장했습니다');

  // 3. 같은 수량으로 다시 시뮬레이션한다: 소요 일수가 늘어나거나 같고, 계획에 쓴 마스터 값에 100 이 보인다
  const daysAfter = await simulateDefault(page);
  expect(daysAfter).toBeGreaterThanOrEqual(daysBefore);
  expect(china.maxDaily).not.toBe(100); // 값이 실제로 바뀐 상황인지 확인

  const masterDetails = page.locator('#details details', { hasText: '하루 최대(K)' }); // '계획에 쓴 마스터 값' 펼치기
  await masterDetails.locator('summary').click();
  const chinaRow = masterDetails.locator('table', { hasText: '하루 최대(K)' }).locator('tr', { hasText: '중국' });
  await expect(chinaRow.locator('td.num').first()).toHaveText('100');

  // 4. 정리(원복)는 afterEach 에서 한다
});

/** E2E-039 잘못된 운항비(숫자 아님·0·원 단위 아님)는 저장되지 않는다 */
test.describe('E2E-039 잘못된 운항비는 저장되지 않는다', () => {
  const cases = [
    { name: '숫자가 아님', value: 'abc', message: '척당 일 운항비(억 원)는 숫자로 입력하세요' },
    { name: '0 이하', value: '0', message: '척당 일 운항비는 0보다 커야 합니다' },
    { name: '원 단위로 떨어지지 않음', value: '1.000000001', message: '척당 일 운항비는 원 단위로 떨어지는 값이어야 합니다' },
  ];

  for (const c of cases) {
    test(`E2E-039 운항비 ${c.name} (${c.value})`, async ({ page }) => {
      await page.goto('/master');
      const input = page.locator('input[name="shipDailyCost"]');
      const savedValue = await input.inputValue();
      await input.fill(c.value);
      await page.getByRole('button', { name: '저장' }).click();

      // 오류 안내가 보이고, 입력한 값은 그대로 남는다
      await expect(page.locator('.alert.error strong')).toHaveText('저장하지 않았습니다. 아래 값을 확인하세요.');
      await expect(page.locator('.alert.error li')).toHaveText([c.message]);
      await expect(input).toHaveValue(c.value);

      // 저장되지 않았다: 새로 고치면 이전 값이 보이고, 서버의 값과 version 도 그대로다
      await page.goto('/master');
      await expect(page.locator('input[name="shipDailyCost"]')).toHaveValue(savedValue);
      const m = await getMaster(page);
      expect(m.shipDailyCostWon).toBe(original.shipDailyCostWon);
      expect(m.version).toBe(original.version);
    });
  }
});

/** E2E-040 잘못된 값이 섞이면 아무것도 저장되지 않고 오류가 모두 나온다 */
test('E2E-040 잘못된 값이 섞이면 아무것도 저장되지 않고 오류가 모두 나온다', async ({ page }) => {
  const china = original.factories.find((f: any) => f.country === 'CHINA');
  const validMaxDaily = china.maxDaily + 100; // 올바른 값(예: 400 → 500)

  await page.goto('/master');
  // 숫자 칸의 min/max 속성(브라우저 기본 검증)이 먼저 막지 않도록 끈다
  await page.locator('form[action$="/master"]').evaluate((f: HTMLFormElement) => (f.noValidate = true));

  // 1. 올바른 값 하나 + 2. 잘못된 값 세 개(배 척수 5, 일본 재고 상한 0, 한국-베트남 항해 일수 400)
  await page.locator('input[name="maxDaily_CHINA"]').fill(String(validMaxDaily));
  await page.locator('input[name="shipCount"]').fill('5');
  await page.locator('input[name="stockLimit_JAPAN"]').fill('0');
  await page.locator('input[name="days_KOREA_VIETNAM"]').fill('400');

  // 3. 저장 → 오류 3건이 한꺼번에 나열된다
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.alert.error strong')).toHaveText('저장하지 않았습니다. 아래 값을 확인하세요.');
  await expect(page.locator('.alert.error li')).toHaveText([
    '배 척수은(는) 1 이상 4 이하의 정수여야 합니다',
    '일본 재고 상한은(는) 1 이상 1000000 이하의 정수여야 합니다',
    '한국-베트남 항해 일수은(는) 1 이상 365 이하의 정수여야 합니다',
  ]);

  // 4. 새로 고친다: 올바른 값(중국 하루 최대)도 저장되지 않아 원래 값이다
  await page.goto('/master');
  await expect(page.locator('input[name="maxDaily_CHINA"]')).toHaveValue(String(china.maxDaily));
  const m = await getMaster(page);
  expect(m.factories.find((f: any) => f.country === 'CHINA').maxDaily).toBe(china.maxDaily);
  expect(m.shipCount).toBe(original.shipCount);
  expect(m.version).toBe(original.version);
});
