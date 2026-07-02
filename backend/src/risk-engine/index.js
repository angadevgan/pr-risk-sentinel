import {
  scoreDiffSize,
  scoreSensitivePaths,
  scoreTestRatio,
  scoreComplexityDelta,
  scoreAuthorHistory,
  scoreTimingRisk,
} from './featureExtractors.js';

// Feature weights — tunable, and documented so they're defensible in an interview.
// These reflect a judgment call: sensitive-path touches and missing tests are
// the strongest predictors of real-world incidents, so they're weighted highest.
// Timing and author history are soft signals, weighted low so they nudge but
// never dominate the score.
export const FEATURE_WEIGHTS = {
  diffSize: 0.20,
  sensitivePaths: 0.30,
  testRatio: 0.25,
  complexityDelta: 0.15,
  authorHistory: 0.07,
  timing: 0.03,
};

export const MODEL_VERSION = 'rule-based-v1';

export function classifyRiskLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Computes a full risk assessment for a PR.
 *
 * @param {object} pr - { additions, deletions, changed_files, opened_at }
 * @param {string[]} filePaths - list of changed file paths
 * @param {object} [options]
 * @param {object} [options.authorStats] - { total_prs, revert_rate } from author_stats table
 * @param {{before:number, after:number}} [options.complexity] - optional static analysis result
 * @returns {{ score: number, riskLevel: string, breakdown: object, modelVersion: string }}
 */
export function computeRiskScore(pr, filePaths, options = {}) {
  const totalChanges = (pr.additions || 0) + (pr.deletions || 0);

  const diffSize = scoreDiffSize(pr);
  const sensitivePaths = scoreSensitivePaths(filePaths);
  const testRatio = scoreTestRatio(filePaths, totalChanges);
  const complexityDelta = scoreComplexityDelta(
    options.complexity?.before,
    options.complexity?.after
  );
  const authorHistory = scoreAuthorHistory(options.authorStats);
  const timing = scoreTimingRisk(pr.opened_at);

  const features = {
    diffSize,
    sensitivePaths,
    testRatio,
    complexityDelta,
    authorHistory,
    timing,
  };

  // Weighted sum, scaled to 0-100
  let rawScore = 0;
  const breakdown = {};

  for (const [key, weight] of Object.entries(FEATURE_WEIGHTS)) {
    const contribution = features[key].score * weight;
    rawScore += contribution;
    breakdown[key] = {
      rawScore: features[key].score,
      weight,
      contributionPoints: Math.round(contribution * 100 * 100) / 100, // contribution out of 100
      detail: features[key].detail,
    };
  }

  const finalScore = Math.round(Math.min(rawScore, 1.0) * 100 * 100) / 100;

  return {
    score: finalScore,
    riskLevel: classifyRiskLevel(finalScore),
    breakdown,
    modelVersion: MODEL_VERSION,
  };
}

/**
 * Produces a short, human-readable explanation of the top risk drivers —
 * used in the GitHub PR comment and dashboard summary.
 */
export function explainTopDrivers(breakdown, limit = 3) {
  const sorted = Object.entries(breakdown)
    .sort((a, b) => b[1].contributionPoints - a[1].contributionPoints)
    .slice(0, limit);

  const labels = {
    diffSize: 'Large diff size',
    sensitivePaths: 'Touches sensitive code paths',
    testRatio: 'Insufficient test coverage for change size',
    complexityDelta: 'Increased code complexity',
    authorHistory: "Author's historical revert rate",
    timing: 'Opened during higher-risk time window',
  };

  return sorted
    .filter(([, val]) => val.contributionPoints > 2) // skip negligible contributors
    .map(([key, val]) => ({
      label: labels[key] || key,
      points: val.contributionPoints,
      detail: val.detail,
    }));
}
