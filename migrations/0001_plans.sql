-- Families with their secret link token; managed by staff in the app.
CREATE TABLE families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE, -- the `#t=` value of the family's link
  created_at TEXT NOT NULL
);

-- One row per family and week; see CLAUDE.md for the format of `days`.
-- No foreign key on purpose: removing a family keeps its past plans, so past heatmaps stay unchanged.
CREATE TABLE plans (
  family_id  INTEGER NOT NULL,
  week       TEXT NOT NULL, -- Monday as YYYY-MM-DD
  days       TEXT NOT NULL, -- JSON array of 5 entries, each null or {"from": 7..15, "to": 8..16}
  updated_at TEXT NOT NULL, -- ISO 8601 timestamp
  PRIMARY KEY (family_id, week)
);

-- the heatmap reads all rows of one week
CREATE INDEX plans_week ON plans (week);
