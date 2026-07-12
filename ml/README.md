# ml/

Not part of the running application. `train_isolation_forest.py` is a prototype sketch of an
unsupervised 6th anomaly voter, kept here for reference after discussing whether a RandomForest
or IsolationForest could improve detection — see `PROMPTS.md`. It reads directly from the same
Postgres database as the server but isn't imported, scheduled, or called by any Node code, and
isn't run in CI.
