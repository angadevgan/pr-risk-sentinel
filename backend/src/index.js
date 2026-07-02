import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import apiRoutes from './routes/api.js';
import webhookRouter from './webhook.js';
import { query } from './db/index.js';
import { trackOutcomesForRepo, recomputeAuthorStats } from './services/outcomeTracking.js';
import { events, PR_SCORED_EVENT } from './services/eventBus.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const expressApp = express();
expressApp.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Dashboard REST API
expressApp.use('/api', apiRoutes);

// Raw webhook handler — no Probot signature verification issues
expressApp.use('/webhooks', webhookRouter);

const httpServer = createServer(expressApp);

export const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*' },
});

io.on('connection', (socket) => {
  console.log('Dashboard client connected:', socket.id);
  socket.on('subscribe:repo', (repoId) => {
    socket.join(`repo:${repoId}`);
  });
});

export function broadcastPRScored(repoId, prData) {
  io.to(`repo:${repoId}`).emit('pr:scored', prData);
}

events.on(PR_SCORED_EVENT, async ({ repoId: githubRepoId, pr }) => {
  try {
    const result = await query('SELECT id FROM repos WHERE github_repo_id = $1', [githubRepoId]);
    if (result.rows.length === 0) return;
    broadcastPRScored(result.rows[0].id, pr);
  } catch (err) {
    console.error('Failed to broadcast PR scored event:', err);
  }
});

cron.schedule('0 3 * * *', async () => {
  console.log('[cron] Running nightly outcome tracking...');
  try {
    const repos = await query(
      `SELECT r.id, r.full_name, r.default_branch, i.github_installation_id
       FROM repos r JOIN installations i ON i.id = r.installation_id
       WHERE r.is_active = true`
    );
    for (const repo of repos.rows) {
      const [owner, repoName] = repo.full_name.split('/');
      try {
        const { Octokit } = await import('@octokit/rest');
        const result = await trackOutcomesForRepo(new Octokit({ auth: process.env.GITHUB_TOKEN }), repo.id, owner, repoName, repo.default_branch);
        const authorsUpdated = await recomputeAuthorStats(repo.id);
        console.log(`[cron] ${repo.full_name}: ${result.revertsFound} reverts, ${result.hotfixesFound} hotfixes, ${authorsUpdated} authors updated`);
      } catch (err) {
        console.error(`[cron] Failed for ${repo.full_name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[cron] Outcome tracking job failed:', err);
  }
});

httpServer.listen(PORT, () => {
  console.log(`🚀 PR Risk Sentinel running on port ${PORT}`);
  console.log(`   Webhook endpoint: /webhooks`);
  console.log(`   Dashboard API: /api`);
});
