import { isSensitivePath, isTestPath } from './sensitivePaths.js';

/**
 * Each extractor takes raw PR data (files changed, additions, deletions, etc.)
 * and returns { score: 0-1, detail: {...} } so the dashboard can explain WHY
 * a PR got the score it did. Scores are normalized so weighting/combining
 * them later is consistent regardless of repo size or language.
 */

// --- 1. Diff size ---
// Larger diffs are harder to review thoroughly and historically correlate
// with higher defect rates (well-documented in software engineering research,
// e.g. studies on code review effectiveness vs. change size).
export function scoreDiffSize(pr) {
  const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
  // Logarithmic-ish bucketing: diminishing marginal risk increase per line,
  // but a hard ceiling so massive diffs always read as high risk.
  let score;
  if (totalChanges <= 20) score = 0.05;
  else if (totalChanges <= 100) score = 0.25;
  else if (totalChanges <= 300) score = 0.5;
  else if (totalChanges <= 600) score = 0.75;
  else score = 1.0;

  return {
    score,
    detail: { totalChanges, additions: pr.additions, deletions: pr.deletions, changedFiles: pr.changed_files },
  };
}

// --- 2. Sensitive path touch ---
// Touching auth/payments/config/migrations carries higher blast radius
// than touching, say, a CSS file, independent of line count.
export function scoreSensitivePaths(filePaths) {
  let maxWeight = 0;
  const hits = [];

  for (const filePath of filePaths) {
    const matches = isSensitivePath(filePath);
    for (const match of matches) {
      hits.push(match);
      if (match.weight > maxWeight) maxWeight = match.weight;
    }
  }

  // Score scales with the most severe single hit, with a small bump
  // for multiple distinct sensitive areas being touched at once.
  const distinctLabels = new Set(hits.map((h) => h.label)).size;
  const multiAreaBump = Math.min(distinctLabels * 0.05, 0.15);
  const score = Math.min(maxWeight + multiAreaBump, 1.0);

  return { score, detail: { hits, distinctSensitiveAreas: distinctLabels } };
}

// --- 3. Test coverage ratio ---
// A non-trivial PR with zero test changes is a real-world red flag —
// not a guarantee of a bug, but a missing safety net.
export function scoreTestRatio(filePaths, totalChanges) {
  const testFiles = filePaths.filter(isTestPath);
  const sourceFiles = filePaths.filter((f) => !isTestPath(f));
  const hasTestChanges = testFiles.length > 0;

  let score;
  if (totalChanges <= 15) {
    // Trivial changes don't need tests; don't penalize.
    score = 0.0;
  } else if (hasTestChanges) {
    // Some tests changed — lower risk, scaled slightly by ratio.
    const ratio = testFiles.length / Math.max(sourceFiles.length, 1);
    score = Math.max(0.05, 0.3 - Math.min(ratio, 0.3));
  } else {
    // Non-trivial diff, zero test changes — flagged.
    score = totalChanges > 150 ? 0.9 : 0.65;
  }

  return { score, detail: { testFilesChanged: testFiles.length, sourceFilesChanged: sourceFiles.length, hasTestChanges } };
}

// --- 4. Complexity delta ---
// Placeholder-friendly: if a static complexity analyzer ran (radon for Python,
// or an eslint complexity report for JS), pass the before/after numbers in.
// If unavailable for this language/repo, this gracefully degrades to neutral.
export function scoreComplexityDelta(complexityBefore, complexityAfter) {
  if (complexityBefore == null || complexityAfter == null) {
    return { score: 0.2, detail: { available: false, note: 'complexity analysis unavailable for this file type' } };
  }
  const delta = complexityAfter - complexityBefore;
  let score;
  if (delta <= 0) score = 0.05; // complexity reduced or unchanged — good
  else if (delta <= 5) score = 0.3;
  else if (delta <= 15) score = 0.6;
  else score = 0.9;

  return { score, detail: { complexityBefore, complexityAfter, delta } };
}

// --- 5. Author historical revert rate ---
// If this author's past PRs in this repo have been reverted/hotfixed more
// often than baseline, weight their current PR slightly higher. This is a
// soft signal — explicitly NOT meant to penalize a single bad day, hence
// the dampening (we don't let this dominate the score).
export function scoreAuthorHistory(authorStats) {
  if (!authorStats || authorStats.total_prs < 5) {
    // Not enough history to judge fairly — neutral score.
    return { score: 0.15, detail: { available: false, note: 'insufficient PR history for this author' } };
  }
  const revertRate = authorStats.revert_rate || 0;
  // Dampen: even a 50% historical revert rate doesn't push score past 0.6
  const score = Math.min(revertRate * 1.2, 0.6);
  return { score, detail: { totalPRs: authorStats.total_prs, revertRate, repoAverageCompared: true } };
}

// --- 6. Timing risk ---
// Soft signal: PRs opened/merged late at night or right before a weekend
// historically see less careful review. Capped low weight by design.
export function scoreTimingRisk(openedAt) {
  const date = new Date(openedAt);
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday

  let score = 0.05;
  if (hour >= 22 || hour <= 5) score = 0.3; // late night
  if (day === 5 && hour >= 15) score = Math.max(score, 0.25); // Friday afternoon/evening
  if (day === 6 || day === 0) score = Math.max(score, 0.2); // weekend

  return { score, detail: { hour, day, isLateNight: hour >= 22 || hour <= 5, isFridayEvening: day === 5 && hour >= 15 } };
}
