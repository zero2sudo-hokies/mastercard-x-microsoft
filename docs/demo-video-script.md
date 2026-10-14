# Monopoly: recruiter demo video script

**Length:** about 5 minutes, 10 scenes. **Voiceover:** about 750 words at a calm pace.
**Format per scene:** what to **show** (exact clicks), what to **say**, an optional **caption** to overlay, and **why we built it** (say it if time allows, or use it to answer questions).

---

## Before you record

- **Use the live site:** https://ashy-desert-0ad29150f.3.azurestaticapps.net . The dot in the top right should be green and say **API live**. Check the backend first at https://navigator-api-f801edf9.azurewebsites.net/api/health (it should say `"ai_configured": true`).
- 1920×1080, browser zoom 100-110%, light mode, one tab, bookmarks bar hidden.
- Record each scene as its own silent clip, then add the voiceover. Speed up or cut the two waits: the agent (about 8 s) and the plan (about 30 s).
- Run the agent question and generate one plan once before recording, so Foundry is warm.
- Jump straight to each scene:

| Scene | URL (add to the site address) |
|---|---|
| 2 Underserved, national | `/` |
| 3 Frustration, New York | `/?layer=frustration&state=36` |
| 4 County pop-out | `/?layer=frustration&state=36&fips=36005` (Bronx) or `&fips=36071` (Orange County) |
| 5 Agent | `/?layer=frustration&state=36` then the **Ask the agent** tab |
| 6 Bank page | `/banks?fips=36005` |
| 7-8 Plan | `/plan?fips=36005` (general) or `/plan?fips=36005&bank=31189` (pitch for Ponce Bank) |
| 9 Engineering | GitHub repo: Actions tab and the README diagram |

---

## Scene 1 · Hook (0:00-0:15)

**Show:** the national Underserved map, still. Slow zoom if your editor can.

**Say:**
"Twenty-four point six million US households are unbanked or underbanked. For Mastercard, that's growth and inclusion. But picking where to launch, what to offer and which bank to partner with is slow, manual, and risky if targeting goes wrong. We built Monopoly to answer all of that in minutes."

**Caption:** `24.6M unbanked + underbanked US households · FDIC 2023`

---

## Scene 2 · Where people are left out (0:15-0:50)

**Show:** Underserved layer, national. Hover two or three states to show the tooltip. Click **New York**: the map zooms into its counties. Hover the Bronx.

**Say:**
"We built this at LEAD ASPIRE for Mastercard, and we started with the base layer: who is left out of banking. We score all 50 states, DC and all 3,144 counties. The inputs are the FDIC's 2023 household survey for unbanked and underbanked rates, Census ACS five-year data for poverty, homes without internet and income, and FDIC branch locations for how many bank branches each county has. We standardize each measure, average the z-scores and turn that into a 0-to-100 percentile. The Bronx comes out at 92, rank 254 of 3,144, with about 217,000 underserved households. That count is modeled, and the app labels it that way."

**Caption:** `Census ACS 2020-24 · FDIC 2023 survey · FDIC BankFind · z-score → percentile`

**Why we built it:** Mastercard's first question was where. A single, explainable index beats ten separate charts, and we can recompute it from raw files: an independent audit matched all 3,144 counties.

---

## Scene 3 · What frustrates people (0:50-1:25)

**Show:** toggle **Frustration**. Point at the hatched counties, then the colored ones. Change the topic dropdown to **Account closures**, then back to **All frustrations**.

**Say:**
"Knowing where isn't enough. We also need to know what to offer. So we pulled about 20,800 consumer complaints for New York from the CFPB's public API, covering two years and three products: checking and savings, prepaid cards and money transfers. Each complaint is placed in a county by ZIP code, using the Census ZIP-to-county file, and keeping only ZIPs that fall in exactly one county. Each one is sorted into one of six topics using the CFPB's own issue categories. Topic shares are shrunk toward the national mix, so small counties don't swing wildly. Hatched areas have fewer than 30 complaints, so we don't score them. We'd rather show 'not enough data' than guess."

**Caption:** `CFPB complaints API · 20,811 NY complaints · Census ZCTA crosswalk · 6 topics · ≥30 to score`

**Why we built it:** the complaint topic tells us which benefit to pilot. In the Bronx, account closures leads, so the matched offer is a second-chance account.

---

## Scene 4 · County pop-out and bank branches (1:25-2:00)

**Show:** in the Frustration view, click the **Bronx** (or open the URL). The map zooms in, then the county lifts in 3D with the rest blurred, and the branch pins fade in. Scroll a little to the **Top banks** strip. Click **JPMorgan Chase**: only its blue pins stay lit. Click it again to show all.

**Say:**
"Click a county and it pops out, with every FDIC-insured bank branch pinned. This comes from the FDIC's Summary of Deposits for June 2026, about 75,000 branches with their deposits and coordinates. Under the map are the top three banks by local deposits, which is the best public stand-in for customer counts. In the Bronx, Chase holds about 38 percent of deposits across 33 branches. Click a bank and the map shows only its branches, so you can see its real footprint."

**Caption:** `FDIC Summary of Deposits 2026 · 75,859 branches · deposits = public proxy for customers`

**Why we built it:** Mastercard doesn't hold accounts. Every pilot needs an issuer bank, so the next question is always "who do we call?"

---

## Scene 5 · The AI agent (2:00-2:35)

**Show:** **Ask the agent** tab. Click the chip **"Which areas have the most frustrated customers?"** (or type "Where should we pilot a no-fee account?"). When it answers, show the cited numbers, the recommendation cards, the map highlights, and open **How I got this**.

**Say:**
"The agent runs on Azure AI Foundry with gpt-5-mini and tool calling. It doesn't answer from memory. It calls Monopoly's own API: recommendations, area profiles, bank and ROI tools. Then it cites the numbers and highlights the areas on the map. 'How I got this' shows every tool call. Every number in the answer is checked against the tool results. And if you ask it to target people by a protected characteristic, it declines and offers the economic-access view instead."

**Caption:** `Azure AI Foundry · gpt-5-mini · tool calling over our API · number check · rules fallback`

**Why we built it:** analysts ask questions in plain language. A grounded agent that shows its work is something a compliance team can trust.

---

## Scene 6 · Compare banks (2:35-2:55)

**Show:** from the strip, click **Expand: compare banks**. Tick **Chase**, **Ponce Bank** and **Apple Bank**. Pan across the table rows: deposit share, branches, underserved households per branch, pricing tier, annual margin, breakeven churn, issuer net.

**Say:**
"Expand opens the bank page. Pick up to five banks and compare them side by side. Each bank's economics use its own debit pricing tier. Banks under ten billion in assets are exempt from the Fed's interchange cap, so they earn more per swipe. That's why Chase has the reach, while Ponce Bank, a local community bank, is the one whose economics can actually break even."

**Caption:** `Regulation II tiers · FDIC call reports Q2 2026 (context only) · ROI per bank`

**Why we built it:** this turns a bank list into a partner strategy, with reach on one side and economics on the other.

---

## Scene 7 · Does it pay? (2:55-3:30)

**Show:** click **Build pilot plan for this bank** under Ponce Bank. On the plan page, the left column: point at the headline **"Pays back only below 9% yearly churn"**. Click the **Breakeven 8.8%** chip and watch the numbers turn positive. Switch the audience to **Unbanked & interested**. Open **Assumptions and sources (13)**.

**Say:**
"Then the business case. A community issuer earns about 38 dollars per account per year. At the default 40 percent churn, that never covers the 428-dollar acquisition cost. The chart shows the line: get churn under about 9 percent, or cut acquisition cost through local partners, and it pays back. You can also narrow the audience to unbanked households that told the FDIC they want an account. Every benchmark here is sourced: the Federal Reserve, FDIC, PULSE, the Mastercard 10-K. Churn and adoption are labeled placeholders, because the pilot is what measures them."

**Caption:** `Every input cited · Fed Reg II · FDIC · PULSE · Mastercard FY2025 10-K · county → state → US → global`

**Why we built it:** issuers say yes to a business case, not a map. And showing where it doesn't pay is what makes the rest credible.

---

## Scene 8 · The pilot plan (3:30-4:10)

**Show:** right column: **Generate pitch for Ponce Bank** (speed up the wait). Scroll the 10 sections. Open **Facts the AI was allowed to use**. Click **Make PDF** and show the print preview. Back on the page, tick the three **safe-outreach checklist** boxes, type a reviewer name, click **Approve pilot plan**. Hold on the green **Approved by** banner.

**Say:**
"Last, Foundry drafts the pilot plan as a pitch to this bank. It's ten sections: why this area, the offer, outreach through community partners, the economics, and a test against look-alike counties with a six-month read. The model can only use the facts listed here, and guardrails flag any number it can't trace, any protected-attribute term, or anything that calls network volume revenue. Make PDF turns it into a document to send. And nothing is final until a named reviewer completes the safe-outreach checklist and approves it."

**Caption:** `Facts-only prompt · guardrails: numbers, protected terms, revenue wording · human approval · PDF`

**Why we built it:** this is the deliverable a Mastercard team would actually take into a meeting, with a human in the loop by design.

---

## Scene 9 · How it's built (4:10-4:40)

**Show:** the GitHub repo. The README diagram (data pipelines → FastAPI → Foundry → Next.js). Then the **Actions** tab and one green **Check and deploy to Azure** run, with its three jobs.

**Say:**
"Under the hood: Python data pipelines build the area, complaint and bank datasets. FastAPI serves them and runs the agent, and Next.js renders the map as SVG with d3. It's deployed on Azure, with Static Web Apps for the frontend and App Service for the API. Every pull request runs lint, type checks and 31 backend tests, and merging to main deploys with keyless OIDC sign-in. The Foundry key never reaches the browser, AI calls are rate-limited, and no race, ethnicity, citizenship or language data is used anywhere."

**Caption:** `Python · FastAPI · Next.js 16 · d3-geo · Azure AI Foundry · Azure Static Web Apps + App Service · GitHub Actions (OIDC)`

---

## Scene 10 · Close (4:40-4:55)

**Show:** back to the Bronx pop-out with its pins, or the approved plan. Hold.

**Say:**
"Monopoly answers four questions in one flow: where people are left out, what to offer them, whether it pays, and who to partner with. Then it hands a human a plan to approve. Prove it in one county, then scale to the country."

**Caption:** `Monopoly · LEAD ASPIRE 2026 · Built for Mastercard`

---

## Numbers on screen (say them exactly)

| Item | Value |
|---|---|
| US unbanked + underbanked households | 24.6M (FDIC 2023) |
| Counties scored | 3,144, plus 50 states and DC |
| Bronx exclusion index | 92, rank 254 of 3,144 |
| Bronx est. underserved households | 217,454 (modeled) |
| NY complaints | 20,811 (Aug 2024 to Jul 2026); 21 counties have 30+ and are scored |
| Bronx complaints | 2,122; frustration score 90; top topic account closures (1.17× the next topic, a clear lead) → second-chance account |
| Top recommendation | Bronx County, priority 91 |
| Bank branches (FDIC SOD 2026) | 75,859 nationally; Bronx 125 |
| Bronx top banks | Chase 37.8% (33 branches), Citibank 14.6% (15), Ponce Bank 8.7% (5, exempt tier, community bank) |
| Orange County, NY | Chase 22.6%, 13 of 83 branches |
| Community issuer, per account | $38 margin/yr, $95 lifetime value at 40% churn, $428 to acquire, breakeven churn 8.8% |
| Large bank, per account | loses $294/yr; never breaks even |
| Bronx pilot (3% adoption) | 6,524 accounts, $112.7M year-1 network volume (spend on the network, not Mastercard revenue) |
| If it scales (US, 3%) | 738,000 accounts, $12.7B network volume |
| Agent / plan timing | about 8 s / about 30 s |

## Words to use carefully

- Say **"modeled"** for county household counts and ROI outputs, and **"placeholder"** for adoption, churn and fixed cost.
- **Network volume is spend on Mastercard's network, not Mastercard revenue.**
- The complaint layer covers **New York** so far and measures **complaint volume, not severity**. Complaint text wasn't available to classify.
- Bank rankings use **deposits as a proxy for customers**. Credit unions aren't in FDIC data, and a bank's card network isn't public.

## If something breaks while recording

- **Agent slow or down:** it falls back to a rules-based answer automatically. Say "this is our fallback path".
- **Plan slow:** keep talking over the spinner. If Foundry fails, the template plan appears with the same 10 sections.
- **Map blank:** refresh. If the dot is red, check `/api/health`, since the free App Service tier can take a few seconds to wake up.
