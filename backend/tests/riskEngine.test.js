/**
 * Scenario tests for the risk engine. These aren't unit tests of internals —
 * they're behavioral checks that the SCORE OUTPUT makes sense for realistic
 * PR shapes, which is what actually matters for an explainable risk model.
 *
 * Run with: node tests/riskEngine.test.js
 */
import { computeRiskScore, explainTopDrivers } from '../src/risk-engine/index.js';

const scenarios = [
  {
    name: 'Trivial typo fix',
    pr: { additions: 2, deletions: 1, changed_files: 1, opened_at: '2026-06-15T14:00:00Z' },
    files: ['README.md'],
    expectLevel: 'low',
  },
  {
    name: 'Large feature PR, no tests, touches auth, opened Friday night',
    pr: { additions: 420, deletions: 80, changed_files: 12, opened_at: '2026-06-19T23:30:00Z' },
    files: [
      'backend/src/auth/login.js',
      'backend/src/auth/middleware.js',
      'backend/src/routes/users.js',
      'frontend/src/pages/Login.jsx',
      'frontend/src/pages/Signup.jsx',
    ],
    expectLevel: ['high', 'critical'],
  },
  {
    name: 'Well-tested medium PR, weekday morning',
    pr: { additions: 150, deletions: 40, changed_files: 6, opened_at: '2026-06-16T11:00:00Z' },
    files: [
      'backend/src/services/userService.js',
      'backend/src/services/userService.test.js',
      'backend/src/routes/users.js',
      'backend/tests/users.spec.js',
    ],
    expectLevel: 'low',
  },
  {
    name: 'Payment system change by historically risky author',
    pr: { additions: 90, deletions: 30, changed_files: 4, opened_at: '2026-06-17T10:00:00Z' },
    files: ['backend/src/payment/stripe.js', 'backend/src/payment/checkout.js'],
    authorStats: { total_prs: 12, reverted_prs: 5, revert_rate: 0.42 },
    expectLevel: ['high', 'critical'],
  },
];

let passed = 0;
let failed = 0;

console.log('='.repeat(70));
console.log('RISK ENGINE SCENARIO TESTS');
console.log('='.repeat(70));

for (const scenario of scenarios) {
  const result = computeRiskScore(scenario.pr, scenario.files, {
    authorStats: scenario.authorStats || null,
  });
  const drivers = explainTopDrivers(result.breakdown);
  const expected = Array.isArray(scenario.expectLevel) ? scenario.expectLevel : [scenario.expectLevel];
  const pass = expected.includes(result.riskLevel);

  console.log(`\n${pass ? '✅' : '❌'} ${scenario.name}`);
  console.log(`   Score: ${result.score}/100 — ${result.riskLevel.toUpperCase()} (expected: ${expected.join(' or ')})`);
  console.log(`   Top drivers: ${drivers.map((d) => `${d.label} (+${d.points}pts)`).join(', ') || 'none'}`);

  pass ? passed++ : failed++;
}

console.log('\n' + '='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

if (failed > 0) process.exit(1);
