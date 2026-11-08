-- Site-wide accounts: one row per family with its secret link token; managed by staff on /verwaltung and valid for every tool.
CREATE TABLE families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,         -- the `#t=` value of the family's link
  children   INTEGER NOT NULL DEFAULT 1,   -- number of children in the kindergarten; tools address them as 1..children (no names)
  created_at TEXT NOT NULL
);
