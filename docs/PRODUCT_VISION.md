# ConnectNT Investment Lens: product vision

## Mission

Help decision-makers move from “where are the connectivity layers?” to “which
communities should we investigate next, why, and what evidence must be verified
before investment?”

ConnectNT is a decision layer above the Australian Government's First Nations
Connectivity Mapping Tool. It organises public evidence around a repeatable
screening workflow; it is not a replacement map, an engineering design, or an
automated investment decision.

## Questions the product answers

1. **Where is the community need?** Identify mapped mobile, terrestrial NBN and
   public Wi-Fi gaps, population evidence and distance from recorded
   infrastructure.
2. **Where is the greatest benefit potential?** Compare the evidence available
   now and later add youth demographics, schools, clinics, government access,
   local economic activity and community-defined outcomes. “Benefit potential”
   is used instead of “social and economic ROI” until real outcome and financial
   data exist.
3. **What delivery factors should be investigated next?** Use proximity to
   recorded infrastructure, remoteness and cyclone exposure as screening
   signals while keeping engineering feasibility and cost explicitly unassessed.
4. **How could the project be funded and sustained?** Surface project overlap,
   possible grant or co-investment pathways, anchor institutions and the
   operational evidence still required.
5. **What community partnership and governance evidence is required?** Identify
   relevant Land Council, Native Title and administrative context while keeping
   community support, consent and culturally sensitive data controls explicit.

## Part 1: prototype we can defend now

The runnable prototype provides:

- map and accessible table views for 792 NT communities;
- Need, Impact, Delivery context, Resilience and Combined lenses;
- relative High / Medium / Lower tiers and a filter-aware Top 10;
- filters for region, community profile, population, mapped coverage,
  completeness and infrastructure distance;
- community evidence cards with raw values and explicit verification prompts;
- a five-community shortlist, comparison view and CSV/text exports;
- offline-capable static delivery after the first browser load; and
- transparent methodology and limitation statements in the interface.

The prototype answers:

> **Where should decision-makers investigate connectivity investment first,
> based on currently available public evidence?**

Its output is a **priority for due diligence**, not an investment recommendation.

The prototype's combined screening score weights connectivity need at 50%,
population impact at 20%, infrastructure proximity at 15%, and historical
cyclone exposure at 15%. Missing components are excluded and remaining weights
are renormalised. These weights are hypotheses to test with communities and
stakeholders—not objective truth.

## Part 2: ambitious future vision

The future platform answers:

> **Which connectivity solution would create the greatest sustainable,
> community-supported benefit, and how could it be delivered and funded?**

It would add four evidence pillars.

### 1. Community Need and Benefit Potential

- **Where is the greatest human need?** Combine connectivity gaps with larger or
  younger populations and important services such as schools and health clinics.
- **How severe is the current gap?** Compare mapped mobile, NBN and public Wi-Fi
  services and distance from recorded infrastructure.
- **What outcomes could connectivity enable?** Record potential education,
  healthcare, government-service and local economic benefits.

The product should describe these as **benefit potential** until real service,
outcome and financial data are available.

### 2. Delivery Readiness and Cost Drivers

- examine distance to towers, radio sites, roads, power and backhaul as factors
  that may influence deployment cost;
- identify infrastructure that may warrant investigation for reuse or
  co-location;
- include terrain, remoteness and cyclone exposure as construction and
  maintenance context; and
- list assumptions that still require engineering and site assessment.

Straight-line distance alone must not be converted into CapEx or treated as
proof of technical feasibility. Future engineering analysis could compare fibre,
microwave, mobile, fixed-wireless and satellite scenarios using supplier and
site-specific data.

A safe delivery-readiness output is:

- Lower apparent delivery complexity;
- Moderate apparent delivery complexity;
- Higher apparent delivery complexity; or
- Insufficient evidence.

### 3. Funding and Operational Sustainability

- identify related projects already funded or planned;
- surface relevant grant and co-investment opportunities;
- identify potential anchor institutions such as clinics, schools and council
  facilities; and
- show which power, maintenance, demand, staffing, pricing and operational-cost
  information still needs to be collected.

The platform can identify funding and sustainability opportunities, but it must
not claim guaranteed revenue or calculate OpEx without the required operating
evidence.

### 4. Community Partnership, Country and Governance

- identify relevant Native Title, Land Council and administrative boundaries;
- identify organisations and community representatives that should be engaged;
- record documented community support or relevant development plans when they
  exist;
- show cultural, location-sharing and Indigenous data-governance restrictions;
  and
- distinguish established consent from unknown or unassessed consent.

Community governance should shape the project rather than be treated as a
deployment obstacle. Public mapping may identify relevant boundaries and
organisations, but it cannot infer Traditional Owner approval.

Each candidate should therefore be able to end with an explainable decision card,
for example:

> **High community need · High benefit potential · Delivery complexity unknown ·
> Possible funding overlap · Community support not yet assessed**

## Decision workflow

The decision logic is:

**Need → Benefit → Delivery readiness → Sustainability → Community mandate → Due diligence priority**

The product progression is:

**Public-data screening → Field validation → Engineering assessment → Community partnership → Funding model → Deployment → Outcome monitoring**

Public data supports screening. Community engagement validates need and
priorities. Engineering and commercial work assesses technical options and
costs. Governance, consent and funding establish the partnership. Delivery then
needs transparent measurement of reliability and community outcomes.

For the competition prototype, the strongest defensible scope is the first two
pillars, with co-funding and governance shown as structured evidence panels and
every unknown clearly marked for real-world validation.

## Guardrails

- “No mapped coverage” does not prove no real-world service; field validation is
  required.
- Public population data may be missing, old or inappropriate for fine-grained
  decision-making.
- A community's ranking must never be treated as community consent.
- Exact locations and culturally sensitive data require community-controlled
  access rules.
- Relative tiers communicate comparison, not guaranteed benefit, feasibility or
  financial return.
- All investment candidates require current program-overlap, tenure, cultural,
  environmental and regulatory checks.
