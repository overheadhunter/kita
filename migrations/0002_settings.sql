-- Settings staff can change at runtime, e.g. `total_families` for the heatmap's confidence value.
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
