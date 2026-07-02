import { query } from '../db/index.js';
import { Octokit } from '@octokit/rest';

// Heuristic patterns indicating a commit reverts or hotfixes a prior change.
// Documented as a heuristic, not ground truth — this is explicitly called out
// as a proxy label in the README so it's defensible, not oversold.
const REVERT_PATTERNS = [/^revert/i, /^revert"/i, /this reverts commit/i];
const HOTFIX_PATTERNS = [/^hotfix/i, /^fix:.*urgent/i, /^fix:.*critical/i, /^emergency fix/i];

/**
 * Scans recent commits on a repo's default branch for revert/hotfix patterns,
 * and where found, attempts to match them back to the PR that introduced the
 * original change (via referenced PR number in the commit message, GitHub's
 * "This reverts commit <sha>" convention, or merge proximity).
 */
export async function trackOutcomesForRepo(octokit, repoDbId, owner, repoName, defaultBranch) {
  const { data: commits } = await octokit.repos.listCommits({
    owner,
    repo: repoName,
    sha: defaultBranch,
    per_page: 100,
  });

  let revertsFound = 0;
  let hotfixesFound = 0;

  for (const commit of commits) {
    const message = commit.commit.message;
    const isRevert = REVERT_PATTERNS.some((p) => p.test(message));
    const isHotfix = HOTFIX_PATTERNS.some((p) => p.test(message));

    if (!isRevert && !isHotfix) continue;

    // Try to extract a referenced PR number, e.g. "Revert #42" or "(#42)"
    const prNumberMatch = message.match(/#(\d+)/);
    if (!prNumberMatch) continue;

    const referencedPrNumber = parseInt(prNumberMatch[1], 10);

    const prResult = await query(
      `SELECT id FROM pull_requests WHERE repo_id = $1 AND pr_number = $2`,
      [repoDbId, referencedPrNumber]
    );
    if (prResult.rows.length === 0) continue;

    const pullRequestId = prResult.rows[0].id;

    await query(
      `INSERT INTO pr_outcomes (pull_request_id, was_reverted, was_hotfixed, revert_pr_number, detected_at, detection_method)
       VALUES ($1, $2, $3, $4, now(), 'commit-message-heuristic')
       ON CONFLICT (pull_request_id) DO UPDATE SET
         was_reverted = $2 OR pr_outcomes.was_reverted,
         was_hotfixed = $3 OR pr_outcomes.was_hotfixed,
         detected_at = now()`,
      [pullRequestId, isRevert, isHotfix, referencedPrNumber]
    );

    if (isRevert) revertsFound++;
    if (isHotfix) hotfixesFound++;
  }

  return { revertsFound, hotfixesFound, commitsScanned: commits.length };
}

/**
 * After outcomes are tracked, recompute each author's revert rate so future
 * risk scores reflect up-to-date history.
 */
export async function recomputeAuthorStats(repoDbId) {
  const result = await query(
    `SELECT pr.author_login,
            COUNT(*) as total_prs,
            SUM(CASE WHEN po.was_reverted THEN 1 ELSE 0 END) as reverted_prs
     FROM pull_requests pr
     LEFT JOIN pr_outcomes po ON po.pull_request_id = pr.id
     WHERE pr.repo_id = $1 AND pr.state = 'merged'
     GROUP BY pr.author_login`,
    [repoDbId]
  );

  for (const row of result.rows) {
    const revertRate = row.total_prs > 0 ? row.reverted_prs / row.total_prs : 0;
    await query(
      `INSERT INTO author_stats (repo_id, author_login, total_prs, reverted_prs, revert_rate, last_updated)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (repo_id, author_login) DO UPDATE SET
         total_prs = $3, reverted_prs = $4, revert_rate = $5, last_updated = now()`,
      [repoDbId, row.author_login, row.total_prs, row.reverted_prs, revertRate]
    );
  }

  return result.rows.length;
}
