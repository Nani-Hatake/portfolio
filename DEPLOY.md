# Deploying to Render (free tier)

This app is an ASP.NET Core API (Dapper + **PostgreSQL**) that also serves the
static frontend. It deploys as a Docker web service plus a managed Postgres DB.
Everything is pre-configured in [`render.yaml`](render.yaml) and
[`Portfolio.Api/Dockerfile`](Portfolio.Api/Dockerfile).

> Secrets are **not** in the repo. They are provided at runtime via environment
> variables (see below). Local secrets live in `Portfolio.Api/appsettings.Development.json`,
> which is git-ignored.

---

## 1. Push the code to GitHub

From this folder (`myportfolio`):

```bash
# create an EMPTY repo on github.com first (e.g. "portfolio"), then:
git remote add origin https://github.com/Nani-Hatake/portfolio.git
git push -u origin main
```

If GitHub asks for a password, use a **Personal Access Token** (Settings →
Developer settings → Tokens), not your account password.

## 2. Free permanent database with Neon

Render's own free database expires, so we use **Neon** (free tier, data stored
permanently — the compute just sleeps when idle).

1. Sign up at <https://neon.tech> (sign in with GitHub).
2. **Create a project** (name it e.g. `portfolio`, keep the default region).
   Neon auto-creates a database.
3. On the project **Dashboard → Connect**, copy the **connection string**. It
   looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this handy for the next step. (Treat it like a password.)

## 3. Create the web service on Render

1. Sign in at <https://render.com> (you can sign in with GitHub).
2. Click **New +  →  Blueprint**.
3. Select your `portfolio` repo. Render detects `render.yaml` and shows the web
   service (`portfolio`).
4. It will prompt for the secret values:
   - **DATABASE_URL** → paste the **Neon connection string** from step 2.
   - **Admin__Username** → your owner login (e.g. `LelouchLampourage`)
   - **Admin__Password** → your owner password (e.g. `LelouchLampourage@389`)
   `Jwt__Key` is generated automatically.
5. Click **Apply**. Render builds the Docker image, connects to Neon, applies the
   schema, seeds your data, and starts the app.

First build takes a few minutes. When it's live you'll get a URL like
`https://portfolio-xxxx.onrender.com`.

## 4. Verify

- Visit the URL — the portfolio loads.
- Click the lock icon → sign in with your `Admin__Username` / `Admin__Password`.
- Add/edit a project or section → it persists in the Render Postgres DB.

---

## Notes & gotchas

- **Free web service sleeps.** After ~15 min idle the web service spins down; the
  next visit takes ~50s to wake. Upgrade the service to a paid instance to keep it warm.
- **Database is permanent (Neon).** Neon's free tier does not delete your data; the
  DB compute just auto-suspends when idle and wakes on the next query. No expiry,
  nothing to redeploy.
- **Changing the password later:** update the `Admin__Password` env var in the
  Render dashboard and redeploy — startup re-syncs the admin from config.
- **Resume file:** put `Bharath_Manepalli_Resume.pdf` in `Portfolio.Api/wwwroot/`,
  commit, and push — the Download Resume button will then work.
- **Custom domain:** Render → your service → Settings → Custom Domains.

## Environment variables reference

| Variable            | Set by        | Purpose                                  |
|---------------------|---------------|------------------------------------------|
| `DATABASE_URL`      | you (Neon)    | Neon Postgres connection string          |
| `Jwt__Key`          | render.yaml   | JWT signing secret (auto-generated)      |
| `Admin__Username`   | you           | Owner login username                     |
| `Admin__Password`   | you           | Owner login password                     |
| `ASPNETCORE_ENVIRONMENT` | render.yaml | `Production`                           |
| `PORT`              | Render        | Port the app binds to (handled in code)  |

---

## Running locally (optional)

Local dev uses `appsettings.Development.json` (git-ignored) + a local Postgres.

```bash
docker compose up -d          # starts Postgres on localhost:5432
cd Portfolio.Api
dotnet run                    # http://localhost:5080
```

No Docker? Install PostgreSQL, create a `portfoliodb` database with user/password
`portfolio`/`portfolio`, or edit the connection string in
`appsettings.Development.json`.
