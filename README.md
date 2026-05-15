# backend

Backend application for the Smart House Rental Platform built with Node and Express.

## Build behavior

The build process compiles TypeScript and copies runtime assets into `dist`, including:

- `src/views` -> `dist/views`
- `src/public` -> `dist/public`
- `src/emails` -> `dist/emails`

This prevents template-missing errors in production deployments.

## Email provider (Resend)

The backend uses Resend API for transactional emails in all environments.

Set these environment variables:

- `RESEND_API_KEY`: API key from Resend dashboard
- `EMAIL_FROM`: sender address (must be a verified sender/domain in Resend for production)
- `SUPPORT_EMAIL` (optional): support contact displayed in email templates

For quick testing, `onboarding@resend.dev` can be used as sender with Resend test mode.

## Run with Docker

1. Copy env file:

```bash
cp .env.example .env
```

2. (Optional but recommended) set strong values in `.env` for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

3. Build and start all services:

```bash
docker compose up --build -d
```

4. Check running containers:

```bash
docker compose ps
```

5. Open the API:

- App: http://localhost:5000
- Health: http://localhost:5000/health
- Swagger: http://localhost:5000/api-docs

6. Stop services:

```bash
docker compose down
```

## Prisma migrations on existing databases

If your deployment targets an already-populated database, `npx prisma migrate deploy` can fail with `P3005` because Prisma expects migration history to be baselined first.

In that case, create or mark a baseline migration as applied before running deploy, for example:

```bash
npx prisma migrate resolve --applied <baseline_migration_name>
npx prisma migrate deploy
```

Use this only when the database schema already matches the baseline migration history.
