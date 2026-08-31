# CDU Data Innovation Challenge 2026

## Remote Connectivity

This repository is for our submission to the [CDU IT Code Fair 2026 Data Innovation Challenge](https://itcodefair.cdu.edu.au/data-innovation-challenge/).

Remote communities across Australia often experience limited or unreliable internet and mobile coverage. These connectivity gaps restrict access to education, healthcare, government support, and other essential digital services. This project will use data to identify and explain those gaps and develop a practical solution that remains useful in low-connectivity or offline settings.

> This README currently provides the challenge brief and a reproducibility template. Replace the marked placeholders as the project develops.

## Challenge objectives

The solution should:

- identify and analyse areas with limited or unreliable connectivity;
- present connectivity gaps in a form that communities, governments, and service providers can understand;
- combine relevant data sources to produce clearer insights;
- account for ethical, cultural, and community impacts; and
- support low-connectivity or offline use where appropriate.

## Our solution

**Project name:**   
**Team number:**   
**Team members and roles:** 

### Problem

_Describe the specific connectivity problem or geographic area the team is investigating._

### Approach

_Summarise the datasets, analysis methods, visualisations, and prototype._

### Key findings

_Add the most important findings and supporting evidence._

### Recommendations

_Add practical recommendations for community, government, or industry stakeholders._

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

The following structure is recommended and can be adapted to the final solution:

```text
.
|-- data/
|   |-- raw/              # Original data (or download instructions)
|   `-- processed/        # Cleaned and derived data
|-- notebooks/            # Exploratory analysis
|-- src/                  # Reusable Python source code
|-- prototype/            # Interactive or offline-first prototype
|-- reports/              # Final report and presentation
|-- requirements.txt      # Pinned Python dependencies
|-- .env.example          # Required variable names, without secrets
`-- README.md
```

Do not commit confidential data, credentials, or restricted datasets. If source data cannot be redistributed, provide a download link and clear placement instructions instead.

## Reproducing the project

The final submission must include reproducible instructions. Update the commands and paths below to match the implementation.

### Prerequisites

- Python _version to be added_
- Git
- _Any additional software or account requirements_

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

Install dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Data preparation

1. _List each dataset and its official download URL._
2. _Explain where each downloaded file must be placed._
3. _Document any required API keys in `.env.example`._
4. _Add the command used to clean or combine the data._

```bash
python <data-preparation-script>
```

### Run the analysis

```bash
python <analysis-script>
```

### Run the prototype

```bash
python <prototype-entry-point>
```

_Add the local address, expected outputs, offline-use instructions, and troubleshooting notes._

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

## Licence

_Add the licence for the project code and verify that all third-party datasets remain subject to their original licences and terms of use._
