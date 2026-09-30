# Dataset README

## Data Sources

### 1. Australian Bureau of Statistics (ABS)

Population and demographic data were obtained from the **2021 Census DataPacks** for the Northern Territory.

Selected datasets:

- 2021 Indigenous Profile for Indigenous Locations (ILOC)
- 2021 General Community Profile for the Northern Territory

Source: https://www.abs.gov.au/census/find-census-data/datapacks

### 2. Australian Government Spatial Data Portal

Geographic boundary and location data for Indigenous Locations in the Northern Territory were obtained from the Australian Government Spatial Data Portal.

Source: https://spatial.infrastructure.gov.au/portal/home/item.html?id=29918b8b3c764d8d9de643ef6cc96b38

### 3. Bureau of Meteorology tropical cyclone tracks

The prototype data build can download the Bureau of Meteorology historical
tropical cyclone best-track CSV. The raw download is cached locally under
`.cache/` and is not committed. The Northern Territory Investment Layer uses tropical-cyclone observations
from 1970 onward to count unique historical tracks within 100 km and 200 km of
each community and calculate a relative exposure indicator.

Sources:

- https://www.bom.gov.au/cyclone/history/
- https://www.bom.gov.au/clim_data/IDCKMSTM0S.csv

Historical track proximity is not a forecast, outage model or site-specific
engineering risk assessment.

## Data Use

The datasets were combined to identify Indigenous Locations and population information for spatial analysis of remote community connectivity in the Northern Territory.

## Reference Year

2021 Census data.
