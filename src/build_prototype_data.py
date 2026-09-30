"""Build the offline Northern Territory Investment Layer dataset.

The script joins the canonical community connectivity table with BushTel region
metadata and the existing connectivity-priority ranking. It can optionally
download the Bureau of Meteorology historical cyclone track database and derive
community-level proximity indicators.

All scores are screening indicators. They are not engineering feasibility,
service reliability, cost, consent, or investment recommendations.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
COMMUNITIES_CSV = ROOT / "Result" / "remote_community_connectivity_data.csv"
RANKING_CSV = ROOT / "Result" / "ranking1_connectivity_priority.csv"
BUSHTEL_CSV = ROOT / "Raw_Data" / "bushtel_communities_2024.csv"
CYCLONE_CACHE = ROOT / ".cache" / "bom_cyclone_tracks.csv"
OUTPUT_JS = ROOT / "prototype" / "data" / "communities.js"

CYCLONE_URL = "https://www.bom.gov.au/clim_data/IDCKMSTM0S.csv"
OFFICIAL_MAP_URL = (
    "https://spatial.infrastructure.gov.au/portal/apps/experiencebuilder/"
    "experience/?id=81c5ae65fbf74ce3a89cf25b1f323d50&page=Page"
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def number(value: Any) -> float | None:
    text = clean(value)
    if not text:
        return None
    try:
        result = float(text)
    except ValueError:
        return None
    return result if math.isfinite(result) else None


def integer(value: Any) -> int | None:
    parsed = number(value)
    return None if parsed is None else int(round(parsed))


def yes_no(value: Any) -> bool | None:
    text = clean(value).lower()
    if text == "yes":
        return True
    if text == "no":
        return False
    return None


def cap_inverse(distance: float | None, cap: float) -> float | None:
    if distance is None:
        return None
    return max(0.0, 1.0 - min(distance, cap) / cap) * 100.0


def weighted_mean(items: Iterable[tuple[float | None, float]]) -> float | None:
    numerator = 0.0
    denominator = 0.0
    for value, weight in items:
        if value is None:
            continue
        numerator += value * weight
        denominator += weight
    return None if denominator == 0 else numerator / denominator


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def download_cyclones(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Bureau of Meteorology cyclone tracks to {destination}")
    request = urllib.request.Request(
        CYCLONE_URL,
        headers={"User-Agent": "NT-Investment-Layer-Prototype/1.0"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        destination.write_bytes(response.read())


def read_cyclone_tracks(path: Path) -> tuple[list[dict[str, Any]], str | None]:
    if not path.exists():
        return [], None

    generated_on: str | None = None
    tracks: list[dict[str, Any]] = []

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        copyright_line = handle.readline()
        generated_line = handle.readline().strip()
        if generated_line.lower().startswith("generated on:"):
            generated_on = generated_line.split(":", 1)[1].strip()
        handle.readline()
        handle.readline()
        reader = csv.DictReader(handle)
        for row in reader:
            cyclone_type = clean(row.get("TYPE"))
            disturbance_id = clean(row.get("DISTURBANCE_ID"))
            latitude = number(row.get("LAT"))
            longitude = number(row.get("LON"))
            timestamp = clean(row.get("TM"))

            if cyclone_type != "T" or not disturbance_id:
                continue
            if latitude is None or longitude is None:
                continue
            if not (-32 <= latitude <= -5 and 123 <= longitude <= 145):
                continue

            try:
                year = int(timestamp[:4])
            except (TypeError, ValueError):
                continue
            if year < 1970:
                continue

            tracks.append(
                {
                    "id": disturbance_id,
                    "name": clean(row.get("NAME")) or "Unnamed",
                    "year": year,
                    "lat": latitude,
                    "lon": longitude,
                }
            )

    return tracks, generated_on


def cyclone_indicators(
    latitude: float,
    longitude: float,
    track_points: list[dict[str, Any]],
) -> dict[str, Any]:
    within_100: set[str] = set()
    within_200: set[str] = set()
    nearest_distance: float | None = None
    nearest_name: str | None = None
    nearest_year: int | None = None

    for point in track_points:
        distance = haversine_km(latitude, longitude, point["lat"], point["lon"])
        if distance <= 100:
            within_100.add(point["id"])
        if distance <= 200:
            within_200.add(point["id"])
        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance
            nearest_name = point["name"]
            nearest_year = point["year"]

    if nearest_distance is None:
        raw = None
    else:
        proximity = max(0.0, 200.0 - nearest_distance) / 200.0
        raw = len(within_200) + 0.5 * len(within_100) + proximity

    return {
        "cyclones100km": len(within_100) if track_points else None,
        "cyclones200km": len(within_200) if track_points else None,
        "nearestCycloneTrackKm": (
            None if nearest_distance is None else round(nearest_distance, 1)
        ),
        "nearestCycloneName": nearest_name,
        "nearestCycloneYear": nearest_year,
        "cycloneRaw": raw,
    }


def percentile_scores(values: list[float | None]) -> list[float | None]:
    present = sorted(value for value in values if value is not None)
    if not present:
        return [None for _ in values]
    if len(present) == 1:
        return [100.0 if value is not None else None for value in values]

    positions: dict[float, list[int]] = defaultdict(list)
    for index, value in enumerate(present):
        positions[value].append(index)

    scores: dict[float, float] = {}
    denominator = len(present) - 1
    for value, indexes in positions.items():
        mean_index = sum(indexes) / len(indexes)
        scores[value] = 100.0 * mean_index / denominator

    return [None if value is None else scores[value] for value in values]


def assign_relative_tiers(
    rows: list[dict[str, Any]], score_field: str, tier_field: str
) -> None:
    ranked = sorted(
        (row for row in rows if row.get(score_field) is not None),
        key=lambda row: row[score_field],
        reverse=True,
    )
    total = len(ranked)
    for index, row in enumerate(ranked):
        percentile = (index + 1) / total if total else 1
        if percentile <= 0.20:
            tier = "High"
        elif percentile <= 0.50:
            tier = "Medium"
        else:
            tier = "Lower"
        row[tier_field] = tier

    for row in rows:
        if row.get(score_field) is None:
            row[tier_field] = "Unknown"


def rounded(value: float | None, digits: int = 1) -> float | None:
    return None if value is None else round(value, digits)


def build(download_cyclone_data: bool) -> None:
    for required in (COMMUNITIES_CSV, RANKING_CSV, BUSHTEL_CSV):
        if not required.exists():
            raise FileNotFoundError(f"Required source is missing: {required}")

    if download_cyclone_data or not CYCLONE_CACHE.exists():
        try:
            download_cyclones(CYCLONE_CACHE)
        except Exception as error:  # noqa: BLE001 - preserve offline fallback
            print(f"Cyclone download unavailable; resilience remains unassessed: {error}")

    cyclone_points, cyclone_generated_on = read_cyclone_tracks(CYCLONE_CACHE)
    communities = read_csv(COMMUNITIES_CSV)
    rankings = {
        clean(row["community_id"]): row for row in read_csv(RANKING_CSV)
    }
    bushtel = {
        clean(row["community_id"]): row for row in read_csv(BUSHTEL_CSV)
    }

    max_population = max(
        (number(row.get("population_final")) or 0 for row in communities),
        default=1,
    )
    output: list[dict[str, Any]] = []

    for source in communities:
        community_id = clean(source.get("community_id"))
        source_rank = rankings.get(community_id, {})
        source_bushtel = bushtel.get(community_id, {})

        latitude = number(source.get("community_latitude"))
        longitude = number(source.get("community_longitude"))
        if latitude is None or longitude is None:
            continue

        population = integer(source.get("population_final"))
        mobile_site_km = number(source.get("nearest_mobile_site_distance_km"))
        tower_km = number(source.get("distance_community_to_tower_km"))
        wifi_km = number(source.get("distance_community_to_wifi_km"))
        need_score = number(source_rank.get("priority_score"))
        need_score = None if need_score is None else need_score * 100.0

        impact_score = (
            None
            if population is None
            else 100.0 * math.log1p(population) / math.log1p(max_population)
        )
        delivery_score = weighted_mean(
            [
                (cap_inverse(mobile_site_km, 150), 0.45),
                (cap_inverse(tower_km, 150), 0.35),
                (cap_inverse(wifi_km, 300), 0.20),
            ]
        )

        cyclone = cyclone_indicators(latitude, longitude, cyclone_points)
        row = {
            "id": community_id,
            "name": clean(source.get("community_name")),
            "type": clean(source.get("community_type")) or "Unknown",
            "lat": round(latitude, 5),
            "lon": round(longitude, 5),
            "population": population,
            "populationSource": clean(source_bushtel.get("population_source")) or None,
            "region": clean(source_bushtel.get("ntg_region")) or "Unknown",
            "landCouncil": clean(source_bushtel.get("land_council")) or "Not recorded",
            "localCouncil": clean(source_bushtel.get("local_govt_council")) or "Not recorded",
            "mainLanguage": clean(source_bushtel.get("main_language")) or "Not recorded",
            "mobileAny": yes_no(source.get("mobile_outdoor_coverage_any_network")),
            "mobile4g": yes_no(source.get("mobile_4g_outdoor_coverage_any_network")),
            "mobile5g": yes_no(source.get("mobile_5g_outdoor_coverage_any_network")),
            "nbnFixedLine": yes_no(source.get("nbn_fixed_line_coverage")),
            "nbnFixedWireless": yes_no(source.get("nbn_fixed_wireless_coverage")),
            "mobileSiteKm": rounded(mobile_site_km, 2),
            "towerKm": rounded(tower_km, 2),
            "wifiKm": rounded(wifi_km, 2),
            "nearestMobileOperator": clean(source.get("nearest_mobile_site_mno")) or None,
            "nearestMobileYear": integer(source.get("nearest_mobile_site_year")),
            "needRank": integer(source_rank.get("priority_rank")),
            "needScore": rounded(need_score),
            "impactScore": rounded(impact_score),
            "deliveryScore": rounded(delivery_score),
            "dataCompleteness": "High" if population is not None else "Medium",
            "projectOverlap": "Not assessed",
            **cyclone,
        }
        output.append(row)

    cyclone_scores = percentile_scores([row["cycloneRaw"] for row in output])
    for row, cyclone_score in zip(output, cyclone_scores, strict=True):
        row["cycloneScore"] = rounded(cyclone_score)
        row.pop("cycloneRaw", None)
        row["combinedScore"] = rounded(
            weighted_mean(
                [
                    (row["needScore"], 0.50),
                    (row["impactScore"], 0.20),
                    (row["deliveryScore"], 0.15),
                    (row["cycloneScore"], 0.15),
                ]
            )
        )

    assign_relative_tiers(output, "needScore", "needTier")
    assign_relative_tiers(output, "impactScore", "impactTier")
    assign_relative_tiers(output, "deliveryScore", "deliveryTier")
    assign_relative_tiers(output, "cycloneScore", "cycloneTier")
    assign_relative_tiers(output, "combinedScore", "combinedTier")

    region_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in output:
        region_groups[row["region"]].append(row)
    region_centroids = {
        region: {
            "lat": round(sum(row["lat"] for row in rows) / len(rows), 4),
            "lon": round(sum(row["lon"] for row in rows) / len(rows), 4),
            "count": len(rows),
        }
        for region, rows in region_groups.items()
        if region != "Unknown"
    }

    summary = {
        "communityCount": len(output),
        "noMappedMobileAndTerrestrialNbn": sum(
            row["mobileAny"] is False
            and row["nbnFixedLine"] is False
            and row["nbnFixedWireless"] is False
            for row in output
        ),
        "populationUnknown": sum(row["population"] is None for row in output),
        "cycloneDataAvailable": bool(cyclone_points),
        "cycloneTrackPointsUsed": len(cyclone_points),
        "cycloneDataGeneratedOn": cyclone_generated_on,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "officialMapUrl": OFFICIAL_MAP_URL,
        "regionCentroids": region_centroids,
        "methodology": {
            "need": "Existing EWM connectivity priority score from mapped mobile/NBN gaps and infrastructure distances.",
            "impact": "Relative population-based screening indicator using log-scaled known population; unknown remains unknown.",
            "delivery": "Relative proximity indicator using recorded mobile-site, tower and Wi-Fi distances; it is not engineering feasibility or cost.",
            "resilience": "Relative historical cyclone-track exposure since 1970 based on Bureau of Meteorology best-track proximity; it is not a forecast or outage model.",
            "combined": "Prototype weighted screen: need 50%, impact 20%, delivery context 15%, resilience 15%; weights renormalise when a component is unavailable.",
            "tiers": "High = top 20%, Medium = next 30%, Lower = remaining 50% within the selected indicator.",
        },
    }

    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    payload = (
        "/* Generated by src/build_prototype_data.py. Do not edit manually. */\n"
        f"window.CONNECT_NT_META = {json.dumps(summary, ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.CONNECT_NT_DATA = {json.dumps(output, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    OUTPUT_JS.write_text(payload, encoding="utf-8")
    print(f"Wrote {len(output)} communities to {OUTPUT_JS}")
    print(
        "Summary:",
        summary["communityCount"],
        summary["noMappedMobileAndTerrestrialNbn"],
        summary["populationUnknown"],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--download-cyclones",
        action="store_true",
        help="Refresh the BOM cyclone track cache before building.",
    )
    arguments = parser.parse_args()
    build(arguments.download_cyclones)
