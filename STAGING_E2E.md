# Supabase staging E2E

## Required environment

Backend:

```text
DATABASE_URL=jdbc:postgresql://<staging-host>:5432/postgres?sslmode=require
DATABASE_USERNAME=<staging-user>
DATABASE_PASSWORD=<staging-password>
JWT_SECRET=<at-least-32-characters>
FRONTEND_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
E2E_SEED_ENABLED=true
E2E_STUDENT_USERNAME=<staging-student-username-or-email>
E2E_STUDENT_PASSWORD=<at-least-8-characters>
E2E_TEACHER_USERNAME=<staging-teacher-username-or-email>
E2E_TEACHER_PASSWORD=<at-least-8-characters>
```

Frontend (`.env.local`):

```text
VITE_API_BASE_URL=http://localhost:8080
VITE_DEMO_LESSON_ID=<seeded-published-lesson-id>
```

Do not commit either environment file.

## Seed prerequisites

- One active `STUDENT` account with a BCrypt password.
- One active `TEACHER` account with a BCrypt password.
- One course, chapter and published lesson.
- Student enrolled in a class that has the course and teacher assigned.

When `E2E_SEED_ENABLED=true`, backend startup creates or updates both E2E
accounts with BCrypt passwords. Set the flag back to `false` after the first
successful startup. Curriculum and enrollment data are not created by this
account seeder.

## Smoke flow

1. Start backend and confirm `GET /actuator/health` returns `UP`.
2. Start frontend and log in as the seeded student.
3. Open the configured lesson; verify `learning_progress.opened_at` and 10%.
4. Reach station 9; verify `completed_at` and 100%.
5. Log in as teacher; call/list course data with the JWT.
6. Verify an unauthorized student cannot mutate courses or inspect another student's progress.
7. Restart backend to confirm Flyway is repeatable and Hibernate `validate` succeeds.

## Automated checks before staging

```bash
npm run lint
npm run build
cd math10-backend
mvn test
```
# Admin acceptance

The Admin flow deliberately requires a real staging Admin account. It never
creates or self-signs an elevated token.

```powershell
$env:E2E_ADMIN_USERNAME = "<staging-admin-username>"
$env:E2E_ADMIN_PASSWORD = "<staging-admin-password>"
.\scripts\staging-admin-e2e.ps1
```

The script verifies Admin login, dashboard and user listing, User CRUD/state
changes, Topic CRUD, audit logging, and a negative RBAC check proving that the
Teacher account cannot open the Admin dashboard. Temporary records are
soft-deleted during cleanup.

## One-time Admin bootstrap

When a staging database has no Admin, prepare a cryptographically random local
credential:

```powershell
.\scripts\prepare-staging-admin.ps1
```

Start the backend once with `E2E_ADMIN_SEED_ENABLED=true`. After the account is
created, restart with that flag unset or `false`. The account remains in
Supabase; the bootstrap component no longer runs. Credentials are stored in
`.admin-staging-credentials.txt`, which is excluded from Git.
