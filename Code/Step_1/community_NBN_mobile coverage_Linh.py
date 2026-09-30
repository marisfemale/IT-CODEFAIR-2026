"""Match NT communities to ACCC mobile coverage polygons and mobile sites.

Input is the community connectivity master table.  The script queries the five
ACCC ArcGIS REST layers supplied for this project:

* polygon layers (Telstra, Optus, TPG, and TPG-on-Optus) become ``Yes``/``No``
  coverage fields; and
* the point layer (all mobile networks) is used to calculate the great-circle
  distance from each community to its nearest mobile site.

Only the standard library, pandas, and numpy are required.  In particular, it
does not require geopandas, shapely, or requests.

Run from this folder, for example:

    python code_moi

or choose a different source/destination:

    python code_moi --input community_connectivity_master_table.csv \
        --output community_connectivity_master_table_mobile_coverage.csv

The input CSV is never overwritten by default.

If a slow ArcGIS polygon layer needs to be resumed, update one coverage page
at a time. For example, layer 14 has 25-feature pages:

    python code_moi --update-master --layer-id 14 --page-offset 0
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parent
SERVICE_URL = (
    "https://spatial.infrastructure.gov.au/server/rest/services/"
    "Mobile_Coverages_and_Sites_ACCC/MapServer"
)
NBN_SERVICE_URL = (
    "https://spatial.infrastructure.gov.au/server/rest/services/"
    "NBN_Coverage_Footprints_2024/MapServer"
)
EARTH_RADIUS_KM = 6371.0088
HTTP_TIMEOUT_SECONDS = 90
HTTP_ATTEMPTS = 6
HTTP_RETRY_DELAYS_SECONDS = (2, 4, 8, 16, 30)
RING_EPSILON = 1e-10
# These detailed ACCC polygon layers return HTTP 500 if all NT features are
# serialised in one response.  The listed page sizes were verified against the
# live service; remaining layers can use its normal record limit.
SMALL_POLYGON_PAGE_LIMITS = {14: 25, 31: 25, 7: 100}
MAX_POINT_FEATURES_PER_PAGE = 2000
# The Northern Territory's state extent in EPSG:4326.  Passing this envelope to
# the service means no national mobile-coverage/site dataset is downloaded.
NT_QUERY_ENVELOPE = {
    "xmin": 129.0,
    "ymin": -26.0,
    "xmax": 138.0,
    "ymax": -10.9,
    "spatialReference": {"wkid": 4326},
}


def create_tls_context() -> ssl.SSLContext:
    """Use the OS CA bundle when a Python installation has no usable default.

    Some Anaconda/macOS Python installations point OpenSSL at a missing or
    incomplete certificate bundle.  ``/etc/ssl/cert.pem`` is the system bundle
    in the project environment.  This remains normal certificate validation;
    it does *not* disable HTTPS verification.  Other systems use Python's
    default verified context.
    """
    system_bundle = Path("/etc/ssl/cert.pem")
    if system_bundle.is_file():
        try:
            return ssl.create_default_context(cafile=str(system_bundle))
        except ssl.SSLError:
            pass
    return ssl.create_default_context()


TLS_CONTEXT = create_tls_context()


@dataclass(frozen=True)
class LayerSpec:
    """A polygon service layer and its Yes/No output column."""

    layer_id: int
    output_column: str
    label: str
    service_url: str = SERVICE_URL


# The layer IDs are deliberately retained from the URLs supplied for the task.
PROVIDER_OUTDOOR_COLUMNS = (
    "mobile_outdoor_coverage_telstra",
    "mobile_outdoor_coverage_optus",
    "mobile_outdoor_coverage_tpg",
    "mobile_outdoor_coverage_tpg_on_optus",
)
COVERAGE_LAYERS = (
    # The four original links: provider-specific total outdoor coverage.
    LayerSpec(20, "mobile_outdoor_coverage_telstra", "Telstra total outdoor coverage"),
    LayerSpec(14, "mobile_outdoor_coverage_optus", "Optus total outdoor coverage"),
    LayerSpec(25, "mobile_outdoor_coverage_tpg", "TPG total outdoor coverage"),
    LayerSpec(
        31,
        "mobile_outdoor_coverage_tpg_on_optus",
        "TPG total outdoor coverage on Optus network",
    ),
    # These are national-network union layers, so Yes means at least one
    # mobile network claims outdoor coverage at the community coordinate.
    LayerSpec(7, "mobile_4g_outdoor_coverage_any_network", "4G outdoor coverage"),
    LayerSpec(6, "mobile_5g_outdoor_coverage_any_network", "5G outdoor coverage"),
)
NBN_COVERAGE_LAYERS = (
    LayerSpec(
        3,
        "nbn_fixed_wireless_coverage",
        "NBN Fixed Wireless coverage",
        NBN_SERVICE_URL,
    ),
    LayerSpec(
        2,
        "nbn_fixed_line_coverage",
        "NBN Fixed Line coverage",
        NBN_SERVICE_URL,
    ),
)
MOBILE_SITES_LAYER_ID = 1
LTE_FIELDS = (
    "LTE700", "LTE850", "LTE900", "LTE1800", "LTE2100", "LTE2300", "LTE2600",
)
NR_FIELDS = (
    "NR700", "NR850", "NR900", "NR1800", "NR2100", "NR2300", "NR2600",
    "NR3500", "NR3600", "NR26000",
)
MOBILE_SITE_OUTPUT_COLUMNS = (
    "nearest_mobile_site_distance_km",
    "nearest_mobile_site_objectid",
    "nearest_mobile_site_rfnsa_id",
    "nearest_mobile_site_mno",
    "nearest_mobile_site_year",
    "nearest_mobile_site_latitude",
    "nearest_mobile_site_longitude",
    "nearest_mobile_site_has_4g",
    "nearest_mobile_site_has_5g",
)


class ArcGISServiceError(RuntimeError):
    """Raised when the ArcGIS REST service cannot return usable data."""


def layer_url(layer_id: int, service_url: str = SERVICE_URL) -> str:
    return f"{service_url}/{layer_id}"


def get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    """Request JSON with small retries for temporary service/network failures."""
    request_url = f"{url}?{urlencode(params)}"
    last_error: Exception | None = None

    for attempt in range(1, HTTP_ATTEMPTS + 1):
        request = Request(
            request_url,
            headers={
                "Accept": "application/json",
                "User-Agent": "community-mobile-coverage-matcher/1.0",
            },
        )
        try:
            with urlopen(
                request, context=TLS_CONTEXT, timeout=HTTP_TIMEOUT_SECONDS
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if "error" in payload:
                error = payload["error"]
                raise ArcGISServiceError(
                    f"ArcGIS error {error.get('code', 'unknown')}: "
                    f"{error.get('message', error)}"
                )
            return payload
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ArcGISServiceError) as exc:
            last_error = exc
            if attempt == HTTP_ATTEMPTS:
                break
            wait_seconds = HTTP_RETRY_DELAYS_SECONDS[attempt - 1]
            print(
                f"  Request failed ({exc}); retrying in {wait_seconds} seconds "
                f"[{attempt}/{HTTP_ATTEMPTS}]...",
                flush=True,
            )
            time.sleep(wait_seconds)

    raise ArcGISServiceError(f"Could not retrieve {url}: {last_error}")


def get_layer_metadata(
    layer_id: int, service_url: str = SERVICE_URL
) -> dict[str, Any]:
    """Return metadata used to validate each supplied layer before matching."""
    return get_json(layer_url(layer_id, service_url), {"f": "json"})


def detect_coordinate_columns(data: pd.DataFrame) -> tuple[str, str]:
    """Find community longitude and latitude columns in either master-table form."""
    normalised = {str(column).strip().casefold(): column for column in data.columns}

    def find(candidates: tuple[str, ...], coordinate_name: str) -> str:
        for candidate in candidates:
            if candidate in normalised:
                return str(normalised[candidate])
        raise ValueError(
            f"The input CSV needs a {coordinate_name} column. Expected one of: "
            f"{', '.join(candidates)}. Found: {', '.join(map(str, data.columns))}"
        )

    latitude = find(("community_latitude", "latitude", "lat"), "latitude")
    longitude = find(("community_longitude", "longitude", "lon", "lng"), "longitude")
    return latitude, longitude


def valid_coordinate_mask(data: pd.DataFrame, latitude: str, longitude: str) -> pd.Series:
    """Coerce community coordinates and return a mask for valid WGS84 points."""
    data[latitude] = pd.to_numeric(data[latitude], errors="coerce")
    data[longitude] = pd.to_numeric(data[longitude], errors="coerce")
    return (
        data[latitude].between(-90, 90, inclusive="both")
        & data[longitude].between(-180, 180, inclusive="both")
    ).fillna(False)


def envelope_query_parameters(envelope: dict[str, Any]) -> dict[str, str]:
    """Parameters common to an ArcGIS query spatially restricted to communities."""
    return {
        "where": "1=1",
        "geometry": json.dumps(envelope, separators=(",", ":")),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outSR": "4326",
    }


def query_feature_count(
    layer_id: int,
    envelope: dict[str, Any],
    service_url: str = SERVICE_URL,
) -> int:
    """Count records first so paginated feature downloads can be verified."""
    params = envelope_query_parameters(envelope)
    params.update({"f": "json", "returnCountOnly": "true"})
    response = get_json(f"{layer_url(layer_id, service_url)}/query", params)
    try:
        return int(response["count"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ArcGISServiceError(
            f"Layer {layer_id} did not return a valid feature count: {response}"
        ) from exc


def layer_page_limit(layer_id: int, metadata: dict[str, Any]) -> int:
    """Return the largest safe feature page for a service layer."""
    record_limit = int(metadata.get("maxRecordCount") or 2000)
    safe_page_limit = SMALL_POLYGON_PAGE_LIMITS.get(
        layer_id,
        MAX_POINT_FEATURES_PER_PAGE,
    )
    return max(1, min(record_limit, safe_page_limit))


def query_feature_page(
    layer_id: int,
    metadata: dict[str, Any],
    envelope: dict[str, Any],
    out_fields: str,
    page_offset: int,
    page_size: int | None = None,
    service_url: str = SERVICE_URL,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Download one verified page, for resumable updates of slow layers."""
    expected_count = query_feature_count(layer_id, envelope, service_url)
    if page_offset < 0 or page_offset >= expected_count:
        raise ValueError(
            f"Page offset for layer {layer_id} must be from 0 to "
            f"{max(expected_count - 1, 0)}; got {page_offset}."
        )
    safe_page_size = layer_page_limit(layer_id, metadata)
    if page_size is not None:
        safe_page_size = max(1, min(page_size, safe_page_size))
    requested_count = min(safe_page_size, expected_count - page_offset)
    object_id_field = metadata.get("objectIdField") or "OBJECTID"
    params = envelope_query_parameters(envelope)
    params.update(
        {
            "f": "json",
            "outFields": out_fields,
            "returnGeometry": "true",
            "returnZ": "false",
            "returnM": "false",
            "resultOffset": str(page_offset),
            "resultRecordCount": str(requested_count),
            "orderByFields": object_id_field,
        }
    )
    response = get_json(f"{layer_url(layer_id, service_url)}/query", params)
    features = response.get("features", [])
    if len(features) != requested_count:
        raise ArcGISServiceError(
            f"Layer {layer_id} page at offset {page_offset} returned "
            f"{len(features)} of {requested_count} requested features."
        )
    return features, {
        "features_total": expected_count,
        "page_offset": page_offset,
        "page_size": requested_count,
    }


def fetch_features(
    layer_id: int,
    metadata: dict[str, Any],
    envelope: dict[str, Any],
    out_fields: str,
    service_url: str = SERVICE_URL,
) -> list[dict[str, Any]]:
    """Download every feature intersecting the Northern Territory extent.

    ArcGIS services commonly cap a response at 2,000 records.  ``resultOffset``
    pagination and a count check prevent silent truncation if a study area grows.
    """
    expected_count = query_feature_count(layer_id, envelope, service_url)
    if expected_count == 0:
        return []

    page_size = layer_page_limit(layer_id, metadata)
    object_id_field = metadata.get("objectIdField") or "OBJECTID"
    features: list[dict[str, Any]] = []
    offset = 0

    while len(features) < expected_count:
        params = envelope_query_parameters(envelope)
        params.update(
            {
                "f": "json",
                "outFields": out_fields,
                "returnGeometry": "true",
                "returnZ": "false",
                "returnM": "false",
                "resultOffset": str(offset),
                "resultRecordCount": str(min(page_size, expected_count - len(features))),
                "orderByFields": object_id_field,
            }
        )
        response = get_json(f"{layer_url(layer_id, service_url)}/query", params)
        page = response.get("features", [])
        if not page:
            raise ArcGISServiceError(
                f"Layer {layer_id} returned {len(features)} of {expected_count} expected "
                "features while paging. The service may have changed during the query."
            )
        features.extend(page)
        offset += len(page)
        print(f"  Layer {layer_id}: downloaded {len(features):,}/{expected_count:,} features", flush=True)

    # A changing upstream layer can otherwise produce duplicate/missing pages.
    if len(features) != expected_count:
        raise ArcGISServiceError(
            f"Layer {layer_id} returned {len(features)} features; expected {expected_count}."
        )
    return features


def get_features_for_layer(
    layer_id: int,
    expected_geometry_type: str,
    envelope: dict[str, Any],
    out_fields: str,
    service_url: str = SERVICE_URL,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Validate the layer's geometry type, then get its local features."""
    metadata = get_layer_metadata(layer_id, service_url)
    actual_type = metadata.get("geometryType")
    if actual_type != expected_geometry_type:
        raise ArcGISServiceError(
            f"Layer {layer_id} is {actual_type!r}, but this operation requires "
            f"{expected_geometry_type!r}."
        )
    features = fetch_features(layer_id, metadata, envelope, out_fields, service_url)
    layer_summary = {
        "layer_id": layer_id,
        "layer_name": metadata.get("name"),
        "geometry_type": actual_type,
        "features_retrieved": len(features),
    }
    return features, layer_summary


def get_feature_page_for_layer(
    layer_id: int,
    expected_geometry_type: str,
    envelope: dict[str, Any],
    out_fields: str,
    page_offset: int,
    page_size: int | None = None,
    service_url: str = SERVICE_URL,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Validate a layer and return just one page for a resumable run."""
    metadata = get_layer_metadata(layer_id, service_url)
    actual_type = metadata.get("geometryType")
    if actual_type != expected_geometry_type:
        raise ArcGISServiceError(
            f"Layer {layer_id} is {actual_type!r}, but this operation requires "
            f"{expected_geometry_type!r}."
        )
    features, page_summary = query_feature_page(
        layer_id, metadata, envelope, out_fields, page_offset, page_size, service_url
    )
    return features, {
        "layer_id": layer_id,
        "layer_name": metadata.get("name"),
        "geometry_type": actual_type,
        "features_retrieved": len(features),
        **page_summary,
    }


def ring_bounds(ring: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    """Return min-x, max-x, min-y, max-y for an ArcGIS polygon ring."""
    x_values, y_values = zip(*ring)
    return min(x_values), max(x_values), min(y_values), max(y_values)


def prepare_polygons(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn ArcGIS rings into lightweight, bbox-indexed polygons for point tests."""
    prepared: list[dict[str, Any]] = []
    for feature in features:
        geometry = feature.get("geometry") or {}
        rings: list[tuple[tuple[float, float, float, float], list[tuple[float, float]]]] = []
        for raw_ring in geometry.get("rings", []):
            try:
                ring = [(float(point[0]), float(point[1])) for point in raw_ring]
            except (IndexError, TypeError, ValueError):
                continue
            if len(ring) >= 3:
                rings.append((ring_bounds(ring), ring))
        if not rings:
            continue
        min_x = min(bounds[0] for bounds, _ in rings)
        max_x = max(bounds[1] for bounds, _ in rings)
        min_y = min(bounds[2] for bounds, _ in rings)
        max_y = max(bounds[3] for bounds, _ in rings)
        prepared.append({"bounds": (min_x, max_x, min_y, max_y), "rings": rings})
    return prepared


def point_location_in_ring(
    longitude: float,
    latitude: float,
    ring: list[tuple[float, float]],
) -> int:
    """Return 1 inside, -1 outside, or 0 on the boundary of one ring."""
    inside = False
    previous_x, previous_y = ring[-1]
    for current_x, current_y in ring:
        # Boundary points count as covered.  Cross-product arithmetic avoids
        # treating a point exactly on a coverage border as a false negative.
        cross_product = (
            (longitude - previous_x) * (current_y - previous_y)
            - (latitude - previous_y) * (current_x - previous_x)
        )
        if abs(cross_product) <= RING_EPSILON:
            dot_product = (
                (longitude - previous_x) * (longitude - current_x)
                + (latitude - previous_y) * (latitude - current_y)
            )
            if dot_product <= RING_EPSILON:
                return 0

        crosses_ray = (previous_y > latitude) != (current_y > latitude)
        if crosses_ray:
            ray_intersection_x = previous_x + (latitude - previous_y) * (
                current_x - previous_x
            ) / (current_y - previous_y)
            if longitude < ray_intersection_x:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return 1 if inside else -1


def polygon_contains_point(
    polygon: dict[str, Any], longitude: float, latitude: float
) -> bool:
    """Test a point against ArcGIS rings, including holes and multipart polygons."""
    min_x, max_x, min_y, max_y = polygon["bounds"]
    if not (min_x <= longitude <= max_x and min_y <= latitude <= max_y):
        return False

    # ArcGIS uses separate rings for outer boundaries and holes.  Even-odd
    # parity handles both ring orientations as well as multipart polygons.
    inside = False
    for (ring_min_x, ring_max_x, ring_min_y, ring_max_y), ring in polygon["rings"]:
        if not (ring_min_x <= longitude <= ring_max_x and ring_min_y <= latitude <= ring_max_y):
            continue
        location = point_location_in_ring(longitude, latitude, ring)
        if location == 0:
            return True
        if location == 1:
            inside = not inside
    return inside


def add_coverage_match(
    data: pd.DataFrame,
    valid_rows: pd.Series,
    latitude: str,
    longitude: str,
    polygons: list[dict[str, Any]],
    output_column: str,
) -> None:
    """Set a ``Yes``/``No`` coverage column using the downloaded polygons."""
    data[output_column] = pd.Series(pd.NA, index=data.index, dtype="string")
    valid_indices = data.index[valid_rows]
    matches: list[str] = []

    for number, index in enumerate(valid_indices, start=1):
        lon = float(data.at[index, longitude])
        lat = float(data.at[index, latitude])
        covered = any(polygon_contains_point(polygon, lon, lat) for polygon in polygons)
        matches.append("Yes" if covered else "No")
        if number % 100 == 0 or number == len(valid_indices):
            print(f"  {output_column}: matched {number:,}/{len(valid_indices):,} communities", flush=True)

    data.loc[valid_indices, output_column] = matches


def add_coverage_page_match(
    data: pd.DataFrame,
    valid_rows: pd.Series,
    latitude: str,
    longitude: str,
    polygons: list[dict[str, Any]],
    output_column: str,
) -> None:
    """Merge one polygon page into an existing Yes/No coverage column.

    A community starts as ``No`` and is permanently promoted to ``Yes`` if any
    downloaded page contains it.  After the final page, the column is the same
    result as a full point-in-polygon match.
    """
    if output_column not in data:
        data[output_column] = pd.Series(pd.NA, index=data.index, dtype="string")
    data.loc[valid_rows & data[output_column].isna(), output_column] = "No"
    valid_indices = data.index[valid_rows]
    updates = 0
    for index in valid_indices:
        if data.at[index, output_column] == "Yes":
            continue
        lon = float(data.at[index, longitude])
        lat = float(data.at[index, latitude])
        if any(polygon_contains_point(polygon, lon, lat) for polygon in polygons):
            data.at[index, output_column] = "Yes"
            updates += 1
    print(f"  {output_column}: {updates:,} new Yes matches in this page", flush=True)


def add_any_network_outdoor_coverage(data: pd.DataFrame, valid_rows: pd.Series) -> None:
    """Add the union of the four provider-specific total-outdoor results."""
    if not set(PROVIDER_OUTDOOR_COLUMNS).issubset(data.columns):
        return
    output_column = "mobile_outdoor_coverage_any_network"
    data[output_column] = pd.Series(pd.NA, index=data.index, dtype="string")
    provider_matches = data.loc[valid_rows, list(PROVIDER_OUTDOOR_COLUMNS)]
    data.loc[valid_rows, output_column] = np.where(
        provider_matches.eq("Yes").any(axis=1), "Yes", "No"
    )


def technology_present(attributes: dict[str, Any], technology_fields: tuple[str, ...]) -> str:
    """Return Yes when a mobile-site record contains any usable LTE/NR band."""
    no_values = {"", "0", "false", "n", "no", "none", "null", "nan", "n/a"}
    for field in technology_fields:
        value = attributes.get(field)
        if value is not None and str(value).strip().casefold() not in no_values:
            return "Yes"
    return "No"


def prepare_mobile_sites(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep valid points and the useful identifiers from the mobile-sites layer."""
    sites: list[dict[str, Any]] = []
    for feature in features:
        attributes = feature.get("attributes") or {}
        geometry = feature.get("geometry") or {}
        try:
            longitude = float(geometry.get("x", attributes.get("Longitude")))
            latitude = float(geometry.get("y", attributes.get("Latitude")))
        except (TypeError, ValueError):
            continue
        if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            continue
        sites.append(
            {
                "longitude": longitude,
                "latitude": latitude,
                "objectid": attributes.get("OBJECTID"),
                "rfnsa_id": attributes.get("RFNSA_ID"),
                "mno": attributes.get("MNO"),
                "year": attributes.get("Year"),
                "has_4g": technology_present(attributes, LTE_FIELDS),
                "has_5g": technology_present(attributes, NR_FIELDS),
            }
        )
    return sites


def add_nearest_mobile_site(
    data: pd.DataFrame,
    valid_rows: pd.Series,
    latitude: str,
    longitude: str,
    sites: list[dict[str, Any]],
) -> None:
    """Add nearest-site fields using Haversine great-circle distance in kilometres."""
    if not sites:
        raise ArcGISServiceError("No valid mobile-site coordinates were returned by layer 1.")

    for column in MOBILE_SITE_OUTPUT_COLUMNS:
        data[column] = pd.NA

    site_latitude = np.radians(np.array([site["latitude"] for site in sites], dtype=float))
    site_longitude = np.radians(np.array([site["longitude"] for site in sites], dtype=float))
    valid = data.loc[valid_rows]
    community_latitude = np.radians(valid[latitude].to_numpy(dtype=float))
    community_longitude = np.radians(valid[longitude].to_numpy(dtype=float))

    # There are only the communities and sites that intersect the study extent,
    # so this vectorised matrix is small and avoids hundreds of HTTP requests.
    delta_latitude = site_latitude[None, :] - community_latitude[:, None]
    delta_longitude = site_longitude[None, :] - community_longitude[:, None]
    haversine_a = (
        np.sin(delta_latitude / 2) ** 2
        + np.cos(community_latitude[:, None])
        * np.cos(site_latitude[None, :])
        * np.sin(delta_longitude / 2) ** 2
    )
    distances_km = EARTH_RADIUS_KM * 2 * np.arctan2(
        np.sqrt(haversine_a), np.sqrt(1 - haversine_a)
    )
    nearest_positions = np.argmin(distances_km, axis=1)
    nearest_distance = distances_km[np.arange(len(valid)), nearest_positions]
    nearest_sites = [sites[position] for position in nearest_positions]

    valid_indices = data.index[valid_rows]
    data.loc[valid_indices, "nearest_mobile_site_distance_km"] = np.round(nearest_distance, 2)
    data.loc[valid_indices, "nearest_mobile_site_objectid"] = [
        site["objectid"] for site in nearest_sites
    ]
    data.loc[valid_indices, "nearest_mobile_site_rfnsa_id"] = [
        site["rfnsa_id"] for site in nearest_sites
    ]
    data.loc[valid_indices, "nearest_mobile_site_mno"] = [site["mno"] for site in nearest_sites]
    data.loc[valid_indices, "nearest_mobile_site_year"] = [site["year"] for site in nearest_sites]
    data.loc[valid_indices, "nearest_mobile_site_latitude"] = [
        site["latitude"] for site in nearest_sites
    ]
    data.loc[valid_indices, "nearest_mobile_site_longitude"] = [
        site["longitude"] for site in nearest_sites
    ]
    data.loc[valid_indices, "nearest_mobile_site_has_4g"] = [
        site["has_4g"] for site in nearest_sites
    ]
    data.loc[valid_indices, "nearest_mobile_site_has_5g"] = [
        site["has_5g"] for site in nearest_sites
    ]


def default_input_path() -> Path:
    """Prefer the master table beside this script, then the legacy outputs copy."""
    direct_path = PROJECT_DIR / "community_connectivity_master_table.csv"
    outputs_path = PROJECT_DIR / "outputs" / "community_connectivity_master_table.csv"
    if direct_path.is_file():
        return direct_path
    if outputs_path.is_file():
        return outputs_path
    return direct_path


def write_report(
    report_path: Path,
    input_path: Path,
    output_path: Path,
    data: pd.DataFrame,
    valid_rows: pd.Series,
    coverage_layers: list[dict[str, Any]],
    sites_layer: dict[str, Any],
    nbn_coverage_layers: list[dict[str, Any]],
) -> None:
    """Write a concise, auditable summary of sources and matching results."""
    coverage_counts = {
        spec.output_column: int((data[spec.output_column] == "Yes").sum())
        for spec in COVERAGE_LAYERS
        if spec.output_column in data.columns
    }
    nbn_coverage_counts = {
        spec.output_column: int((data[spec.output_column] == "Yes").sum())
        for spec in NBN_COVERAGE_LAYERS
        if spec.output_column in data.columns
    }
    report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "input_file": str(input_path),
        "output_file": str(output_path),
        "source_service": SERVICE_URL,
        "method": {
            "polygon_layers": "Point-in-polygon match; boundary points count as covered.",
            "mobile_sites_layer": "Nearest point calculated with Haversine great-circle distance in kilometres.",
            "coordinate_system": "EPSG:4326 longitude/latitude.",
        },
        "community_rows": int(len(data)),
        "communities_with_valid_coordinates": int(valid_rows.sum()),
        "communities_with_invalid_or_missing_coordinates": int((~valid_rows).sum()),
        "coverage_yes_counts": coverage_counts,
        "coverage_layers": coverage_layers,
        "mobile_sites_layer": sites_layer,
        "nbn_coverage_yes_counts": nbn_coverage_counts,
        "nbn_coverage_layers": nbn_coverage_layers,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv_atomically(data: pd.DataFrame, output_path: Path) -> None:
    """Write a complete replacement before changing the master CSV in place."""
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    try:
        data.to_csv(temporary_path, index=False, encoding="utf-8")
        os.replace(temporary_path, output_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Match communities to ACCC mobile coverage and nearest mobile sites."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=default_input_path(),
        help="Source community connectivity master CSV.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Destination CSV. Default: <input stem>_mobile_coverage.csv beside the input.",
    )
    parser.add_argument(
        "--update-master",
        action="store_true",
        help="Replace the input master CSV safely after all mobile fields are matched.",
    )
    parser.add_argument(
        "--layer-id",
        type=int,
        default=None,
        help="Update one coverage layer only; useful when resuming a slow service layer.",
    )
    parser.add_argument(
        "--page-offset",
        type=int,
        default=None,
        help="Start offset for one resumable coverage page; requires --layer-id.",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=None,
        help="Maximum features in that one page; requires --page-offset.",
    )
    parser.add_argument(
        "--sites-only",
        action="store_true",
        help="Update only nearest ACCC mobile-site and tower 4G/5G fields.",
    )
    parser.add_argument(
        "--nbn-only",
        action="store_true",
        help="Update only NBN Fixed Wireless and Fixed Line coverage fields.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_arguments()
    if args.sites_only and (args.layer_id is not None or args.page_offset is not None):
        raise ValueError("--sites-only cannot be combined with --layer-id or --page-offset.")
    if args.nbn_only and (args.sites_only or args.layer_id is not None):
        raise ValueError("--nbn-only cannot be combined with mobile-only options.")
    if args.page_offset is not None and args.layer_id is None:
        raise ValueError("--page-offset requires --layer-id.")
    if args.page_size is not None and args.page_offset is None:
        raise ValueError("--page-size requires --page-offset.")
    input_path: Path = args.input
    if not input_path.is_file():
        raise FileNotFoundError(
            f"Master table not found: {input_path}. Use --input to provide its CSV path."
        )
    output_path: Path = (
        input_path
        if args.update_master
        else args.output or input_path.with_name(f"{input_path.stem}_mobile_coverage.csv")
    )
    if input_path.resolve() == output_path.resolve() and not args.update_master:
        raise ValueError("Use --update-master to replace the source master table.")

    print(f"Reading {input_path}")
    data = pd.read_csv(input_path, encoding="utf-8-sig", low_memory=False)
    latitude, longitude = detect_coordinate_columns(data)
    valid_rows = valid_coordinate_mask(data, latitude, longitude)
    if not valid_rows.any():
        raise ValueError("The master table contains no valid community coordinates.")
    envelope = NT_QUERY_ENVELOPE
    print(
        f"Matching {int(valid_rows.sum()):,}/{len(data):,} communities using the NT extent "
        f"({envelope['xmin']:.5f}, {envelope['ymin']:.5f}) to "
        f"({envelope['xmax']:.5f}, {envelope['ymax']:.5f})"
    )

    coverage_layer_summaries: list[dict[str, Any]] = []
    nbn_layer_summaries: list[dict[str, Any]] = []
    sites_summary: dict[str, Any] = {"not_updated_in_this_run": True}
    layer_by_id = {spec.layer_id: spec for spec in COVERAGE_LAYERS}

    if args.nbn_only:
        selected_layers = ()
    elif args.layer_id is not None:
        if args.layer_id not in layer_by_id:
            valid_ids = ", ".join(map(str, layer_by_id))
            raise ValueError(f"Unknown coverage layer {args.layer_id}. Choose one of: {valid_ids}.")
        selected_layers = (layer_by_id[args.layer_id],)
    elif args.sites_only:
        selected_layers = ()
    else:
        selected_layers = COVERAGE_LAYERS

    for spec in selected_layers:
        print(f"Downloading {spec.label} (layer {spec.layer_id})")
        if args.page_offset is None:
            features, summary = get_features_for_layer(
                spec.layer_id,
                "esriGeometryPolygon",
                envelope,
                "OBJECTID",
                spec.service_url,
            )
            polygons = prepare_polygons(features)
            add_coverage_match(
                data, valid_rows, latitude, longitude, polygons, spec.output_column
            )
        else:
            features, summary = get_feature_page_for_layer(
                spec.layer_id,
                "esriGeometryPolygon",
                envelope,
                "OBJECTID",
                args.page_offset,
                args.page_size,
                spec.service_url,
            )
            polygons = prepare_polygons(features)
            add_coverage_page_match(
                data, valid_rows, latitude, longitude, polygons, spec.output_column
            )
        summary["valid_polygons_prepared"] = len(polygons)
        coverage_layer_summaries.append(summary)

    add_any_network_outdoor_coverage(data, valid_rows)

    if args.layer_id is None and not args.nbn_only:
        print(f"Downloading all mobile sites (layer {MOBILE_SITES_LAYER_ID})")
        site_features, sites_summary = get_features_for_layer(
            MOBILE_SITES_LAYER_ID,
            "esriGeometryPoint",
            envelope,
            "OBJECTID,Year,MNO,RFNSA_ID,Latitude,Longitude,"
            + ",".join((*LTE_FIELDS, *NR_FIELDS)),
        )
        mobile_sites = prepare_mobile_sites(site_features)
        sites_summary["valid_sites_prepared"] = len(mobile_sites)
        add_nearest_mobile_site(data, valid_rows, latitude, longitude, mobile_sites)

    if args.layer_id is None and not args.sites_only:
        for spec in NBN_COVERAGE_LAYERS:
            print(f"Downloading {spec.label} (layer {spec.layer_id})")
            features, summary = get_features_for_layer(
                spec.layer_id,
                "esriGeometryPolygon",
                envelope,
                "OBJECTID",
                spec.service_url,
            )
            polygons = prepare_polygons(features)
            summary["valid_polygons_prepared"] = len(polygons)
            add_coverage_match(
                data, valid_rows, latitude, longitude, polygons, spec.output_column
            )
            nbn_layer_summaries.append(summary)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_csv_atomically(data, output_path)
    report_path = output_path.with_name(f"{output_path.stem}_report.json")
    write_report(
        report_path,
        input_path,
        output_path,
        data,
        valid_rows,
        coverage_layer_summaries,
        sites_summary,
        nbn_layer_summaries,
    )
    print(f"\nDone. Matched table: {output_path}")
    print(f"Data-quality report: {report_path}")


if __name__ == "__main__":
    main()
