/**
 * Raw Express webhook handler that bypasses Probot's signature verification.
 * We receive the GitHub payload directly, parse it, and call our processing
 * pipeline manually. This gives us full control over auth and error handling.
 */
import express from 'express';
import { processPullRequest } from './services/prService.js';
import { postRiskCheck, postOrUpdateComment } from './services/githubChecks.js';
import { events, PR_SCORED_EVENT } from './services/eventBus.js';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

// Parse raw body for webhook (needed for signature verification if we add it back later)
router.use(express.json({ type: 'application/json' }));

function getOctokit(installationId) {
  const privateKey = process.env.PRIVATE_KEY || 
  fs.readFileSync(path.resolve(process.cwd(), process.env.PRIVATE_KEY_PATH || './private-key.pem'), 'utf-8');

  const auth = createAppAuth({
    appId: process.env.APP_ID,
    privateKey,
    installationId,
  });

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.APP_ID,
      privateKey,
      installationId,
    },
  });
}

router.post('/', async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`[webhook] Received: ${event} / ${payload?.action}`);

  // Acknowledge immediately — GitHub expects a fast response
  res.status(200).json({ ok: true });

  // Only process pull_request events we care about
  if (event !== 'pull_request') return;
  if (!['opened', 'synchronize', 'reopened'].includes(payload.action)) return;

  const pr = payload.pull_request;
  const repo = payload.repository;
  const installation = payload.installation;

  if (!pr || !repo || !installation) {
    console.error('[webhook] Missing pr, repo, or installation in payload');
    return;
  }

  try {
    const octokit = getOctokit(installation.id);

    const { data: files } = await octokit.pulls.listFiles({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: pr.number,
      per_page: 100,
    });
    const filePaths = files.map((f) => f.filename);

    console.log(`[webhook] Processing PR #${pr.number} in ${repo.full_name} (${filePaths.length} files)`);

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

    events.emit(PR_SCORED_EVENT, {
      repoId: repo.id,
      pr: {
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

    console.log(`[webhook] ✅ PR #${pr.number} scored: ${riskResult.score} (${riskResult.riskLevel})`);
  } catch (err) {
    console.error(`[webhook] ❌ Failed to process PR #${pr.number}:`, err.message);
    console.error(err);
  }
});

export default router;
