-- Verify per-service database ownership on a production Postgres host.
-- Run inside the prod postgres container (or any client that can reach it):
--
--   docker exec -i ree-prod-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < scripts/ops/verify-prod-db-ownership.sql
--
-- Expect: nine owner databases (no leftover shared DB), each reachable.

\echo '=== Expected owner databases ==='
SELECT datname
FROM pg_database
WHERE datname LIKE 'realestate_eval_prod_%'
ORDER BY 1;

\echo '=== Missing expected databases (should be empty) ==='
WITH expected(name) AS (
  VALUES
    ('realestate_eval_prod_attachments'),
    ('realestate_eval_prod_identity'),
    ('realestate_eval_prod_platform'),
    ('realestate_eval_prod_valuation'),
    ('realestate_eval_prod_failures'),
    ('realestate_eval_prod_operations'),
    ('realestate_eval_prod_financial'),
    ('realestate_eval_prod_case_study'),
    ('realestate_eval_prod_messaging')
)
SELECT e.name AS missing
FROM expected e
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database d WHERE d.datname = e.name
);

\echo '=== Unexpected realestate_eval databases (should be empty) ==='
SELECT datname AS unexpected
FROM pg_database
WHERE datname LIKE 'realestate_eval%'
  AND datname NOT IN (
    'realestate_eval_prod_attachments',
    'realestate_eval_prod_identity',
    'realestate_eval_prod_platform',
    'realestate_eval_prod_valuation',
    'realestate_eval_prod_failures',
    'realestate_eval_prod_operations',
    'realestate_eval_prod_financial',
    'realestate_eval_prod_case_study',
    'realestate_eval_prod_messaging'
  )
ORDER BY 1;

\echo '=== Owner schema smoke (one table / migrations history per DB) ==='
\c realestate_eval_prod_case_study
SELECT nspname
FROM pg_namespace
WHERE nspname = 'case_study';
SELECT COUNT(*) AS case_study_migration_rows
FROM case_study."__EFMigrationsHistory";

\c realestate_eval_prod_identity
SELECT nspname FROM pg_namespace WHERE nspname = 'identity';

\c realestate_eval_prod_valuation
SELECT nspname FROM pg_namespace WHERE nspname = 'valuation';

\c realestate_eval_prod_operations
SELECT nspname FROM pg_namespace WHERE nspname = 'operations';

\c realestate_eval_prod_financial
SELECT nspname FROM pg_namespace WHERE nspname = 'financial';

\c realestate_eval_prod_failures
SELECT nspname FROM pg_namespace WHERE nspname = 'failures';

\c realestate_eval_prod_platform
SELECT nspname FROM pg_namespace WHERE nspname IN ('platform', 'audit') ORDER BY 1;

\c realestate_eval_prod_attachments
SELECT nspname FROM pg_namespace WHERE nspname = 'attachments';

\c realestate_eval_prod_messaging
SELECT nspname FROM pg_namespace WHERE nspname = 'messaging';

\echo '=== Done (review Missing / Unexpected sections above) ==='
