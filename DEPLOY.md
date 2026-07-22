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

## 2. Create the services on Render

1. Sign in at <https://render.com> (you can sign in with GitHub).
2. Click **New +  →  Blueprint**.
3. Select your `portfolio` repo. Render detects `render.yaml` and shows a web
   service (`portfolio`) + a database (`portfolio-db`).
4. It will prompt for the two secret values:
   - **Admin__Username** → your owner login (e.g. `LelouchLampourage`)
   - **Admin__Password** → your owner password (e.g. `LelouchLampourage@389`)
   `Jwt__Key` is generated automatically; `DATABASE_URL` is wired from the DB.
5. Click **Apply**. Render builds the Docker image, provisions Postgres, applies
   the schema, seeds your data, and starts the app.

First build takes a few minutes. When it's live you'll get a URL like
`https://portfolio-xxxx.onrender.com`.

## 3. Verify

- Visit the URL — the portfolio loads.
- Click the lock icon → sign in with your `Admin__Username` / `Admin__Password`.
- Add/edit a project or section → it persists in the Render Postgres DB.

---

## Notes & gotchas

- **Free tier sleeps.** After ~15 min idle the web service spins down; the next
  visit takes ~50s to wake. Upgrade the service to a paid instance to keep it warm.
- **Free Postgres expires** after 90 days on Render's free plan (they email you).
  Back up or upgrade before then.
- **Changing the password later:** update the `Admin__Password` env var in the
  Render dashboard and redeploy — startup re-syncs the admin from config.
- **Resume file:** put `Bharath_Manepalli_Resume.pdf` in `Portfolio.Api/wwwroot/`,
  commit, and push — the Download Resume button will then work.
- **Custom domain:** Render → your service → Settings → Custom Domains.

## Environment variables reference

| Variable            | Set by        | Purpose                                  |
|---------------------|---------------|------------------------------------------|
| `DATABASE_URL`      | render.yaml   | Postgres connection (auto from DB)       |
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
