"use strict";
const $ = (id) => document.getElementById(id),
  fmt = (n) => Number(n).toLocaleString("en-AU"),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const layers = [
  ["mobile_outdoor_coverage_any_network", "Any mobile network"],
  ["mobile_4g_outdoor_coverage_any_network", "4G · any network"],
  ["mobile_5g_outdoor_coverage_any_network", "5G · any network"],
  ["mobile_outdoor_coverage_telstra", "Telstra"],
  ["mobile_outdoor_coverage_optus", "Optus"],
  ["mobile_outdoor_coverage_tpg", "TPG"],
  ["mobile_outdoor_coverage_tpg_on_optus", "TPG on Optus"],
  ["nbn_fixed_wireless_coverage", "NBN fixed wireless"],
  ["nbn_fixed_line_coverage", "NBN fixed line"],
];
let data = [],
  filtered = [],
  page = 0;
const size = 15;
$("layer").innerHTML = layers
  .map(([k, v]) => `<option value="${k}">${v}</option>`)
  .join("");
const selectedLayer = () => layers.find((x) => x[0] === $("layer").value)[1];
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) + "%" : "—");
function apply() {
  page = 0;
  const q = $("search").value.trim().toLowerCase(),
    t = $("type").value,
    s = $("status").value,
    l = $("layer").value;
  filtered = data.filter(
    (r) =>
      (!q || r.community_name.toLowerCase().includes(q)) &&
      (t === "all" || r.community_type === t) &&
      (s === "all" || r[l] === s),
  );
  render();
}
function render() {
  const n = filtered.length,
    l = $("layer").value,
    covered = filtered.filter((r) => r[l] === "Yes").length,
    known = filtered.filter((r) => r.population_final !== ""),
    population = known.reduce((a, r) => a + Number(r.population_final), 0);
  const ds = filtered
    .map((r) => +r.nearest_mobile_site_distance_km)
    .sort((a, b) => a - b);
  const median = n
    ? (ds[Math.floor((n - 1) / 2)] + ds[Math.floor(n / 2)]) / 2
    : null;
  $("metrics").innerHTML =
    `<div class="metric"><small>Communities in view</small><strong>${fmt(n)}</strong><p>of ${fmt(data.length)} source records</p></div><div class="metric"><small>Covered · selected layer</small><strong>${pct(covered, n)}</strong><p>${fmt(covered)} covered / ${fmt(n - covered)} not covered</p></div><div class="metric"><small>Known population</small><strong>${fmt(population)}</strong><p>${fmt(known.length)} of ${fmt(n)} records have population</p></div><div class="metric"><small>Median mobile site distance</small><strong>${median === null ? "—" : median.toFixed(1)}<span style="font-size:17px">${median === null ? "" : " km"}</span></strong><p>Among filtered communities</p></div>`;
  $("population-note").textContent =
    `Population is missing for ${fmt(n - known.length)} of the ${fmt(n)} communities in view. Population totals exclude missing values; coverage percentages count communities equally.`;
  $("map-count").textContent = `${fmt(n)} communities`;
  $("bars").innerHTML = [layers[3], layers[4], layers[5], layers[6], layers[2]]
    .map(([key, label]) => {
      const count = filtered.filter((r) => r[key] === "Yes").length;
      return `<div class="bar-row"><div class="bar-label"><span>${label}</span><b>${pct(count, n)} <span style="color:var(--muted);font-weight:400"> / ${count}</span></b></div><div class="bar-track"><div class="bar-fill" style="width:${n ? (100 * count) / n : 0}%"></div></div></div>`;
    })
    .join("");
  const limits = [0, 5, 10, 25, 50, 100, Infinity],
    labels = ["0–<5", "5–<10", "10–<25", "25–<50", "50–<100", "100+"],
    counts = labels.map(
      (_, i) => ds.filter((x) => x >= limits[i] && x < limits[i + 1]).length,
    ),
    max = Math.max(...counts, 1);
  $("histogram").innerHTML = counts
    .map(
      (c, i) =>
        `<div class="bin" title="${labels[i]} km: ${c} communities"><b>${c}</b><div class="column" style="height:${(c / max) * 120}px"></div><span>${labels[i]}</span></div>`,
    )
    .join("");
  drawMap();
  renderTable();
}
function drawMap() {
  const svg = $("map"),
    w = 670,
    h = 420;
  const lons = data.map((r) => +r.community_longitude),
    lats = data.map((r) => +r.community_latitude);
  const minX = Math.floor(Math.min(...lons)),
    maxX = Math.ceil(Math.max(...lons)),
    minY = Math.floor(Math.min(...lats)),
    maxY = Math.ceil(Math.max(...lats));
  const mid = (minY + maxY) / 2,
    cos = Math.cos((mid * Math.PI) / 180),
    scale = Math.min(560 / ((maxX - minX) * cos), 335 / (maxY - minY));
  const plotW = (maxX - minX) * cos * scale,
    plotH = (maxY - minY) * scale,
    left = (w - plotW) / 2,
    top = (h - plotH) / 2;
  const x = (v) => left + (v - minX) * cos * scale,
    y = (v) => top + (maxY - v) * scale;
  let out = "";
  for (let lon = minX; lon <= maxX; lon += 2) {
    out += `<line x1="${x(lon)}" y1="${top}" x2="${x(lon)}" y2="${top + plotH}" stroke="#dce7ec"/><text x="${x(lon)}" y="${top + plotH + 23}" text-anchor="middle">${lon}°E</text>`;
  }
  for (let lat = minY; lat <= maxY; lat += 2) {
    out += `<line x1="${left}" y1="${y(lat)}" x2="${left + plotW}" y2="${y(lat)}" stroke="#dce7ec"/><text x="${left - 12}" y="${y(lat) + 4}" text-anchor="end">${-lat}°S</text>`;
  }
  out += `<text x="620" y="30" text-anchor="middle">N ↑</text>`;
  for (const r of filtered) {
    out += `<circle cx="${x(+r.community_longitude)}" cy="${y(+r.community_latitude)}" r="3.6" fill="${r[$("layer").value] === "Yes" ? "#087c69" : "#d17631"}" fill-opacity=".8" stroke="white" stroke-width=".6" data-id="${r.community_id}"><title>${esc(r.community_name)} · ${r[$("layer").value] === "Yes" ? "Covered" : "Not covered"}</title></circle>`;
  }
  if (!filtered.length)
    out +=
      '<text x="335" y="210" text-anchor="middle">No communities match these filters</text>';
  svg.innerHTML = out;
}
function renderTable() {
  const sort = $("sort").value;
  filtered.sort((a, b) =>
    sort === "distance"
      ? +b.nearest_mobile_site_distance_km - +a.nearest_mobile_site_distance_km
      : sort === "population"
        ? (b.population_final === "" ? -1 : +b.population_final) -
          (a.population_final === "" ? -1 : +a.population_final)
        : a.community_name.localeCompare(b.community_name),
  );
  const rows = filtered.slice(page * size, (page + 1) * size);
  $("coverage-heading").textContent = selectedLayer();
  $("rows").innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><td><button data-id="${r.community_id}">${esc(r.community_name)}</button></td><td>${esc(r.community_type)}</td><td>${r.population_final === "" ? "Unknown" : fmt(r.population_final)}</td><td>${badge(r[$("layer").value])}</td><td>${(+r.nearest_mobile_site_distance_km).toFixed(1)} km</td><td>${(+r.distance_community_to_wifi_km).toFixed(1)} km</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6" class="empty">No communities match these filters. Try resetting your selection.</td></tr>';
  $("page-label").textContent = filtered.length
    ? `${page * size + 1}–${Math.min((page + 1) * size, filtered.length)} of ${fmt(filtered.length)} communities`
    : "0 communities";
  $("prev").disabled = page === 0;
  $("next").disabled = (page + 1) * size >= filtered.length;
}
function badge(v) {
  return `<span class="badge ${v === "Yes" ? "" : "uncovered"}">${v === "Yes" ? "Covered" : "Not covered"}</span>`;
}
function showDetail(id) {
  const r = data.find((r) => r.community_id === id);
  if (!r) return;
  const line = (k, v) =>
    `<div class="detail-line"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  $("detail-name").textContent = r.community_name;
  $("detail-type").textContent =
    `${r.community_type} · Community ID ${r.community_id}`;
  $("detail-content").innerHTML =
    `<div class="detail-grid"><div><small>Population</small><b>${r.population_final === "" ? "Unknown" : fmt(r.population_final)}</b></div><div><small>Nearest mobile site</small><b>${r.nearest_mobile_site_distance_km} km</b></div><div><small>Nearest Wi-Fi</small><b>${r.distance_community_to_wifi_km} km</b></div><div><small>Coordinates</small><b>${(+r.community_latitude).toFixed(4)}, ${(+r.community_longitude).toFixed(4)}</b></div></div><section class="detail-section"><h3>Coverage at this community</h3>${layers.map(([k, v]) => `<div class="detail-line"><span>${v}</span>${badge(r[k])}</div>`).join("")}</section><section class="detail-section"><h3>Nearest mobile site</h3>${line("Operator", r.nearest_mobile_site_mno)}${line("RFNSA ID", r.nearest_mobile_site_rfnsa_id)}${line("Site record year", r.nearest_mobile_site_year)}${line("4G / 5G at site", r.nearest_mobile_site_has_4g + " / " + r.nearest_mobile_site_has_5g)}<p class="footnote">Site capabilities do not imply coverage at the community.</p></section><section class="detail-section"><h3>Other nearby infrastructure</h3>${line("Tower", r.nearest_tower_name)}${line("Tower distance", r.distance_community_to_tower_km + " km")}${line("Wi-Fi address", r.nearest_wifi_address)}${line("Wi-Fi distance", r.distance_community_to_wifi_km + " km")}</section>`;
  $("detail").showModal();
  $("detail").scrollTop = 0;
}
for (const id of ["search", "type", "status", "layer"])
  $(id).addEventListener(id === "search" ? "input" : "change", apply);
$("sort").addEventListener("change", () => {
  page = 0;
  renderTable();
});
$("reset").onclick = () => {
  $("search").value = "";
  $("type").value = "all";
  $("status").value = "all";
  $("layer").selectedIndex = 0;
  $("sort").value = "name";
  apply();
};
$("prev").onclick = () => {
  page--;
  renderTable();
};
$("next").onclick = () => {
  page++;
  renderTable();
};
$("close").onclick = () => $("detail").close();
$("detail").addEventListener("click", (e) => {
  if (e.target === $("detail")) {
    const b = $("detail").getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientX > b.right ||
      e.clientY < b.top ||
      e.clientY > b.bottom
    )
      $("detail").close();
  }
});
for (const id of ["rows"])
  $(id).addEventListener("click", (e) => {
    const t = e.target.closest("[data-id]");
    if (t) showDetail(t.dataset.id);
  });
$("map").addEventListener("pointerover", (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  const r = data.find((x) => x.community_id === id);
  $("tip").textContent =
    `${r.community_name} · ${r[$("layer").value] === "Yes" ? "Covered" : "Not covered"}`;
  $("tip").style.display = "block";
});
$("map").addEventListener("pointerout", () => {
  $("tip").style.display = "none";
});
$("download").onclick = () => {
  if (!data.length) return;
  const keys = Object.keys(data[0]),
    quote = (v) => '"' + String(v).replace(/"/g, '""') + '"',
    csv = [
      keys.map(quote).join(","),
      ...filtered.map((r) => keys.map((k) => quote(r[k])).join(",")),
    ].join("\r\n");
  const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "community-connectivity-filtered.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
fetch("data.json")
  .then((r) => {
    if (!r.ok) throw Error("Data unavailable");
    return r.json();
  })
  .then((r) => {
    data = r;
    $("type").innerHTML += [...new Set(r.map((x) => x.community_type))]
      .sort()
      .map((t) => `<option>${esc(t)}</option>`)
      .join("");
    $("loading").hidden = true;
    $("dashboard").hidden = false;
    apply();
    registerTools();
  })
  .catch(() => {
    $("loading").textContent =
      "The dataset could not be loaded. Refresh the page to try again.";
    $("download").disabled = true;
  });
function registerTools() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  try {
    Promise.resolve(
      document.modelContext.registerTool(
        {
          name: "filter_communities",
          title: "Filter communities",
          description:
            "Set the community name, type, coverage layer and coverage status filters, and return a summary of the visible selection.",
          inputSchema: {
            type: "object",
            properties: {
              search: { type: "string" },
              type: {
                type: "string",
                enum: ["all", ...new Set(data.map((x) => x.community_type))],
              },
              layer: { type: "string", enum: layers.map((x) => x[0]) },
              status: { type: "string", enum: ["all", "Yes", "No"] },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (!input || typeof input !== "object" || Array.isArray(input))
              throw Error("Expected filter object");
            for (const [k, v] of Object.entries(input)) {
              if (
                !["search", "type", "layer", "status"].includes(k) ||
                typeof v !== "string"
              )
                throw Error("Invalid filter");
              if (
                k !== "search" &&
                ![...$(k).options].some((o) => o.value === v)
              )
                throw Error("Invalid filter option");
            }
            for (const [k, v] of Object.entries(input)) $(k).value = v;
            apply();
            return {
              count: filtered.length,
              covered: filtered.filter((r) => r[$("layer").value] === "Yes")
                .length,
              layer: selectedLayer(),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {}
}

// Keep the view independent of data filters so exploration stays in place.
const mapView = { x: 0, y: 0, zoom: 1 },
  mapPointers = new Map();
let mapGesture = null;
function updateMapView() {
  const z = mapView.zoom;
  mapView.x = Math.max(0, Math.min(670 - 670 / z, mapView.x));
  mapView.y = Math.max(0, Math.min(420 - 420 / z, mapView.y));
  $("map").setAttribute(
    "viewBox",
    `${mapView.x} ${mapView.y} ${670 / z} ${420 / z}`,
  );
  $("map").style.setProperty("--point-radius", 3.6 / Math.sqrt(z));
  $("map").style.setProperty("--point-hover", 6 / Math.sqrt(z));
  $("map").style.setProperty("--point-stroke", 2 / z);
  $("zoom-level").textContent = `${Number(z.toFixed(1))}×`;
  $("zoom-in").disabled = z >= 20;
  $("zoom-out").disabled = z <= 1;
}
function mapPoint(clientX, clientY) {
  return new DOMPoint(clientX, clientY).matrixTransform(
    $("map").getScreenCTM().inverse(),
  );
}
function zoomMap(
  factor,
  anchor = {
    x: mapView.x + 335 / mapView.zoom,
    y: mapView.y + 210 / mapView.zoom,
  },
) {
  const old = mapView.zoom,
    next = Math.max(1, Math.min(20, old * factor));
  mapView.x = anchor.x - ((anchor.x - mapView.x) * old) / next;
  mapView.y = anchor.y - ((anchor.y - mapView.y) * old) / next;
  mapView.zoom = next;
  updateMapView();
}
function resetMap() {
  mapView.x = 0;
  mapView.y = 0;
  mapView.zoom = 1;
  updateMapView();
}
$("zoom-in").onclick = () => zoomMap(1.5);
$("zoom-out").onclick = () => zoomMap(1 / 1.5);
$("zoom-reset").onclick = resetMap;
$("map").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const delta =
      e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 420 : 1);
    zoomMap(
      Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.003),
      mapPoint(e.clientX, e.clientY),
    );
    $("tip").style.display = "none";
  },
  { passive: false },
);
$("map").addEventListener("keydown", (e) => {
  const step = 45 / mapView.zoom;
  switch (e.key) {
    case "+":
    case "=":
      zoomMap(1.5);
      break;
    case "-":
    case "_":
      zoomMap(1 / 1.5);
      break;
    case "Home":
    case "0":
      resetMap();
      break;
    case "ArrowLeft":
      mapView.x -= step;
      updateMapView();
      break;
    case "ArrowRight":
      mapView.x += step;
      updateMapView();
      break;
    case "ArrowUp":
      mapView.y -= step;
      updateMapView();
      break;
    case "ArrowDown":
      mapView.y += step;
      updateMapView();
      break;
    default:
      return;
  }
  e.preventDefault();
});
function pointerGeometry() {
  const p = [...mapPointers.values()];
  return p.length > 1
    ? {
        x: (p[0].x + p[1].x) / 2,
        y: (p[0].y + p[1].y) / 2,
        distance: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
      }
    : { ...p[0], distance: 0 };
}
$("map").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  $("map").setPointerCapture(e.pointerId);
  if (mapPointers.size === 1) {
    mapGesture = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      id: e.target.closest("[data-id]")?.dataset.id,
    };
  } else {
    mapGesture.moved = true;
  }
  mapGesture.previous = pointerGeometry();
});
$("map").addEventListener("pointermove", (e) => {
  if (!mapPointers.has(e.pointerId) || !mapGesture) return;
  mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const current = pointerGeometry();
  if (
    Math.hypot(e.clientX - mapGesture.startX, e.clientY - mapGesture.startY) > 5
  )
    mapGesture.moved = true;
  if (mapGesture.moved) {
    const previous = mapGesture.previous,
      anchor = mapPoint(previous.x, previous.y);
    if (previous.distance > 0 && current.distance > 0)
      zoomMap(current.distance / previous.distance, anchor);
    const next = mapPoint(current.x, current.y);
    mapView.x += anchor.x - next.x;
    mapView.y += anchor.y - next.y;
    updateMapView();
    $("map").classList.add("dragging");
    $("tip").style.display = "none";
  }
  mapGesture.previous = current;
});
function endMapPointer(e) {
  if (!mapPointers.has(e.pointerId)) return;
  const chosen =
    e.type === "pointerup" && mapPointers.size === 1 && !mapGesture.moved
      ? mapGesture.id
      : null;
  mapPointers.delete(e.pointerId);
  if ($("map").hasPointerCapture(e.pointerId))
    $("map").releasePointerCapture(e.pointerId);
  if (mapPointers.size) {
    mapGesture.moved = true;
    mapGesture.previous = pointerGeometry();
  } else {
    mapGesture = null;
    $("map").classList.remove("dragging");
  }
  if (chosen) showDetail(chosen);
}
$("map").addEventListener("pointerup", endMapPointer);
$("map").addEventListener("pointercancel", endMapPointer);
$("map").addEventListener("lostpointercapture", endMapPointer);
updateMapView();
