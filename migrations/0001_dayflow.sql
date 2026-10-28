CREATE TABLE dayflow_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  payload TEXT NOT NULL
);
