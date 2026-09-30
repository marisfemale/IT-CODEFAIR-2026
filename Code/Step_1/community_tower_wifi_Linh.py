"""Create an NT community map showing distance to the nearest ACMA site.

Required input files in the same folder as this script:
  - bushtel_clean.csv
  - site.csv

Outputs are written to outputs/ when this script runs.  This version does not
use ADII. It requires only pandas and numpy, which keeps the process simple.
"""

from __future__ import annotations

import html
import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parent
COMMUNITIES_PATH = PROJECT_DIR / "bushtel_clean.csv"
SITES_PATH = PROJECT_DIR / "site.csv"
WIFI_PATH = PROJECT_DIR / "wifi_connection.csv"
OUTPUT_DIR = PROJECT_DIR / "outputs"
NT_BOUNDARY_GEOJSON_PATH = OUTPUT_DIR / "nt_boundary.geojson"

# Project assumption: 50 km or more receives the maximum proximity score.
# This is not an ACMA mobile-coverage standard.
SCORE_DISTANCE_CAP_KM = 50.0
EARTH_RADIUS_KM = 6371.0088


def clean_sites(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Standardise ACMA fields and retain only valid site coordinates."""
    sites = raw.rename(
        columns={
            "SITE_ID": "site_id",
            "LATITUDE": "latitude",
            "LONGITUDE": "longitude",
            "NAME": "site_name",
            "STATE": "site_state",
            "SITE_PRECISION": "site_precision",
        }
    ).copy()
    required = {"site_id", "latitude", "longitude", "site_name", "site_state"}
    missing = required - set(sites.columns)
    if missing:
        raise ValueError(f"site.csv is missing columns: {sorted(missing)}")

    for column in ("latitude", "longitude"):
        sites[column] = pd.to_numeric(sites[column], errors="coerce")
    for column in ("site_id", "site_name", "site_state"):
        sites[column] = sites[column].astype("string").str.strip()
    sites["site_state"] = sites["site_state"].str.upper()
    if "site_precision" not in sites:
        sites["site_precision"] = pd.NA
    else:
        sites["site_precision"] = sites["site_precision"].astype("string").str.strip()

    valid = (
        sites["latitude"].between(-90, 90)
        & sites["longitude"].between(-180, 180)
        & sites["site_id"].notna()
        & sites["site_id"].ne("")
    )
    valid_sites = sites.loc[valid].copy()
    # This project compares NT communities with infrastructure located in NT.
    # Sites in WA, QLD, SA, etc. are deliberately excluded before matching.
    clean = valid_sites.loc[valid_sites["site_state"].eq("NT")].copy()

    # Do not delete duplicate coordinates: they can be multiple co-located sites.
    clean["co_located_site_count"] = clean.groupby(["latitude", "longitude"])[
        "site_id"
    ].transform("size")
    report = {
        "acma_input_rows": int(len(sites)),
        "acma_invalid_coordinate_or_id_rows_removed": int(len(sites) - len(valid_sites)),
        "acma_valid_coordinate_rows": int(len(valid_sites)),
        "acma_non_nt_rows_excluded": int(len(valid_sites) - len(clean)),
        "acma_nt_sites_used": int(len(clean)),
        "acma_duplicate_coordinate_rows": int(clean.duplicated(["latitude", "longitude"]).sum()),
    }
    return clean, report


def clean_communities(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Standardise BushTel fields and retain communities with valid points."""
    communities = raw.copy()
    required = {"community_id", "community_name", "latitude", "longitude"}
    missing = required - set(communities.columns)
    if missing:
        raise ValueError(f"bushtel_clean.csv is missing columns: {sorted(missing)}")

    for column in ("latitude", "longitude"):
        communities[column] = pd.to_numeric(communities[column], errors="coerce")
    for column in ("community_id", "community_name"):
        communities[column] = communities[column].astype("string").str.strip()
    if "population_final" in communities:
        communities["population_final"] = pd.to_numeric(
            communities["population_final"], errors="coerce"
        )

    valid = (
        communities["latitude"].between(-90, 90)
        & communities["longitude"].between(-180, 180)
        & communities["community_id"].notna()
        & communities["community_id"].ne("")
        & communities["community_name"].notna()
        & communities["community_name"].ne("")
    )
    clean = communities.loc[valid].copy()
    return clean, {
        "community_input_rows": int(len(communities)),
        "community_removed_rows": int(len(communities) - len(clean)),
        "community_clean_rows": int(len(clean)),
    }


def clean_wifi(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Keep valid, completed Wi-Fi points and standardise their field names."""
    wifi = raw.rename(
        columns={
            "wifi": "wifi_type",
            "community": "wifi_community_name",
        }
    ).copy()
    required = {
        "wifi_id", "wifi_community_name", "wifi_type", "wifi_status", "state",
        "wifi_latitude", "wifi_longitude",
    }
    missing = required - set(wifi.columns)
    if missing:
        raise ValueError(f"wifi_connection.csv is missing columns: {sorted(missing)}")

    wifi["wifi_latitude"] = pd.to_numeric(wifi["wifi_latitude"], errors="coerce")
    wifi["wifi_longitude"] = pd.to_numeric(wifi["wifi_longitude"], errors="coerce")
    for column in ("wifi_id", "wifi_community_name", "wifi_type", "wifi_status", "state"):
        wifi[column] = wifi[column].astype("string").str.strip()
    wifi["state"] = wifi["state"].str.upper()

    completed = wifi["wifi_status"].str.casefold().eq("completed")
    valid_coordinate = (
        wifi["wifi_latitude"].between(-90, 90)
        & wifi["wifi_longitude"].between(-180, 180)
    )
    valid_completed = wifi.loc[completed & valid_coordinate].copy()
    # Only completed Wi-Fi infrastructure physically recorded in NT is eligible.
    clean = valid_completed.loc[valid_completed["state"].eq("NT")].copy()
    if clean.empty:
        raise ValueError("No completed Northern Territory Wi-Fi points are available.")
    return clean, {
        "wifi_input_rows": int(len(wifi)),
        "wifi_completed_valid_coordinate_rows": int(len(valid_completed)),
        "wifi_completed_non_nt_rows_excluded": int(len(valid_completed) - len(clean)),
        "wifi_completed_nt_rows_used": int(len(clean)),
        "wifi_non_completed_or_invalid_coordinate_rows_excluded": int(len(wifi) - len(valid_completed)),
    }


def find_nearest_locations(
    communities: pd.DataFrame,
    candidates: pd.DataFrame,
    latitude_column: str,
    longitude_column: str,
    candidate_label: str,
) -> tuple[np.ndarray, np.ndarray]:
    """Find the nearest candidate point using Haversine (great-circle) distance.

    Candidate points have already been filtered to Northern Territory records.
    The calculation is memory-safe: one community is compared with all
    candidate points at a time.
    """
    candidate_lat = np.radians(candidates[latitude_column].to_numpy(float))
    candidate_lon = np.radians(candidates[longitude_column].to_numpy(float))
    indices = np.empty(len(communities), dtype=int)
    distances = np.empty(len(communities), dtype=float)

    for position, (_, community) in enumerate(communities.iterrows()):
        community_lat = np.radians(float(community["latitude"]))
        community_lon = np.radians(float(community["longitude"]))
        d_lat = candidate_lat - community_lat
        d_lon = candidate_lon - community_lon
        a = (
            np.sin(d_lat / 2) ** 2
            + np.cos(community_lat) * np.cos(candidate_lat) * np.sin(d_lon / 2) ** 2
        )
        km = EARTH_RADIUS_KM * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        indices[position] = int(np.argmin(km))
        distances[position] = float(km[indices[position]])
        if (position + 1) % 100 == 0 or position + 1 == len(communities):
            print(f"  Nearest {candidate_label}: {position + 1}/{len(communities)} communities")
    return indices, distances


def priority_label(score: float) -> str:
    if score < 10:
        return "Low distance priority"
    if score < 40:
        return "Moderate distance priority"
    if score < 75:
        return "High distance priority"
    return "Very high distance priority"


def add_connectivity_fields(
    communities: pd.DataFrame, sites: pd.DataFrame, wifi: pd.DataFrame
) -> pd.DataFrame:
    """Add nearest ACMA-site and nearest completed-Wi-Fi information."""
    indices, distance_km = find_nearest_locations(
        communities, sites, "latitude", "longitude", "ACMA site"
    )
    nearest = sites.iloc[indices].reset_index(drop=True)
    result = communities.reset_index(drop=True).copy()
    result["nearest_site_id"] = nearest["site_id"]
    result["nearest_site_name"] = nearest["site_name"]
    result["nearest_site_state"] = nearest["site_state"]
    result["nearest_site_latitude"] = nearest["latitude"]
    result["nearest_site_longitude"] = nearest["longitude"]
    result["nearest_site_precision"] = nearest["site_precision"]
    result["nearest_site_co_located_count"] = nearest["co_located_site_count"]
    result["nearest_site_distance_km"] = np.round(distance_km, 2)
    result["distance_score"] = np.round(
        np.clip(distance_km / SCORE_DISTANCE_CAP_KM * 100, 0, 100), 1
    )
    result["distance_priority"] = result["distance_score"].map(priority_label)

    wifi_indices, wifi_distance_km = find_nearest_locations(
        communities, wifi, "wifi_latitude", "wifi_longitude", "completed Wi-Fi point"
    )
    nearest_wifi = wifi.iloc[wifi_indices].reset_index(drop=True)
    result["nearest_wifi_id"] = nearest_wifi["wifi_id"]
    result["nearest_wifi_community"] = nearest_wifi["wifi_community_name"]
    result["nearest_wifi_type"] = nearest_wifi["wifi_type"]
    result["nearest_wifi_status"] = nearest_wifi["wifi_status"]
    result["nearest_wifi_address"] = nearest_wifi.get("address", pd.Series(pd.NA, index=nearest_wifi.index))
    result["nearest_wifi_city"] = nearest_wifi.get("city", pd.Series(pd.NA, index=nearest_wifi.index))
    result["nearest_wifi_state"] = nearest_wifi.get("state", pd.Series(pd.NA, index=nearest_wifi.index))
    result["nearest_wifi_latitude"] = nearest_wifi["wifi_latitude"]
    result["nearest_wifi_longitude"] = nearest_wifi["wifi_longitude"]
    result["nearest_wifi_distance_km"] = np.round(wifi_distance_km, 2)
    return result


def create_master_table(data: pd.DataFrame) -> pd.DataFrame:
    """Keep only the clear, presentation-ready columns for the final CSV."""
    columns = [
        "community_id",
        "community_name",
        "community_type",
        "latitude",
        "longitude",
        "population_final",
        "nearest_site_state",
        "nearest_site_id",
        "nearest_site_name",
        "nearest_site_distance_km",
        "nearest_wifi_id",
        "nearest_wifi_address",
        "nearest_wifi_distance_km",
    ]
    master_table = data.loc[:, columns].copy()
    return master_table.rename(
        columns={
            "latitude": "community_latitude",
            "longitude": "community_longitude",
            "nearest_site_state": "nearest_tower_state",
            "nearest_site_id": "nearest_tower_id",
            "nearest_site_name": "nearest_tower_name",
            "nearest_site_distance_km": "distance_community_to_tower_km",
            "nearest_wifi_id": "nearest_wifi_id",
            "nearest_wifi_address": "nearest_wifi_address",
            "nearest_wifi_distance_km": "distance_community_to_wifi_km",
        }
    )


def json_safe(value):
    """Convert pandas/numpy scalar values to valid JSON values."""
    if pd.isna(value):
        return None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    return value


def load_nt_boundary() -> dict | None:
    """Load the already-exported ABS Northern Territory GeoJSON boundary.

    This avoids sqlite3, which is broken in the user's current Anaconda Python.
    """
    if not NT_BOUNDARY_GEOJSON_PATH.is_file():
        print("  nt_boundary.geojson was not found; map will show points only.")
        return None
    return json.loads(NT_BOUNDARY_GEOJSON_PATH.read_text(encoding="utf-8"))


def write_geojson(data: pd.DataFrame, path: Path) -> None:
    """Export communities as GeoJSON points in longitude/latitude (EPSG:4326)."""
    property_columns = [
        "community_id", "community_name", "community_type", "population", "population_final",
        "population_source", "population_match_status", "ILOC_CODE_2021", "iloc_name",
        "nearest_site_id", "nearest_site_name", "nearest_site_state", "nearest_site_latitude",
        "nearest_site_longitude", "nearest_site_precision", "nearest_site_co_located_count",
        "nearest_site_distance_km", "distance_score", "distance_priority",
        "nearest_wifi_id", "nearest_wifi_community", "nearest_wifi_type", "nearest_wifi_status",
        "nearest_wifi_address", "nearest_wifi_city", "nearest_wifi_state", "nearest_wifi_latitude",
        "nearest_wifi_longitude", "nearest_wifi_distance_km",
    ]
    property_columns = [column for column in property_columns if column in data.columns]
    features = []
    for _, row in data.iterrows():
        features.append({
            "type": "Feature",
            "properties": {column: json_safe(row[column]) for column in property_columns},
            # GeoJSON coordinate order is longitude, latitude.
            "geometry": {"type": "Point", "coordinates": [float(row["longitude"]), float(row["latitude"])]},
        })
    feature_collection = {
        "type": "FeatureCollection",
        "name": "NT community connectivity: nearest ACMA site and completed Wi-Fi point",
        "crs_note": "EPSG:4326 (longitude, latitude)",
        "features": features,
    }
    path.write_text(json.dumps(feature_collection, ensure_ascii=False, indent=2), encoding="utf-8")


def write_map(data: pd.DataFrame, nt_boundary: dict | None, path: Path) -> None:
    """Create an interactive Leaflet map with community dots and popups."""
    fields = [
        "community_id", "community_name", "community_type", "population_final", "population",
        "latitude", "longitude", "nearest_site_id", "nearest_site_name", "nearest_site_state",
        "nearest_site_latitude", "nearest_site_longitude", "nearest_site_precision",
        "nearest_site_distance_km", "distance_score", "distance_priority",
        "nearest_wifi_id", "nearest_wifi_community", "nearest_wifi_type", "nearest_wifi_status",
        "nearest_wifi_address", "nearest_wifi_city", "nearest_wifi_state", "nearest_wifi_latitude",
        "nearest_wifi_longitude", "nearest_wifi_distance_km",
    ]
    fields = [field for field in fields if field in data.columns]
    map_data = [{field: json_safe(row[field]) for field in fields} for _, row in data.iterrows()]
    embedded_data = json.dumps(map_data, ensure_ascii=False)
    embedded_boundary = json.dumps(nt_boundary, ensure_ascii=False)

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NT Community Connectivity Map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
body {{ margin:0; font-family:Arial,sans-serif; }} #map {{ height:100vh; }}
.panel {{ background:rgba(255,255,255,.95); padding:12px; border-radius:6px; box-shadow:0 1px 5px #777; max-width:310px; line-height:1.35; }}
.panel h1 {{ font-size:16px; margin:0 0 8px; }} .panel p,.legend {{ font-size:12px; margin:5px 0; }}
.dot {{ display:inline-block; width:11px; height:11px; border-radius:50%; margin-right:5px; }}
table {{ border-collapse:collapse; font-size:12px; }} th {{ text-align:left; padding:3px 8px 3px 0; vertical-align:top; }} td {{ padding:3px 0; }}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const communities = {embedded_data};
const ntBoundary = {embedded_boundary};
const map = L.map('map');
// No public tile server is used: the NT outline is stored locally in this map.
// This prevents the OpenStreetMap 403 block seen with the previous version.
function colour(score) {{ return score < 10 ? '#2c7bb6' : score < 40 ? '#abd9e9' : score < 75 ? '#fdae61' : '#d7191c'; }}
function safe(value) {{ if (value === null || value === undefined || value === '') return 'Not available'; const span=document.createElement('span'); span.textContent=String(value); return span.innerHTML; }}
function number(value, suffix='') {{ return value === null || value === undefined ? 'Not available' : Number(value).toLocaleString(undefined,{{maximumFractionDigits:2}})+suffix; }}
function popup(c) {{ return `<table><tr><th>Community</th><td>${{safe(c.community_name)}}</td></tr><tr><th>Type</th><td>${{safe(c.community_type)}}</td></tr><tr><th>Population</th><td>${{number(c.population_final ?? c.population)}}</td></tr><tr><th>Nearest ACMA site</th><td>${{safe(c.nearest_site_name)}}</td></tr><tr><th>Site ID</th><td>${{safe(c.nearest_site_id)}}</td></tr><tr><th>Distance to site</th><td>${{number(c.nearest_site_distance_km,' km')}}</td></tr><tr><th>Distance Score</th><td>${{number(c.distance_score,' / 100')}}</td></tr><tr><th>Priority</th><td>${{safe(c.distance_priority)}}</td></tr><tr><th>Nearest completed Wi-Fi</th><td>${{safe(c.nearest_wifi_community)}}</td></tr><tr><th>Wi-Fi type</th><td>${{safe(c.nearest_wifi_type)}}</td></tr><tr><th>Wi-Fi address</th><td>${{safe(c.nearest_wifi_address)}}</td></tr><tr><th>Distance to Wi-Fi</th><td>${{number(c.nearest_wifi_distance_km,' km')}}</td></tr></table>`; }}
const points=L.layerGroup(), bounds=[];
let ntOutline;
if (ntBoundary) {{
  ntOutline=L.geoJSON(ntBoundary,{{style:{{color:'#1b5e20',weight:2,fillColor:'#dcedc8',fillOpacity:.45}}}}).addTo(map);
}}
communities.forEach(c => {{
  L.circleMarker([c.latitude,c.longitude],{{radius:6,color:'#333',weight:1,fillColor:colour(c.distance_score),fillOpacity:.9}}).bindPopup(popup(c),{{maxWidth:340}}).addTo(points);
  bounds.push([c.latitude,c.longitude]);
}});
points.addTo(map); if (bounds.length) map.fitBounds(bounds,{{padding:[20,20]}});
if (ntOutline) map.fitBounds(ntOutline.getBounds(),{{padding:[20,20]}});
const overlays={{'Community points':points}};
if (ntOutline) overlays['Northern Territory boundary']=ntOutline;
L.control.layers(null,overlays,{{collapsed:false}}).addTo(map);
const panel=L.control({{position:'topright'}}); panel.onAdd=() => {{ const div=L.DomUtil.create('div','panel'); div.innerHTML=`<h1>Northern Territory Community Connectivity</h1><p>${{communities.length}} community points. Select a point for its nearest ACMA site and distance.</p><div class="legend"><span class="dot" style="background:#2c7bb6"></span>0–9.9: low distance priority</div><div class="legend"><span class="dot" style="background:#abd9e9"></span>10–39.9: moderate</div><div class="legend"><span class="dot" style="background:#fdae61"></span>40–74.9: high</div><div class="legend"><span class="dot" style="background:#d7191c"></span>75–100: very high</div><p>Score = min(distance ÷ 50 km × 100, 100). It indicates proximity to an ACMA site, not verified coverage.</p>`; L.DomEvent.disableClickPropagation(div); return div; }}; panel.addTo(map);
</script></body></html>"""
    path.write_text(page, encoding="utf-8")


def main() -> None:
    required_files = (COMMUNITIES_PATH, SITES_PATH, WIFI_PATH)
    if not all(path.is_file() for path in required_files):
        raise FileNotFoundError(
            "Keep bushtel_clean.csv, site.csv, and wifi_connection.csv beside IT_codefair.py."
        )
    OUTPUT_DIR.mkdir(exist_ok=True)

    print("1/6 Reading CSV files")
    raw_communities = pd.read_csv(COMMUNITIES_PATH, encoding="utf-8-sig", low_memory=False)
    raw_sites = pd.read_csv(SITES_PATH, encoding="utf-8-sig", low_memory=False)
    raw_wifi = pd.read_csv(WIFI_PATH, encoding="utf-8-sig", low_memory=False)
    print("2/6 Cleaning ACMA site coordinates")
    sites, site_report = clean_sites(raw_sites)
    sites.to_csv(OUTPUT_DIR / "acma_sites_clean.csv", index=False)
    print("3/6 Cleaning completed Wi-Fi points and finding nearest infrastructure")
    communities, community_report = clean_communities(raw_communities)
    wifi, wifi_report = clean_wifi(raw_wifi)
    result = add_connectivity_fields(communities, sites, wifi)
    print("4/6 Writing the community, tower, and Wi-Fi distance table")
    result.to_csv(OUTPUT_DIR / "community_nearest_acma_site.csv", index=False)
    master_table = create_master_table(result)
    master_table.to_csv(OUTPUT_DIR / "community_connectivity_master_table.csv", index=False)
    print("5/6 Exporting community points and the NT boundary as GeoJSON")
    write_geojson(result, OUTPUT_DIR / "nt_community_connectivity.geojson")
    nt_boundary = load_nt_boundary()
    print("6/6 Building the interactive HTML map")
    write_map(result, nt_boundary, OUTPUT_DIR / "nt_community_connectivity_map.html")

    report = {
        "created_on": date.today().isoformat(),
        "method": "Nearest ACMA site and nearest completed Wi-Fi point using Haversine great-circle distance",
        "coordinate_system": "EPSG:4326 (longitude, latitude)",
        "distance_score_formula": f"min(distance_km / {SCORE_DISTANCE_CAP_KM:g} * 100, 100)",
        "limitation": "ACMA-site proximity is not verified mobile coverage, speed, or reliability.",
        **site_report, **wifi_report, **community_report,
        "output_community_features": int(len(result)),
        "distance_km_min": float(result["nearest_site_distance_km"].min()),
        "distance_km_median": float(result["nearest_site_distance_km"].median()),
        "distance_km_max": float(result["nearest_site_distance_km"].max()),
    }
    (OUTPUT_DIR / "data_quality_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\nFinished. Open outputs/nt_community_connectivity_map.html in a browser.")


if __name__ == "__main__":
    main()
