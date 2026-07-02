import { query } from '../db/index.js';
import { computeRiskScore, explainTopDrivers } from '../risk-engine/index.js';

export async function upsertInstallation(payload) {
  const { id, account } = payload;
  const res = await query(
    `INSERT INTO installations (github_installation_id, account_login, account_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (github_installation_id) DO UPDATE SET account_login = $2
     RETURNING id`,
    [id, account.login, account.type]
  );
  return res.rows[0].id;
}

export async function upsertRepo(installationDbId, repo) {
  const res = await query(
    `INSERT INTO repos (installation_id, github_repo_id, full_name, default_branch)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_repo_id) DO UPDATE SET full_name = $3
     RETURNING id`,
    [installationDbId, repo.id, repo.full_name, repo.default_branch || 'main']
  );
  return res.rows[0].id;
}

export async function upsertPullRequest(repoDbId, pr) {
  const res = await query(
    `INSERT INTO pull_requests
      (repo_id, github_pr_id, pr_number, title, author_login, state, base_branch, head_branch,
       additions, deletions, changed_files, opened_at, merged_at, closed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (repo_id, github_pr_id) DO UPDATE SET
       state = $6, merged_at = $13, closed_at = $14,
       additions = $9, deletions = $10, changed_files = $11
     RETURNING id`,
    [
      repoDbId,
      pr.id,
      pr.number,
      pr.title,
      pr.user?.login,
      pr.merged ? 'merged' : pr.state,
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
  return res.rows[0].id;
}

export async function getAuthorStats(repoDbId, authorLogin) {
  const res = await query(
    `SELECT total_prs, reverted_prs, revert_rate FROM author_stats
     WHERE repo_id = $1 AND author_login = $2`,
    [repoDbId, authorLogin]
  );
  return res.rows[0] || null;
}

export async function saveRiskAssessment(pullRequestDbId, filePaths, riskResult) {
  await query(
    `INSERT INTO risk_features
      (pull_request_id, diff_size_score, sensitive_path_score, test_ratio_score,
       complexity_delta_score, author_revert_rate_score, timing_risk_score,
       touched_files, sensitive_paths_hit, has_test_changes, raw_metrics)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (pull_request_id) DO UPDATE SET
       diff_size_score=$2, sensitive_path_score=$3, test_ratio_score=$4,
       complexity_delta_score=$5, author_revert_rate_score=$6, timing_risk_score=$7,
       touched_files=$8, sensitive_paths_hit=$9, has_test_changes=$10, raw_metrics=$11,
       computed_at = now()`,
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
     ON CONFLICT (pull_request_id) DO UPDATE SET
       score=$2, risk_level=$3, breakdown=$4, model_version=$5, computed_at = now()`,
    [pullRequestDbId, riskResult.score, riskResult.riskLevel, JSON.stringify(riskResult.breakdown), riskResult.modelVersion]
  );
}

/**
 * Full pipeline: given raw GitHub PR payload + changed files, persist everything
 * and return the computed risk assessment ready to post back to GitHub.
 */
export async function processPullRequest(installationPayload, repoPayload, prPayload, filePaths) {
  const installationDbId = await upsertInstallation(installationPayload);
  const repoDbId = await upsertRepo(installationDbId, repoPayload);
  const pullRequestDbId = await upsertPullRequest(repoDbId, prPayload);
  const authorStats = await getAuthorStats(repoDbId, prPayload.user?.login);

  const riskResult = computeRiskScore(
    {
      additions: prPayload.additions,
      deletions: prPayload.deletions,
      changed_files: prPayload.changed_files,
      opened_at: prPayload.created_at,
    },
    filePaths,
    { authorStats }
  );

  await saveRiskAssessment(pullRequestDbId, filePaths, riskResult);

  const topDrivers = explainTopDrivers(riskResult.breakdown);

  return { pullRequestDbId, repoDbId, riskResult, topDrivers };
}
