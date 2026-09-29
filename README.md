# CDU Data Innovation Challenge 2026

## Remote Connectivity

This repository is for our submission to the [CDU IT Code Fair 2026 Data Innovation Challenge](https://itcodefair.cdu.edu.au/data-innovation-challenge/).

Remote communities across Australia often experience limited or unreliable internet and mobile coverage. These connectivity gaps restrict access to education, healthcare, government support, and other essential digital services.

Our response is **ConnectNT Investment Lens**: an offline-capable, map-first screening layer that helps users move from viewing many government data layers to forming a transparent, evidence-based shortlist for further investigation. It complements the Australian Government's First Nations Connectivity Mapping Tool rather than reproducing it.

## Challenge objectives

The solution should:

- identify and analyse areas with limited or unreliable connectivity;
- present connectivity gaps in a form that communities, governments, and service providers can understand;
- combine relevant data sources to produce clearer insights;
- account for ethical, cultural, and community impacts; and
- support low-connectivity or offline use where appropriate.

## Our solution

**Project name:** ConnectNT Investment Lens
**Team number:**   
**Team members and roles:** 

### Problem

Existing public maps are valuable for exploring infrastructure and coverage, but they do not directly answer the investment-screening questions: **Where is the community need? Where is the greatest benefit potential? What delivery factors should be investigated next?** Decision-makers must manually interpret many layers and can easily overlook uncertainty or treat mapped coverage as proof of real-world service.

### Approach

The prototype joins the project's community connectivity table, existing EWM priority ranking and BushTel regional/governance fields. It optionally derives a historical cyclone-exposure indicator from the Bureau of Meteorology tropical cyclone best-track dataset. Five switchable lenses—Need, Impact, Delivery context, Resilience and Combined—support regional/profile filters, a filter-aware Top 10, community evidence cards and a comparison shortlist.

The prototype produces a **priority for due diligence**, not an investment recommendation. It deliberately uses the phrase **delivery context**, not feasibility: distance to mapped infrastructure is useful for screening but cannot estimate CapEx, access, capacity, terrain constraints or permission to co-locate. A community being 40 km from a tower does not by itself show whether fibre, microwave, mobile, fixed-wireless or satellite deployment is technically or commercially viable. The interface keeps these validation requirements visible.

### Key findings

- 792 NT communities are represented in the current processed dataset.
- 442 have neither mapped mobile coverage nor mapped terrestrial NBN coverage in the source fields.
- Population is unknown for 324 communities, so any population-based impact ranking is explicitly incomplete.
- Infrastructure proximity and historical cyclone exposure can help organise due diligence, but neither proves build feasibility, service reliability or financial return.

### Recommendations

Use ConnectNT to create a transparent investigation shortlist, then validate it with communities and current field evidence. The next evidence phase should add measured service reliability, essential facilities, youth demographics, terrain/backhaul/power, funded-project overlap, costs and community-defined priorities. No ranking should be treated as community consent or an automatic investment decision.

The longer-term decision flow is **Need → Benefit → Delivery readiness → Sustainability → Community mandate → Due diligence priority**. A candidate should finish with an explainable decision card such as: **High community need · High benefit potential · Delivery complexity unknown · Possible funding overlap · Community support not yet assessed.** See [the product vision](docs/PRODUCT_VISION.md) for the staged roadmap and guardrails.

## Suggested data and tools

The organisers identify the following possible data sources:

- NT Remote Areas Mobile Coverage;
- Australian Digital Inclusion Index dashboard;
- National Broadband Network data;
- ACCC Mobile Infrastructure Report data release;
- tropical cyclone reports;
- First Nations Connectivity Mapping Tool;
- ACMA Site Location Map;
- ABS TableBuilder; and
- other public connectivity, geography, or community-demographic datasets.

Python, data-analysis and AI/ML libraries, public APIs, and mapping or visualisation tools may be used. Record the source, licence, retrieval date, and any preprocessing applied to every dataset. See the official [challenge resources](https://itcodefair.cdu.edu.au/datasciencechalllenge_datasets/) for links and updates.

## Repository structure

```text
.
|-- Code/                  # Existing notebooks and analysis scripts
|-- Raw_Data/              # Original public source extracts
|-- Processed_Data/        # Intermediate outputs
|-- Result/                # Joined connectivity and ranking outputs
|-- src/
|   `-- build_prototype_data.py
|-- prototype/             # Offline-capable browser prototype
|   |-- data/communities.js
|   |-- index.html
|   |-- app.js
|   |-- styles.css
|   `-- serve.py
|-- docs/PRODUCT_VISION.md
|-- requirements.txt      # No third-party runtime dependencies
`-- README.md
```

Do not commit confidential data, credentials, or restricted datasets. If source data cannot be redistributed, provide a download link and clear placement instructions instead.

## Reproducing the project

### Prerequisites

- Python 3.11 or newer
- A modern web browser
- Internet access only when refreshing the optional BOM cyclone source

### Setup

```bash
git clone <repository-url>
cd IT-CODEFAIR-2026
python -m venv .venv
```

Activate the environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate
```

No third-party packages are required. The requirements file is intentionally empty except for documentation:

```bash
python -m pip install -r requirements.txt
```

### Build the browser dataset

```bash
python src/build_prototype_data.py --download-cyclones
```

The command uses the checked-in CSV inputs and refreshes the official Bureau of Meteorology cyclone-track cache. To build offline from an existing cache—or leave cyclone evidence unassessed when no cache exists—omit `--download-cyclones`.

### Run the prototype

```bash
python prototype/serve.py --open
```

Open `http://127.0.0.1:8000/` if the browser does not open automatically. The prototype is static and its core files are cached after the first complete browser load. Use `Ctrl+C` to stop the local server.

## Ethics, culture, and community

The project should explicitly document:

- data limitations, uncertainty, and the risk of misleading coverage claims;
- privacy and data-governance considerations;
- culturally appropriate handling and representation of First Nations community data;
- consultation assumptions and limitations—public data should not be presented as a substitute for community voices;
- accessibility and plain-language communication; and
- how the proposed solution may benefit or disadvantage different communities.

## Submission requirements

The official requirements call for:

- a data-analysis report and background research;
- a 5-minute presentation slide deck;
- an interactive prototype;
- a Python-based solution (`.py` files and/or Jupyter Notebooks, with no package restrictions); and
- source code with comments on key steps and a README containing reproduction instructions.

The report must be a PDF of no more than eight pages, excluding the title page, references, and appendices. The approximately 2,500-word count is a guideline. It must use A4 pages, continuous page numbering, the specified fonts and sizes, and a header/footer containing the team and page numbers. Name it:

```text
DataChallenge_Team <number>_Report.pdf
```

The required report structure is:

1. title page;
2. 150–250 word summary;
3. introduction;
4. methodology;
5. findings;
6. discussion of ethical, cultural, and community impacts;
7. recommendations;
8. references; and
9. appendices where applicable, including the AI-use declaration, source code, and dataset links.

Check the official [report format and structure](https://itcodefair.cdu.edu.au/data-innovation-challenge-requirement/) before submitting, as requirements may be updated.

## Judging criteria

Submissions are assessed on:

- datasets;
- creativity and originality;
- technical sophistication;
- contextual relevance and practicality;
- ethical considerations; and
- presentation.

## Important dates

| Milestone | Date |
| --- | --- |
| Registration closes | Tuesday, 15 September 2026 |
| Final submission | Wednesday, 30 September 2026 |
| Challenge presentation day | Wednesday, 7 October 2026 |
| Winners announced | Thursday, 5 November 2026 |

Challenge Day runs from 9:00 am to 5:00 pm at Festival Learning Space 1.12, Danala, Education and Community Precinct, Darwin, Charles Darwin University. Each team presents a 10-minute pitch followed by 5 minutes of questions from the judges.

## Eligibility

Teams must contain two to four enrolled CDU IT coursework students from undergraduate, postgraduate, TAFE, or short-course programs. Higher Degree by Research students are not eligible.

## Official links

- [Challenge overview](https://itcodefair.cdu.edu.au/data-innovation-challenge/)
- [Datasets and development resources](https://itcodefair.cdu.edu.au/datasciencechalllenge_datasets/)
- [Report requirements](https://itcodefair.cdu.edu.au/data-innovation-challenge-requirement/)
- https://spatial.infrastructure.gov.au/portal/apps/experiencebuilder/experience/?id=81c5ae65fbf74ce3a89cf25b1f323d50&page=Page

## Licence

_Add the licence for the project code and verify that all third-party datasets remain subject to their original licences and terms of use._
