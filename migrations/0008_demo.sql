-- Live demo shelter: flagged org, reset on a schedule.

ALTER TABLE orgs ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;
