-- Runs once when the local database volume is created.
-- The API connects as a NON-superuser role, because superusers bypass row-level security.
CREATE ROLE digigold LOGIN PASSWORD 'digigold' NOSUPERUSER CREATEDB;
CREATE DATABASE digigold OWNER digigold;
CREATE DATABASE digigold_test OWNER digigold;
