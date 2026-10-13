# Hosting Navigator live

GitHub Pages serves static files only, so the app is split in two:

| Part | Where | Why |
|---|---|---|
| Frontend (Next.js) | **GitHub Pages**, built by `.github/workflows/pages.yml` | Static export, free, on the sponsor's platform |
| Backend (FastAPI + Foundry agent) | **Azure Container Apps** (or any Docker host) from the root `Dockerfile` | Needs a server, and the Foundry key must stay server-side |

Site URL once live: `https://zero2sudo-hokies.github.io/mastercard-x-microsoft/`

Until a backend URL is set, Pages builds in **mock mode** (static sample data for New York, no live AI), so the link works from day one.

## 1. Repo visibility (decision)
Pages on a private repo in a free organization is not available. Either make the repo **public** (Settings, General, Danger zone) or upgrade the org to GitHub Team. History has been checked: no keys were ever committed (`backend/.env` is gitignored).

## 2. Turn on Pages
1. Settings, Pages, Source: **GitHub Actions**.
2. Settings, Secrets and variables, Actions, **Variables** tab: add `NAVIGATOR_PAGES` = `on`.
3. Actions, "Deploy frontend to GitHub Pages", **Run workflow**. The site appears at the URL above in about 2 minutes (mock mode).

## 3. Host the backend on Azure Container Apps
Needs the Azure CLI and a subscription (Azure for Students works). From the repo root:

```bash
az login
az group create --name navigator-rg --location eastus
az containerapp up --name navigator-api --resource-group navigator-rg --location eastus --source . --ingress external --target-port 8000
az containerapp secret set --name navigator-api --resource-group navigator-rg --secrets openai-key=<FOUNDRY_API_KEY>
az containerapp update --name navigator-api --resource-group navigator-rg --set-env-vars AZURE_OPENAI_ENDPOINT=<FOUNDRY_ENDPOINT> AZURE_OPENAI_API_KEY=secretref:openai-key AZURE_OPENAI_DEPLOYMENT=gpt-5-mini ALLOWED_ORIGINS=https://zero2sudo-hokies.github.io AI_REQUESTS_PER_HOUR=30
```

`az containerapp up` prints the app URL (`https://navigator-api.<region>.azurecontainerapps.io`). Check it: open `<url>/api/health`, which should show `"ai_configured": true`.

Alternative with no Azure account: Render.com, New Web Service, Docker, this repo, same environment variables (free tier sleeps when idle, so the first request is slow).

## 4. Point the site at the backend
Add the repo variable `NAVIGATOR_API_BASE` = the backend URL (no trailing slash), then re-run the Pages workflow. The status dot turns green ("API live").

## Environment variables (backend)
| Name | Value |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Foundry "Azure OpenAI endpoint" ending in `/openai/v1` |
| `AZURE_OPENAI_API_KEY` | Foundry key, stored as a secret, never in the repo |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-5-mini` |
| `ALLOWED_ORIGINS` | `https://zero2sudo-hokies.github.io` (comma separated if more) |
| `AI_REQUESTS_PER_HOUR` | Foundry calls per visitor IP per hour on chat and plan (default 30) |

## Safety for a public demo
- The browser never sees the Foundry key. CORS only allows the Pages origin.
- Chat and plan are capped per visitor IP (429 after the limit), so a public link can't run up the Foundry bill. Also set a budget alert on the Azure subscription.
- Rotate the Foundry key before going public: it was shared in a chat during the build.

## Local check of the Pages build
```bash
cd frontend
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/mastercard-x-microsoft NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run build
```
Output lands in `frontend/out/`. (In Git Bash on Windows, prefix with `MSYS_NO_PATHCONV=1` so the base path is not rewritten.)
