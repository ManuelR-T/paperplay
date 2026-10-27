-- Applied once through the hosting platform, never by a public request handler.
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  record TEXT NOT NULL CHECK (json_valid(record))
);
CREATE INDEX IF NOT EXISTS usage_created ON usage_records(created_at);

-- Only opted-in public-demo inputs/settings; never source text or PDFs.
-- Deleted payloads become tombstones until expiry so deletion cannot reset quotas.
CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  payload TEXT,
  delete_hash TEXT,
  session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS short_links_created ON short_links(created_at);
CREATE INDEX IF NOT EXISTS short_links_session ON short_links(session_id, created_at);
