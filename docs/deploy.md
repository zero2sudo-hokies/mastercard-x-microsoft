# Azure hosting and automatic deployments

All app resources are in `navigator-rg` in the Azure for Students subscription.

| Component | Resource | Plan |
|---|---|---|
| Frontend | `navigator-web` (Azure Static Web Apps) | Free |
| Backend | `navigator-api-f801edf9` on `navigator-free-plan` (Linux App Service, Central US) | F1 Free, Python 3.12 |
| AI | `foundry-demo-ms`, including `proj-default` | Existing model billing; deployment `gpt-5-mini` |
| GitHub deployment identity | `navigator-github-deploy` | Managed identity, no client secret |

- Website: https://ashy-desert-0ad29150f.3.azurestaticapps.net
- API health: https://navigator-api-f801edf9.azurewebsites.net/api/health
- Workflow: `.github/workflows/azure.yml`

The existing Foundry account was moved from `rg-im-demo`; its endpoint is unchanged. The backend stores its Foundry key in server-side App Service settings. HTTPS is required, and CORS allows the Azure frontend origin. GitHub Pages is disabled and its workflow has been removed.

## Deploy a change

1. Push a branch and open a pull request targeting `main`.
2. Wait for **Check frontend** (lint, TypeScript and production build) and **Check backend** (pytest and deployment packaging).
3. Merge the pull request into `main`. A direct push to `main` also triggers deployment.
4. Open GitHub **Actions → Check and deploy to Azure**. After both checks pass, **Deploy live site** deploys the backend, checks its health, deploys the frontend, then checks the website.
5. Wait for the workflow to finish before refreshing the live site.

Pull requests never deploy and cannot authenticate to Azure. The frontend is built with mock mode off, an empty base path, and the live API URL. The backend package contains `app/`, `requirements.txt`, and `data/p3/roi-inputs.json`; local environment files are excluded. Deployments run in sequence so an older in-flight run cannot overwrite a newer deployment.

To redeploy `main` without another commit, choose **Run workflow → main**. To undo a change, revert its commit on `main`; the revert runs through the same checks and deployment. There is no automatic rollback: if a deployment fails after updating the backend, investigate the failed step before rerunning.

## GitHub and Azure authentication

These repository **Actions variables** are configured:

| Variable | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Client ID of `navigator-github-deploy` |
| `AZURE_TENANT_ID` | Azure tenant |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription |
| `NAVIGATOR_API_BASE` | `https://navigator-api-f801edf9.azurewebsites.net` |

The repository **Actions secret** `AZURE_STATIC_WEB_APPS_API_TOKEN` holds the frontend deployment token. It is encrypted in GitHub and is only used by the deployment job. If it is rotated in Azure, update this GitHub secret too.

The backend uses [GitHub OIDC](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions), without an Azure password or publish profile. The managed identity has **Website Contributor** on the backend app only. Its federated credential trusts issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:zero2sudo-hokies/mastercard-x-microsoft:ref:refs/heads/main`. Moving the repo or renaming `main` requires updating that trust. Adding a GitHub deployment environment also changes the OIDC subject and requires updating the credential.

## Backend configuration

Keep these settings in Azure App Service; the workflow preserves them:

| Setting | Value |
|---|---|
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` (Azure installs Python dependencies during ZIP deployment) |
| `API_BASE` | `http://127.0.0.1:8000` (AI tools call the same API) |
| `ROI_INPUTS_PATH` | `data/p3/roi-inputs.json` |
| `AZURE_OPENAI_ENDPOINT` | `https://foundry-demo-ms.openai.azure.com/openai/v1` |
| `AZURE_OPENAI_API_KEY` | Foundry key; never commit or copy into GitHub |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-5-mini` |
| `ALLOWED_ORIGINS` | `https://ashy-desert-0ad29150f.3.azurestaticapps.net` |
| `AI_REQUESTS_PER_HOUR` | `30` |

Startup command: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.

The deployment health check verifies `status: "ok"` and `ai_configured: true`. It does not make a billable AI call or prove model connectivity. To check Foundry end to end, send a chat question and generate a pilot plan; both should return `mode: "foundry"`, rather than `"rules"`.

## Costs and limits

Both hosting plans are Free. Foundry calls retain their existing model charges, and GitHub Actions uses the repository's applicable usage allowance. [F1 has shared compute and a daily CPU quota](https://learn.microsoft.com/en-us/azure/azure-subscription-service-limits#app-service-limits), sleeps when idle, and does not support Always On. Pilot drafts and per-IP rate limits are in memory and reset when the backend restarts, sleeps, or redeploys. This setup suits the demo rather than production traffic.
