import { processPullRequest } from '../services/prService.js';
import { postRiskCheck, postOrUpdateComment } from '../services/githubChecks.js';
import { events, PR_SCORED_EVENT } from '../services/eventBus.js';

/**
 * Probot app entry point. Probot handles webhook signature verification,
 * installation auth tokens, and octokit client setup for us — this is
 * the standard framework GitHub itself recommends for building Apps.
 * comment
 */
export default (app, { getRouter }) => {
  app.log.info('PR Risk Sentinel app loaded');

  // Fired when a PR is opened or new commits are pushed to it
  app.on(['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'], async (context) => {
    const { payload, octokit } = context;
    const { pull_request: pr, repository: repo, installation } = payload;

    app.log.info(`Processing PR #${pr.number} in ${repo.full_name}`);

    try {
      // Fetch the list of changed files (paginated API, but most PRs fit in one page)
      const { data: files } = await octokit.pulls.listFiles({
        owner: repo.owner.login,
        repo: repo.name,
        pull_number: pr.number,
        per_page: 100,
      });
      const filePaths = files.map((f) => f.filename);

      const { riskResult, topDrivers } = await processPullRequest(
        installation,
        repo,
        pr,
        filePaths
      );

      const prMeta = {
        changedFiles: pr.changed_files,
        additions: pr.additions,
        deletions: pr.deletions,
      };

      // Post both a Check Run (shows in the PR's checks tab) and a sticky comment
      // (more visible to reviewers who don't click into checks).
      await postRiskCheck(
        octokit,
        { owner: repo.owner.login, repo: repo.name, head_sha: pr.head.sha },
        riskResult,
        topDrivers,
        prMeta
      );

      await postOrUpdateComment(
        octokit,
        { owner: repo.owner.login, repo: repo.name, issue_number: pr.number },
        riskResult,
        topDrivers,
        prMeta
      );

      // Push live update to any connected dashboard clients via the event bus
      events.emit(PR_SCORED_EVENT, {
        repoId: payload.repository.id, // github_repo_id; index.js maps this to internal repo row
        pr: {
          id: pr.id,
          pr_number: pr.number,
          title: pr.title,
          author_login: pr.user?.login,
          state: pr.merged ? 'merged' : pr.state,
          additions: pr.additions,
          deletions: pr.deletions,
          changed_files: pr.changed_files,
          opened_at: pr.created_at,
          score: riskResult.score,
          risk_level: riskResult.riskLevel,
        },
      });

      app.log.info(`PR #${pr.number} scored: ${riskResult.score} (${riskResult.riskLevel})`);
    } catch (err) {
      app.log.error(`Failed to process PR #${pr.number}: ${err.message}`);
      console.error(err);
    }
  });

  // Track merges so we can later correlate with reverts/hotfixes for outcome labeling
  app.on('pull_request.closed', async (context) => {
    const { payload } = context;
    const { pull_request: pr, repository: repo } = payload;
    if (pr.merged) {
      app.log.info(`PR #${pr.number} merged in ${repo.full_name} — eligible for outcome tracking`);
      // Outcome tracking (revert/hotfix detection) runs as a separate scheduled
      // job (see scripts/trackOutcomes.js) since reverts happen after the fact.
    }
  });

  // Health check route exposed through Probot's underlying Express router
  const router = getRouter('/api');
  router.get('/health', (req, res) => res.json({ status: 'ok', service: 'pr-risk-sentinel' }));
};

