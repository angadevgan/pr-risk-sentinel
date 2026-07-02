/**
 * Backfill script: populates the database with historical PR data from a repo
 * so the dashboard has data to show immediately, instead of waiting for new
 * PRs to come in organically after installing the GitHub App.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx node scripts/backfill.js angadevgan/saas-pm
 *
 * Requires a GitHub Personal Access Token with repo:read scope (set as
 * GITHUB_TOKEN env var, separate from the GitHub App credentials used for
 * live webhook processing).
 */
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import { query, pool } from '../src/db/index.js';
import { computeRiskScore, explainTopDrivers } from '../src/risk-engine/index.js';

dotenv.config();

const repoArg = process.argv[2];
if (!repoArg || !repoArg.includes('/')) {
  console.error('Usage: node scripts/backfill.js <owner>/<repo>');
  process.exit(1);
}
const [owner, repoName] = repoArg.split('/');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function ensureInstallationAndRepo(repoData) {
  // Backfill creates a placeholder "installation" record for repos added via
  // PAT rather than a true GitHub App install, so the schema stays consistent.
  const instResult = await query(
    `INSERT INTO installations (github_installation_id, account_login, account_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (github_installation_id) DO UPDATE SET account_login = $2
     RETURNING id`,
    [-Math.abs(repoData.id), owner, 'BackfillSeed']
  );
  const installationDbId = instResult.rows[0].id;

  const repoResult = await query(
    `INSERT INTO repos (installation_id, github_repo_id, full_name, default_branch)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_repo_id) DO UPDATE SET full_name = $3
     RETURNING id`,
    [installationDbId, repoData.id, repoData.full_name, repoData.default_branch]
  );
  return repoResult.rows[0].id;
}

async function backfillPR(repoDbId, pr) {
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo: repoName,
    pull_number: pr.number,
    per_page: 100,
  });
  const filePaths = files.map((f) => f.filename);

  const prResult = await query(
    `INSERT INTO pull_requests
      (repo_id, github_pr_id, pr_number, title, author_login, state, base_branch, head_branch,
       additions, deletions, changed_files, opened_at, merged_at, closed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (repo_id, github_pr_id) DO UPDATE SET state = $6
     RETURNING id`,
    [
      repoDbId,
      pr.id,
      pr.number,
      pr.title,
      pr.user?.login,
      pr.merged_at ? 'merged' : pr.state,
      pr.base?.ref,
      pr.head?.ref,
      pr.additions || 0,
      pr.deletions || 0,
      pr.changed_files || 0,
      pr.created_at,
      pr.merged_at,
      pr.closed_at,
    ]
  );
  const pullRequestDbId = prResult.rows[0].id;

  const riskResult = computeRiskScore(
    {
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      opened_at: pr.created_at,
    },
    filePaths,
    { authorStats: null } // no history yet during initial backfill pass
  );

  await query(
    `INSERT INTO risk_features
      (pull_request_id, diff_size_score, sensitive_path_score, test_ratio_score,
       complexity_delta_score, author_revert_rate_score, timing_risk_score,
       touched_files, sensitive_paths_hit, has_test_changes, raw_metrics)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (pull_request_id) DO UPDATE SET computed_at = now()`,
    [
      pullRequestDbId,
      riskResult.breakdown.diffSize.rawScore,
      riskResult.breakdown.sensitivePaths.rawScore,
      riskResult.breakdown.testRatio.rawScore,
      riskResult.breakdown.complexityDelta.rawScore,
      riskResult.breakdown.authorHistory.rawScore,
      riskResult.breakdown.timing.rawScore,
      JSON.stringify(filePaths),
      JSON.stringify(riskResult.breakdown.sensitivePaths.detail.hits),
      riskResult.breakdown.testRatio.detail.hasTestChanges,
      JSON.stringify(riskResult.breakdown),
    ]
  );

  await query(
    `INSERT INTO risk_scores (pull_request_id, score, risk_level, breakdown, model_version)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (pull_request_id) DO UPDATE SET score=$2, risk_level=$3, breakdown=$4`,
    [pullRequestDbId, riskResult.score, riskResult.riskLevel, JSON.stringify(riskResult.breakdown), riskResult.modelVersion]
  );

  return riskResult;
}

async function main() {
  console.log(`Backfilling ${owner}/${repoName}...`);

  const { data: repoData } = await octokit.repos.get({ owner, repo: repoName });
  const repoDbId = await ensureInstallationAndRepo(repoData);

  let page = 1;
  let totalProcessed = 0;
  const perPage = 30;

  while (true) {
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo: repoName,
      state: 'all',
      per_page: perPage,
      page,
      sort: 'created',
      direction: 'desc',
    });

    if (prs.length === 0) break;

    for (const pr of prs) {
      try {
        const risk = await backfillPR(repoDbId, pr);
        console.log(`  PR #${pr.number} "${pr.title}" — score ${risk.score} (${risk.riskLevel})`);
        totalProcessed++;
      } catch (err) {
        console.error(`  Failed PR #${pr.number}:`, err.message);
      }
      // Light throttle to stay well within GitHub API rate limits
      await new Promise((r) => setTimeout(r, 150));
    }

    if (prs.length < perPage || totalProcessed >= 100) break; // cap at ~100 PRs for backfill
    page++;
  }

  console.log(`\n✅ Backfill complete: ${totalProcessed} PRs processed for ${owner}/${repoName}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
