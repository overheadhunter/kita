-- Demo data for local development only (`pnpm db:seed`). Not in migrations/, because wrangler would apply it as a migration.
-- Familie A only has the week of 2026-10-26, so the following weeks show a prefill. Families 4–6 have no plans at all.
-- Readable tokens for convenience; families added in the app get UUIDs.
DELETE FROM plans;
DELETE FROM families;
DELETE FROM settings;
INSERT INTO families (id, name, token, created_at) VALUES
  (1, 'Familie A', 'familie-a', '2026-10-01T00:00:00Z'),
  (2, 'Familie B', 'familie-b', '2026-10-01T00:00:00Z'),
  (3, 'Familie C', 'familie-c', '2026-10-01T00:00:00Z'),
  (4, 'Familie D', 'familie-d', '2026-10-01T00:00:00Z'),
  (5, 'Familie E', 'familie-e', '2026-10-01T00:00:00Z'),
  (6, 'Familie F', 'familie-f', '2026-10-01T00:00:00Z'),
  (7, 'Familie G', 'familie-g', '2026-10-01T00:00:00Z'),
  (8, 'Familie H', 'familie-h', '2026-10-01T00:00:00Z');
INSERT INTO plans (family_id, week, days, updated_at) VALUES
  (1, '2026-10-26', '[{"from":8,"to":13},{"from":8,"to":13},null,{"from":8,"to":15},{"from":8,"to":12}]', '2026-10-24T10:00:00Z'),
  (2, '2026-11-02', '[{"from":7,"to":16},{"from":7,"to":16},{"from":7,"to":14},{"from":7,"to":16},{"from":7,"to":12}]', '2026-10-31T10:00:00Z'),
  (3, '2026-11-02', '[{"from":9,"to":15},null,{"from":9,"to":15},null,{"from":9,"to":12}]', '2026-10-31T10:00:00Z'),
  (7, '2026-11-02', '[{"from":8,"to":14},{"from":8,"to":14},{"from":8,"to":14},{"from":8,"to":14},{"from":8,"to":12}]', '2026-10-31T10:00:00Z'),
  (8, '2026-11-02', '[{"from":8,"to":16},{"from":8,"to":16},null,{"from":8,"to":16},{"from":8,"to":13}]', '2026-10-31T10:00:00Z'),
  (2, '2026-11-09', '[{"from":7,"to":16},{"from":7,"to":16},{"from":7,"to":14},{"from":7,"to":16},{"from":7,"to":12}]', '2026-11-06T10:00:00Z'),
  (7, '2026-11-09', '[{"from":8,"to":14},{"from":8,"to":14},{"from":8,"to":14},{"from":8,"to":14},{"from":8,"to":12}]', '2026-11-06T10:00:00Z'),
  (8, '2026-11-09', '[{"from":8,"to":16},null,null,{"from":8,"to":16},{"from":8,"to":13}]', '2026-11-06T10:00:00Z');
