# New York pilot opportunity dashboard implementation

Build a county dashboard that helps a Mastercard team shortlist pilot areas by modeled underserved need and potential reach, then inspect complaint evidence and partner readiness. The merged JSON supplies all 62 New York counties and six aggregate persona references. The current complaint layer is July 2026 only and uses unvalidated VADER tone scores; it does not yet support a validated frustration or combined pilot score.

## Deliverables and data contract

Use `ny_county_pilot_data.json` as the initial application data source and `ny_county_pilot_data.csv` for analyst review. The JSON has `metadata`, `counties` and `persona_profiles`. County records use five-character string `fips` identifiers. Rates are decimals 0–1; unavailable values are JSON `null` and blank CSV fields. Modeled counts, unknown source years and mapping limitations are explicit in metadata.

Place the JSON at `frontend/public/data/ny_county_pilot_data.json` for the first local prototype. Fetch it once through a typed loader and index records by FIPS. No model credentials or individual complaint narratives belong in the frontend. This snapshot is a new, versioned frontend input; do not pretend it is the existing v2 `areas.json` or `frustration.json`. In particular, `exclusion_index`, validated topic scores, complaint population rates, ROI and look-alikes are not provided by this dataset.

```ts
type CoverageStatus =
  | 'no_mapped_complaints'
  | 'no_scored_narratives'
  | 'low_data'
  | 'sufficient_counts_unvalidated';

type CountyPilotData = {
  fips: string;
  name: string;
  state_abbr: 'NY';
  households: number;
  underserved_share: number;
  est_underserved_households: number;
  persona_shares: Record<string, number>;
  persona_households: Record<string, number>;
  complaint_count: number;
  narratives_scored: number;
  narrative_coverage: number | null;
  negative_share_of_scored: number | null;
  mean_sentiment_score: number | null;
  baseline_coverage_status: CoverageStatus;
  frustration_score: null;
  priority_score: null;
};
```

This type describes the current snapshot; extend the validated data contract when replacing null severity/priority fields later. Do not create a frontend severity score from a VADER compound score.

## Stack and ownership

Follow the v2 starter: Next.js App Router, TypeScript, Tailwind, SVG county shapes from `us-atlas`, and `d3-geo` plus `topojson-client`. P4 owns the map, dashboard and shared data loader; P5 owns chat UI and plan page; P3 owns the backend AI explanation/plan endpoints. The paths below are proposed additions or updates for the relevant owners, not files already implemented by this task.

Keep the initial snapshot loader independent of API calls. Later, P1 can expose an agreed county-pilot endpoint or explicit adapter while retaining the existing API contracts. P3 should consume those same typed facts and data limitations. Coordinate new shared types and snapshot/API integration before changing the team contracts.

## Screen layout

On desktop, use roughly two-thirds of the width for the map and one-third for the county detail/shortlist panel. Above it, show New York, layer controls and complaint-period context. On narrow screens, place the map above the panel. Use the starter's off-white, navy and orange palette without implying official Mastercard branding.

The default title is `New York pilot opportunities`. Show a compact note: `Modeled household estimates. Complaint tone: July 2026 baseline.` Provide expandable source and coverage details rather than crowding the main flow with implementation details.

## Map layers

### Underserved concentration

Default color metric: `underserved_share`, displayed as a percentage. Use a sequential navy scale with five labeled bins derived from the New York county distribution; show the actual percentage boundaries in the legend. All 62 counties receive a fill because this metric is present. Label estimates as modeled. Do not call the percentage an exclusion index.

### Potential household reach

Second layer: `est_underserved_households`. Use a sequential scale and a legend stating `Estimated underserved households`; use quantiles or a log-aware scale so NYC values do not flatten differences across the rest of the state. A tooltip always displays the raw modeled count. This is potential audience size, not forecast card adoption or Mastercard revenue.

### Complaint tone baseline

Optional third layer: `negative_share_of_scored`. Color only counties whose `baseline_coverage_status` is `sufficient_counts_unvalidated`; label the view `Complaint tone baseline`, not validated frustration. Use an orange/red scale with percentage labels. Every other county gets a gray hatch with a specific explanation: no mapped complaints, no narrative text, or insufficient counts.

The provisional screen requires at least 30 mapped complaints and ten scored narratives; it is a count filter, not proof of statistical precision. Five counties meet it in this snapshot. Every colored county still needs a `Baseline, not validated` badge. Keep the raw score and counts available in the detail panel.

Use a NY-only map and an NYC inset or zoom control so the small NYC county shapes remain selectable. A county should keep the same FIPS identity in both views. Keyboard access and a synchronized county list must provide an alternative to clicking small SVG paths.

## County detail panel

On selection, display:

1. County name, modeled underserved share, estimated underserved households and total households.
2. The six county persona shares/counts, not only the lead label. All 62 New York counties have the same lead persona in these inputs, so that label alone adds little differentiation.
3. Complaint evidence: mapped complaints, scored narratives, narrative coverage, negative/neutral/positive counts, negative share and mean VADER score. Explain that missing means unavailable and that baseline tone does not establish financial harm or consumer satisfaction.
4. Aggregate persona reference information from `persona_profiles`, labeled `Aggregate profile, not county-specific`. Underbanked barrier values are null in the JSON because unbanked-only zero fields cannot support a claim of no concerns. Persona descriptions must not claim complainants belong to a given persona.
5. A `Shortlist county` action and analyst notes for issuer/community-partner readiness. These are manual planning inputs, not inferred data. Do not manufacture partners, card offers, conversion rates, ROI or readiness scores.

Keep `Build pilot plan` disabled or clearly marked unavailable until validated complaint topics/severity and the P1 ROI/profile APIs exist. A later P3-generated plan must cite the facts and preserve modeled/unknown labels, with human review before approval.

## Shortlist and ranking

Start with two transparent sort choices: `Highest underserved share` and `Most estimated households`. Selecting a row selects and zooms/highlights its county. Include both metrics in every shortlist row so concentration and potential reach are visible together. Optional filters: minimum estimated household count, county search, and baseline narrative coverage.

Do not rank counties by a combined priority score now; `priority_score` and `frustration_score` are intentionally null. After the full historical complaint window, population inputs, topic/severity classifier and persona provenance are validated, the team can implement an explicit priority measure. If returning to the starter's 50/50 exclusion-frustration score, compute actual agreed indexes in the backend; do not substitute raw percentages, sentiment polarity or household counts for those indexes silently.

## Components and state

```text
frontend/
  app/page.tsx
  public/data/ny_county_pilot_data.json
  lib/pilot-types.ts
  lib/pilot-data.ts
  lib/pilot-format.ts
  components/map/NyCountyMap.tsx
  components/map/MapLegend.tsx
  components/map/NycInset.tsx
  components/area/CountyPilotPanel.tsx
  components/area/PersonaMix.tsx
  components/area/ComplaintEvidence.tsx
  components/area/CoverageBadge.tsx
  components/pilot/PilotShortlist.tsx
```

Keep selected county, map layer, search and sorting in one dashboard state. Persist navigation state in the URL, for example `/?state=36&fips=36005&layer=underserved&sort=share`. Parse only allowed layer/sort values and known FIPS. Format decimal shares as percentages without modifying stored values.

Derive color scales once per dataset/layer, not once per county render. Memoize county shapes and FIPS lookups. Use a stable `onSelect(fips)` callback shared by the map and list. Loading, malformed data, missing county shape and empty filter results need friendly states; null metrics must never render as 0% or be colored as low frustration.

## Implementation sequence

1. Add and validate the typed snapshot loader. Confirm 62 unique NY county records, six persona references and null handling.
2. Build the opportunity map, legend, NYC inset, hover/focus tooltip and selected-county panel. Enable concentration and household-reach layers.
3. Add the county shortlist, search/sort controls and persona mix. Preserve manual shortlist selection across layer changes.
4. Add baseline complaint tone with data hatching, count thresholds and source-period badges. Use the actual coverage statuses instead of assuming every county has sentiment.
5. Replace or expand the snapshot with full-window, validated data and an agreed API adapter. Then connect P3 explanations and P5 pilot review through existing contracts.

## Acceptance checks

- Exactly 62 county records can be selected by map and list; all FIPS stay strings with leading zeros.
- Bronx leads the concentration sort and Kings leads the household-reach sort for this snapshot.
- County complaint counts total 730 and scored narratives total 148; 38 exact-ZIP complaints remain excluded for uncertain mapping, in addition to 97 raw complaints with missing/masked/other ZIPs.
- Opportunity views show all counties; baseline tone colors only the five sufficient-count counties and hatches the others.
- No mapped complaints is distinct from no narrative, low sample and zero measured negative share.
- The UI never calls VADER polarity a 1–5 severity score, a representative underserved sentiment rate or a validated pilot recommendation.
- Partner availability, adoption, ROI, severity and priority are not fabricated from this snapshot.
- Source years that are unknown remain unknown. Mapping limitations and July-only complaint coverage are available to reviewers.
- The app has accessible keyboard/list selection, visible legends and usable mobile layout; run the project's build and the relevant data-loader/map checks before handoff.
