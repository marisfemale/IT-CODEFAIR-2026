# ConnectNT Investment Lens — Design System

## Product context

ConnectNT Investment Lens is a Northern Territory decision-support layer built on top of official connectivity data. It does not replace the Australian Government First Nations Connectivity Mapping Tool. It helps public, private, and community-sector investors screen communities for further investigation, understand why a place appears in a tier, and distinguish strong evidence from missing or uncertain evidence.

Primary audience: infrastructure investment analysts, NT Government planners, telecommunications program teams, funding bodies, and community-sector decision makers.

Primary job to be done: "Given a region and a community profile, show me the strongest candidates for due diligence, explain every factor, and make uncertainty impossible to overlook."

The product language must say "investment screening priority" or "candidate for due diligence," never "must invest." Mapped coverage is not measured reliability. NBN fixed-line/fixed-wireless fields are labelled "mapped terrestrial NBN" because satellite is not represented in the current repository data.

## Main dashboard architecture

Design one desktop-first, map-first responsive workspace. The priority map is the working surface, not a decorative panel:

1. Compact top header: product name, subtitle "Decision-support layer for NT remote connectivity," data vintage/status, methodology link, official-map link, and export-shortlist button.
2. NT priority map occupying roughly 70% of the visible workspace below the header. It uses locally available community points and restrained region boundaries; never render an interpolated heatmap that implies knowledge between communities.
3. Compact collapsible left filter drawer: place search, NT Government region, community type, population band/unknown, priority tier, mapped mobile status, mapped terrestrial NBN status, evidence confidence, funded-project status, and reset filters.
4. Floating map toolbar: layer mode (community points or region summary), priority layer, confidence, funded projects, basemap, zoom/reset/locate, visible result count, and map/table view toggle.
5. Small floating KPI chips for communities screened, mapped coverage gaps, population-data gaps, and current filtered selection. Do not use a full-width KPI strip.
6. Collapsible right shortlist drawer: top 10 communities within current filters, showing rank, community, region, community type, screening tier, evidence confidence, and strongest drivers. Keep the map visible while the drawer is open.
7. Selected-community map popover or bottom sheet: transparent factor breakdown, source dates, population status, mapped coverage, infrastructure proximity, caveats, and an "Open official mapping tool" link.
8. Compact expandable map legend containing High/Medium/Low/Unknown symbols and the need-versus-confidence action matrix: shortlist for due diligence, validate first, monitor, and data gap.

## Information model

Never collapse everything into one unexplained score. Present three separate concepts:

- Connectivity need: mapped mobile gap, mapped terrestrial NBN gap, and robust/capped infrastructure-distance indicators.
- Potential impact: population when available; "Unknown" is a first-class state and never treated as zero.
- Evidence confidence: completeness, source vintage, and consistency. Confidence never boosts or suppresses need; it changes the recommended next step.

Tier labels:

- High — red diamond plus text "High screening priority"
- Medium — amber square plus text "Medium screening priority"
- Low — green circle plus text "Lower screening priority"
- Unknown / validate — slate outlined triangle plus text "Evidence incomplete"

The top 10 list must always reflect active filters and disclose the sort mode. Default sort: connectivity need, then potential impact when known. Every row has a "Why?" affordance revealing factor contributions and limitations.

## Visual direction

Style source: adapt the Superdesign "Mosaic Grid Architecture" technical-minimalist system for a trustworthy civic/infrastructure analytics product. Do not imitate Australian Government branding or use its crest/logo.

- Canvas: Paper `#F7F7F5`
- Primary ink/navy: `#0B2239`
- Secondary forest: `#1A4934`
- Hairline/grid: `#344054` at 18–25% opacity
- High priority: `#B42318`, pale background `#FEE4E2`
- Medium priority: `#B54708`, pale background `#FEF0C7`
- Low priority: `#217A4A`, pale background `#DFF3E7`
- Unknown/confidence warning: `#667085`, pale background `#EAECF0`
- Selection/accent: `#1570A6`
- White data surfaces: `#FFFFFF`

No gradients, glassmorphism, decorative illustrations, large shadows, or rounded consumer-app cards. Use flat surfaces, 1px dividers, 2–4px corner radii, clear alignment, and generous but efficient whitespace. Small elevation is allowed only for a selected detail drawer.

Typography:

- Headings: Space Grotesk or a metrically similar accessible sans-serif, tight but not oversized in dashboard contexts.
- Body: General Sans or Inter.
- Technical labels, data vintages, score annotations: JetBrains Mono.
- Minimum body size 14px; table text 13px minimum; no all-caps paragraphs.

## Component rules

- Filter controls: visible labels above fields, high-contrast focus rings, selected filter chips beneath the rail heading.
- KPI blocks: flat cells separated by hairlines; each includes label, value, denominator/context, and data-quality note where relevant.
- Map: NT-only outline, uncluttered neutral base, accessible point symbols, clustering only at zoomed-out scale, selected community shown with a double ring.
- Priority matrix: 2x2 chart with labelled quadrants and count badges; do not rely on tooltip-only interpretation.
- Top 10: numbered vertical list with compact driver chips such as "No mapped mobile," "142 km to mobile site," or "Population unknown."
- Score breakdown: horizontal contribution bars with raw values and source/vintage visible alongside; never show a score without its factors.
- Confidence: separate badge and explanation, not another priority color.
- Empty/unknown states: explicitly state which source is absent and what verification is recommended.
- Export: offer filtered CSV/GeoJSON and a concise evidence brief. Exact infrastructure identifiers and precise coordinates are excluded from public evidence briefs by default.

## Accessibility and ethics

- Meet WCAG AA contrast.
- Priority is encoded through color, shape, label, and ordering.
- Keyboard access for all filters, shortlist items, map alternatives, and drawers.
- Provide an accessible table containing the same information as the map.
- Use "community" names respectfully and preserve official spellings.
- Include a persistent disclaimer: "Screening result only — confirm coverage, feasibility, community priorities, costs, power, backhaul, and consent before investment decisions."
- Exact coordinates are not the default public display/export.

## Motion

Motion is restrained and functional: 120–180ms ease-out for filter updates, panel expansion, and selection. Respect reduced-motion preferences. No map fly-through on initial load and no animated KPI counting.

## Responsive behavior

Desktop is the primary investor workflow. On tablet, filters become a slide-over and shortlist sits below the analysis. On mobile, lead with search, filter summary, top candidates, and community evidence cards; the map becomes optional and never blocks access to the ranked table.
