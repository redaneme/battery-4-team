// 테스트를 headless 로 실행하고 결과 리포트(report/)를 만든다.
//   report/report.md      사람이 읽는 요약
//   report/results.json   Playwright JSON 결과
//   report/html/          Playwright HTML 리포트 (index.html)
// 사용: npm run test:report
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, 'report');
const PRD = {
  '021': 'R3', '022': 'R4·R5·R8', '023': 'R6', '024': 'R6', '025': 'R6·R4',
  '026': 'R6', '027': 'R7', '028': 'R7', '029': 'R7', '030': 'R7',
};

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();

// 폴더 자체가 아니라 안의 내용만 비운다. (다른 프로그램이 그 폴더를 열어 두면 폴더 삭제가 막힐 수 있다)
fs.mkdirSync(reportDir, { recursive: true });
for (const name of fs.readdirSync(reportDir)) {
  fs.rmSync(path.join(reportDir, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const run = spawnSync(process.execPath, [cli, 'test'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, E2E_REPORT_DIR: reportDir },
});

const jsonPath = path.join(reportDir, 'results.json');
if (!fs.existsSync(jsonPath)) {
  console.error('results.json 이 만들어지지 않았다. 테스트가 시작되지 못했다.');
  process.exit(run.status || 1);
}
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// 결과 수집
const rows = [];
const walk = (suite) => {
  (suite.specs || []).forEach((spec) => {
    const test = spec.tests[0];
    const result = test.results[test.results.length - 1];
    const id = (spec.title.match(/E2E-(\d{3})/) || [])[1];
    rows.push({
      id: id ? `E2E-${id}` : '-',
      prd: PRD[id] || '-',
      title: spec.title.replace(/^E2E-\d{3}\s*/, ''),
      status: test.status === 'expected' ? '통과' : test.status === 'skipped' ? '건너뜀' : '실패',
      ms: result.duration,
      file: spec.file,
    });
  });
  (suite.suites || []).forEach(walk);
};
(data.suites || []).forEach(walk);
rows.sort((a, b) => a.id.localeCompare(b.id));

const count = (s) => rows.filter((r) => r.status === s).length;
const totalMs = rows.reduce((a, r) => a + r.ms, 0);
const dirty = git('status', '--porcelain', '--', '.', ':!report');
const stamp = new Date().toLocaleString('ko-KR', { hour12: false });

const md = [
  '# battery E2E 테스트 결과 리포트 (E2E-021 ~ E2E-030)',
  '',
  `- 실행 일시: ${stamp}`,
  `- 실행 모드: **headless** (Chrome)`,
  `- 테스트 코드 커밋: \`${git('rev-parse', '--short', 'HEAD')}\` (${git('rev-parse', '--abbrev-ref', 'HEAD')})${dirty ? ' — 커밋되지 않은 변경이 있었다' : ''}`,
  `- 환경: Playwright ${data.config?.version || ''}, Node ${process.version}, ${os.type()} ${os.release()}`,
  '- 실행 대상: 테스트가 직접 띄운 앱 (포트 8091, 메모리 DB). 개발 앱·개발 DB는 사용하지 않았다.',
  '- 시나리오: `docs/e2e/e2e-test-scenarios-final.xlsx` 의 E2E-021 ~ E2E-030',
  '',
  '## 요약',
  '',
  `| 전체 | 통과 | 실패 | 건너뜀 | 테스트 시간 합계 | 전체 실행 시간 |`,
  `|---|---|---|---|---|---|`,
  `| ${rows.length} | ${count('통과')} | ${count('실패')} | ${count('건너뜀')} | ${(totalMs / 1000).toFixed(1)}초 | ${(((data.stats && data.stats.duration) || totalMs) / 1000).toFixed(1)}초 (앱 기동 포함) |`,
  '',
  '## 시나리오별 결과',
  '',
  '| 시나리오 | 내용 | PRD | 결과 | 소요 시간 |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.title} | ${r.prd} | ${r.status} | ${(r.ms / 1000).toFixed(1)}초 |`),
  '',
  '## 참고',
  '',
  '- E2E-026은 처음에 자동화 대상이 아니었으나, 현재 화면에 맞게 "지도 애니메이션 슬라이더로 일별 재고를 본다"로 시나리오를 바꾸어 테스트를 만들었다. (PRD R6 문구 보정은 팀 확인 필요)',
  '- 상세 화면(단계별 결과, 실패 시 스크린샷·트레이스)은 `report/html/index.html` 에서 볼 수 있다. 브라우저로 열거나 `npx playwright show-report report/html` 로 연다.',
  '- 다시 만들려면 `cd docs/playwright/허주 && npm run test:report` 를 실행한다.',
  '',
].join('\n');
fs.writeFileSync(path.join(reportDir, 'report.md'), md);

console.log('\n리포트 생성 완료: ' + path.join(reportDir, 'report.md'));
process.exit(run.status === null ? 1 : run.status);
