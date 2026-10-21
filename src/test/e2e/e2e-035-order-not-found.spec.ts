import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * E2E-035 없는 주문 번호로 접속하면 이유를 알려 준다
 *
 * 정한 동작(PRD 8장 오류 안내, INTENT 원칙 8): '주문을 찾을 수 없습니다' 같은 안내가 보인다.
 * 현재 구현: 안내 없이 HTTP 500 기본 오류 화면(Whitelabel Error Page)이 열린다.
 *           (알려진 결함: INTENT 9장 2번)
 *
 * 고치기 전까지 test.fail() 로 표시한다. 이 테스트는 "실패하는 것이 정상"이다.
 * 고치고 나면 test.fail() 줄을 지워 일반 테스트로 전환한다.
 */
test('E2E-035 없는 주문 번호로 접속하면 이유를 알려 준다', async ({ page }) => {
  test.fail(true, '알려진 결함: 없는 주문 번호 접근 시 HTTP 500 기본 오류 화면 (INTENT 9장 2번)');

  await login(page);
  const response = await page.goto('/orders/999999');

  // 서버 오류(5xx)가 아니어야 하고, 이유를 알리는 안내가 보여야 한다
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByText('주문을 찾을 수 없습니다')).toBeVisible();
  await expect(page.getByText('Whitelabel Error Page')).toHaveCount(0);
});
