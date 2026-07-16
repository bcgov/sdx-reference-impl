-- sdx-reference-impl database bootstrap
-- Run as a PostgreSQL superuser, for example postgres.
--
-- This creates:
--   database: sdx_reference_impl
--   schema:   widgets
--   users:
--     sdx_reference_impl_migrator
--     sdx_reference_impl_app

-- IMPORTANT:
-- Replace these passwords before running.
-- Do not commit real passwords to Git.

CREATE DATABASE sdx_reference_impl;

\connect sdx_reference_impl

CREATE USER sdx_reference_impl_migrator
  WITH PASSWORD '<replace-with-migrator-password>';

CREATE USER sdx_reference_impl_app
  WITH PASSWORD '<replace-with-app-password>';

CREATE SCHEMA widgets
  AUTHORIZATION sdx_reference_impl_migrator;

GRANT CONNECT ON DATABASE sdx_reference_impl
  TO sdx_reference_impl_migrator;

GRANT CREATE ON DATABASE sdx_reference_impl
  TO sdx_reference_impl_migrator;

GRANT CONNECT ON DATABASE sdx_reference_impl
  TO sdx_reference_impl_app;

GRANT USAGE ON SCHEMA widgets
  TO sdx_reference_impl_app;

GRANT USAGE, CREATE ON SCHEMA widgets
  TO sdx_reference_impl_migrator;

ALTER DEFAULT PRIVILEGES
  FOR USER sdx_reference_impl_migrator
  IN SCHEMA widgets
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO sdx_reference_impl_app;

ALTER DEFAULT PRIVILEGES
  FOR USER sdx_reference_impl_migrator
  IN SCHEMA widgets
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES
  TO sdx_reference_impl_app;

ALTER ROLE sdx_reference_impl_migrator
  IN DATABASE sdx_reference_impl
  SET search_path = widgets, public;

ALTER ROLE sdx_reference_impl_app
  IN DATABASE sdx_reference_impl
  SET search_path = widgets, public;
