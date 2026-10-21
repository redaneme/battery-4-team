import { test as base, expect } from '@playwright/test';
import { login, readMasterForm, saveMaster } from './helpers';

/**
 * 마스터(기준 정보)를 바꾸는 테스트용. 테스트 시작 전 값을 저장해 두었다가 끝나면(실패해도) 원래 값으로 되돌린다.
 * 사용: test('...', async ({ page, restoreMaster }) => { ... })
 */
export const test = base.extend<{ restoreMaster: void }>({
  restoreMaster: [
    async ({ page }, use) => {
      await login(page);
      const snapshot = await readMasterForm(page);
      await use();
      await saveMaster(page, snapshot);
    },
    { auto: false },
  ],
});

export { expect };
