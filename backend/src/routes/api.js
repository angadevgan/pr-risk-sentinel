import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// List repos for the logged-in installation
router.get('/repos', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.full_name, r.is_active, r.created_at,
              COUNT(pr.id) as total_prs
       FROM repos r
       LEFT JOIN pull_requests pr ON pr.repo_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// List PRs for a repo with their risk scores, paginated, newest first
router.get('/repos/:repoId/prs', async (req, res) => {
  const { repoId } = req.params;
  const { limit = 50, offset = 0, riskLevel } = req.query;

  try {
    const params = [repoId];
    let riskFilter = '';
    if (riskLevel) {
      params.push(riskLevel);
      riskFilter = `AND rs.risk_level = $${params.length}`;
    }
    params.push(limit, offset);

    const result = await query(
      `SELECT pr.id, pr.pr_number, pr.title, pr.author_login, pr.state,
              pr.additions, pr.deletions, pr.changed_files, pr.opened_at, pr.merged_at,
              rs.score, rs.risk_level, rs.breakdown, rs.model_version,
              po.was_reverted, po.was_hotfixed
       FROM pull_requests pr
       LEFT JOIN risk_scores rs ON rs.pull_request_id = pr.id
       LEFT JOIN pr_outcomes po ON po.pull_request_id = pr.id
       WHERE pr.repo_id = $1 ${riskFilter}
       ORDER BY pr.opened_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch PRs' });
  }
});

// Single PR detail with full feature breakdown
router.get('/prs/:prId', async (req, res) => {
  const { prId } = req.params;
  try {
    const result = await query(
      `SELECT pr.*, rs.score, rs.risk_level, rs.breakdown, rs.model_version,
              rf.touched_files, rf.sensitive_paths_hit, rf.has_test_changes,
              po.was_reverted, po.was_hotfixed
       FROM pull_requests pr
       LEFT JOIN risk_scores rs ON rs.pull_request_id = pr.id
       LEFT JOIN risk_features rf ON rf.pull_request_id = pr.id
       LEFT JOIN pr_outcomes po ON po.pull_request_id = pr.id
       WHERE pr.id = $1`,
      [prId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'PR not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch PR detail' });
  }
});

// Risk distribution + trend over time for charts
router.get('/repos/:repoId/analytics', async (req, res) => {
  const { repoId } = req.params;
  try {
    const distribution = await query(
      `SELECT rs.risk_level, COUNT(*) as count
       FROM risk_scores rs
       JOIN pull_requests pr ON pr.id = rs.pull_request_id
       WHERE pr.repo_id = $1
       GROUP BY rs.risk_level`,
      [repoId]
    );

    const trend = await query(
      `SELECT DATE_TRUNC('week', pr.opened_at) as week,
              AVG(rs.score) as avg_score,
              COUNT(*) as pr_count
       FROM pull_requests pr
       JOIN risk_scores rs ON rs.pull_request_id = pr.id
       WHERE pr.repo_id = $1
       GROUP BY week
       ORDER BY week ASC`,
      [repoId]
    );

    const hotspotFiles = await query(
      `SELECT jsonb_array_elements_text(rf.touched_files) as file_path,
              COUNT(*) as touch_count,
              AVG(rs.score) as avg_risk_score
       FROM risk_features rf
       JOIN pull_requests pr ON pr.id = rf.pull_request_id
       JOIN risk_scores rs ON rs.pull_request_id = pr.id
       WHERE pr.repo_id = $1
       GROUP BY file_path
       ORDER BY avg_risk_score DESC, touch_count DESC
       LIMIT 10`,
      [repoId]
    );

    const authorLeaderboard = await query(
      `SELECT pr.author_login,
              COUNT(*) as total_prs,
              AVG(rs.score) as avg_risk_score,
              SUM(CASE WHEN po.was_reverted THEN 1 ELSE 0 END) as reverted_count
       FROM pull_requests pr
       LEFT JOIN risk_scores rs ON rs.pull_request_id = pr.id
       LEFT JOIN pr_outcomes po ON po.pull_request_id = pr.id
       WHERE pr.repo_id = $1
       GROUP BY pr.author_login
       ORDER BY avg_risk_score DESC`,
      [repoId]
    );

    res.json({
      distribution: distribution.rows,
      trend: trend.rows,
      hotspotFiles: hotspotFiles.rows,
      authorLeaderboard: authorLeaderboard.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
