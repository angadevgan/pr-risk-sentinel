const RISK_LEVEL_EMOJI = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

const RISK_LEVEL_CONCLUSION = {
  low: 'success',
  medium: 'neutral',
  high: 'action_required',
  critical: 'failure',
};

/**
 * Builds the markdown summary posted as a GitHub Check Run.
 * Kept in its own function so it's testable without hitting the GitHub API.
 */
export function buildCheckSummary(riskResult, topDrivers, prMeta) {
  const emoji = RISK_LEVEL_EMOJI[riskResult.riskLevel];
  const lines = [
    `## ${emoji} Risk Score: ${riskResult.score}/100 (${riskResult.riskLevel.toUpperCase()})`,
    '',
    `**${prMeta.changedFiles} files changed, +${prMeta.additions}/-${prMeta.deletions}**`,
    '',
  ];

  if (topDrivers.length > 0) {
    lines.push('### Top risk factors');
    for (const driver of topDrivers) {
      lines.push(`- **${driver.label}** (+${driver.points} pts)`);
    }
    lines.push('');
  } else {
    lines.push('No significant risk factors detected. ✅');
    lines.push('');
  }

  lines.push('<details><summary>Full breakdown</summary>\n');
  for (const [key, val] of Object.entries(riskResult.breakdown)) {
    lines.push(`- **${key}**: raw=${val.rawScore.toFixed(2)}, weight=${val.weight}, contribution=${val.contributionPoints}pts`);
  }
  lines.push('\n</details>');
  lines.push('');
  lines.push(`_Model: \`${riskResult.modelVersion}\` · [View full dashboard](${process.env.DASHBOARD_URL || '#'})_`);

  return lines.join('\n');
}

export async function postRiskCheck(octokit, { owner, repo, head_sha }, riskResult, topDrivers, prMeta) {
  const summary = buildCheckSummary(riskResult, topDrivers, prMeta);

  return octokit.checks.create({
    owner,
    repo,
    name: 'PR Risk Sentinel',
    head_sha,
    status: 'completed',
    conclusion: RISK_LEVEL_CONCLUSION[riskResult.riskLevel],
    output: {
      title: `Risk Score: ${riskResult.score}/100 (${riskResult.riskLevel})`,
      summary,
    },
  });
}

export async function postOrUpdateComment(octokit, { owner, repo, issue_number }, riskResult, topDrivers, prMeta) {
  const body = buildCheckSummary(riskResult, topDrivers, prMeta);
  const marker = '<!-- pr-risk-sentinel -->';
  const fullBody = `${marker}\n${body}`;

  const { data: comments } = await octokit.issues.listComments({ owner, repo, issue_number });
  const existing = comments.find((c) => c.body?.includes(marker));

  if (existing) {
    return octokit.issues.updateComment({ owner, repo, comment_id: existing.id, body: fullBody });
  }
  return octokit.issues.createComment({ owner, repo, issue_number, body: fullBody });
}
