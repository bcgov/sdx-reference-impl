\connect sdx_reference_impl

SELECT schema_name, schema_owner
FROM information_schema.schemata
WHERE schema_name = 'widgets';

SELECT
  'sdx_reference_impl_app' AS role,
  has_schema_privilege('sdx_reference_impl_app', 'widgets', 'USAGE') AS usage,
  has_schema_privilege('sdx_reference_impl_app', 'widgets', 'CREATE') AS create
UNION ALL
SELECT
  'sdx_reference_impl_migrator' AS role,
  has_schema_privilege('sdx_reference_impl_migrator', 'widgets', 'USAGE') AS usage,
  has_schema_privilege('sdx_reference_impl_migrator', 'widgets', 'CREATE') AS create;

SELECT
  defaclrole::regrole AS owner_role,
  defaclnamespace::regnamespace AS schema_name,
  defaclobjtype AS object_type,
  defaclacl AS privileges
FROM pg_default_acl
WHERE defaclrole = 'sdx_reference_impl_migrator'::regrole
ORDER BY defaclnamespace::regnamespace::text, defaclobjtype;

SELECT
  r.rolname,
  d.datname,
  s.setconfig
FROM pg_db_role_setting s
JOIN pg_roles r ON r.oid = s.setrole
JOIN pg_database d ON d.oid = s.setdatabase
WHERE r.rolname IN ('sdx_reference_impl_migrator', 'sdx_reference_impl_app')
  AND d.datname = 'sdx_reference_impl'
ORDER BY r.rolname;
