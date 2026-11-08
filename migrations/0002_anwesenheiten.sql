-- Tool /anwesenheiten: one row per child and week; see CLAUDE.md for the format of `days`.
-- Removing a family removes all its plans, including past weeks (D1 always enforces foreign keys).
CREATE TABLE anwesenheiten_plans (
  family_id  INTEGER NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  child      INTEGER NOT NULL, -- 1..families.children
  week       TEXT NOT NULL,    -- Monday as YYYY-MM-DD
  days       TEXT NOT NULL,    -- JSON array of 5 entries, each null or {"from": 7..15, "to": 8..16}
  updated_at TEXT NOT NULL,    -- ISO 8601 timestamp
  PRIMARY KEY (family_id, child, week)
);

-- the heatmap reads all rows of one week
CREATE INDEX anwesenheiten_plans_week ON anwesenheiten_plans (week);
