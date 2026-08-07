# Database schema decisions

## Connection roles

- Application traffic uses `DATABASE_URL`. On Neon this may be the pooled
  endpoint whose hostname contains `-pooler`.
- Flyway uses `DATABASE_DIRECT_URL`, the direct endpoint for the same Neon
  branch and database.
- Database credentials are supplied by the deployment environment. They must
  not be committed to `application.yml`, `.env.example`, logs, or scripts.

The direct Flyway connection avoids depending on PgBouncer transaction-pooling
semantics for schema management and leaves the pooled endpoint available for
short application transactions.

## Migration invariants

- `validate-on-migrate` remains enabled.
- Never modify an existing file under `src/main/resources/db/migration` after
  it has been applied to a shared environment. Even comment or whitespace
  edits change the Flyway checksum.
- Every schema or managed-data change is delivered in a new versioned
  migration named `V{yyyyMMddHHmm}__description.sql`.
- Do not enable `baseline-on-migrate` without a reviewed adoption plan for the
  target database.

## Production deployment direction

For development and the current single-instance deployment, Spring Boot may
run Flyway during startup. Before scaling to multiple application instances,
move `flyway migrate` into a single deployment step that finishes before the
new application version starts. The runtime database role can then be reduced
to DML-only privileges while the migration role retains controlled DDL access.

## Credential rotation

Credentials previously stored in source files must be treated as exposed.
Rotate the Neon password, JWT secret, Cloudflare R2 access key, Supabase service
key, and staging account passwords in their provider consoles, then update the
deployment environment. Rotation is an external operational action and is not
completed by this repository change.
