// Patterns for files/paths considered "sensitive" — touching these raises risk
// regardless of diff size, because the blast radius of a mistake here is higher.
// Patterns are matched against file paths using simple substring/regex checks.

export const SENSITIVE_PATH_PATTERNS = [
  { pattern: /(^|\/)auth\//i, label: 'authentication', weight: 1.0 },
  { pattern: /(^|\/)(payment|billing|stripe|checkout)/i, label: 'payments', weight: 1.0 },
  { pattern: /\.env(\..+)?$/i, label: 'environment config', weight: 0.9 },
  { pattern: /(^|\/)config\//i, label: 'configuration', weight: 0.7 },
  { pattern: /(^|\/)migrations?\//i, label: 'database migration', weight: 0.85 },
  { pattern: /(^|\/)(docker|kubernetes|k8s)/i, label: 'infrastructure', weight: 0.75 },
  { pattern: /(ci|cd)\.ya?ml$/i, label: 'CI/CD pipeline', weight: 0.7 },
  { pattern: /(^|\/)secrets?\//i, label: 'secrets', weight: 1.0 },
  { pattern: /(^|\/)middleware\//i, label: 'middleware', weight: 0.6 },
  { pattern: /(^|\/)(permissions?|roles?|rbac)/i, label: 'access control', weight: 0.9 },
  { pattern: /package(-lock)?\.json$/i, label: 'dependencies', weight: 0.4 },
  { pattern: /requirements\.txt$/i, label: 'dependencies', weight: 0.4 },
];

export const TEST_PATH_PATTERNS = [
  /(^|\/)(test|tests|__tests__|spec)\//i,
  /\.(test|spec)\.(js|jsx|ts|tsx|py)$/i,
  /(^|\/)test_.*\.py$/i,
];

export function isSensitivePath(filePath) {
  const hits = [];
  for (const { pattern, label, weight } of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(filePath)) {
      hits.push({ label, weight, filePath });
    }
  }
  return hits;
}

export function isTestPath(filePath) {
  return TEST_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}
