-- PR Risk Sentinel — Database Schema
-- Multi-tenant: every repo belongs to an installation (a GitHub App install on an org/user)

CREATE TABLE IF NOT EXISTS installations (
  id SERIAL PRIMARY KEY,
  github_installation_id BIGINT UNIQUE NOT NULL,
  account_login TEXT NOT NULL,       -- org or user the app is installed on
  account_type TEXT NOT NULL,        -- 'Organization' or 'User'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id SERIAL PRIMARY KEY,
  installation_id INTEGER REFERENCES installations(id) ON DELETE CASCADE,
  github_repo_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,           -- e.g. "angadevgan/saas-pm"
  default_branch TEXT DEFAULT 'main',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER REFERENCES repos(id) ON DELETE CASCADE,
  github_pr_id BIGINT NOT NULL,
  pr_number INTEGER NOT NULL,
  title TEXT,
  author_login TEXT,
  state TEXT,                        -- open, closed, merged
  base_branch TEXT,
  head_branch TEXT,
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  changed_files INTEGER DEFAULT 0,
  opened_at TIMESTAMPTZ,
  merged_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(repo_id, github_pr_id)
);

-- Raw extracted features per PR (the explainable inputs to the risk score)
CREATE TABLE IF NOT EXISTS risk_features (
  id SERIAL PRIMARY KEY,
  pull_request_id INTEGER REFERENCES pull_requests(id) ON DELETE CASCADE UNIQUE,
  diff_size_score REAL,              -- normalized 0-1
  sensitive_path_score REAL,
  test_ratio_score REAL,
  complexity_delta_score REAL,
  author_revert_rate_score REAL,
  timing_risk_score REAL,
  touched_files JSONB,               -- list of changed file paths
  sensitive_paths_hit JSONB,         -- which sensitive patterns matched
  has_test_changes BOOLEAN,
  raw_metrics JSONB,                 -- catch-all for debugging/extending
  computed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_scores (
  id SERIAL PRIMARY KEY,
  pull_request_id INTEGER REFERENCES pull_requests(id) ON DELETE CASCADE UNIQUE,
  score REAL NOT NULL,               -- 0-100
  risk_level TEXT NOT NULL,          -- low, medium, high, critical
  breakdown JSONB,                   -- {feature: contribution} for explainability UI
  model_version TEXT DEFAULT 'rule-based-v1',
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- Outcome tracking: was this PR later reverted/hotfixed? (labels for future ML training)
CREATE TABLE IF NOT EXISTS pr_outcomes (
  id SERIAL PRIMARY KEY,
  pull_request_id INTEGER REFERENCES pull_requests(id) ON DELETE CASCADE UNIQUE,
  was_reverted BOOLEAN DEFAULT false,
  was_hotfixed BOOLEAN DEFAULT false,
  revert_pr_number INTEGER,
  detected_at TIMESTAMPTZ,
  detection_method TEXT              -- 'commit-message-heuristic', 'manual', etc.
);

CREATE TABLE IF NOT EXISTS author_stats (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER REFERENCES repos(id) ON DELETE CASCADE,
  author_login TEXT NOT NULL,
  total_prs INTEGER DEFAULT 0,
  reverted_prs INTEGER DEFAULT 0,
  revert_rate REAL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(repo_id, author_login)
);

CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_pr_opened ON pull_requests(opened_at);
CREATE INDEX IF NOT EXISTS idx_scores_pr ON risk_scores(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_repos_installation ON repos(installation_id);
