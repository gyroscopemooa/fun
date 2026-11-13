CREATE TABLE IF NOT EXISTS account_users(sub TEXT PRIMARY KEY,email TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_sessions(hash TEXT PRIMARY KEY,sub TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS account_sessions_sub ON account_sessions(sub);
CREATE INDEX IF NOT EXISTS account_sessions_expires ON account_sessions(expires);
CREATE TABLE IF NOT EXISTS account_challenges(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_limits(hash TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
