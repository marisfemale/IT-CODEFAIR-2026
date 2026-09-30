(() => {
  "use strict";

  const data = Array.isArray(window.CONNECT_NT_DATA) ? window.CONNECT_NT_DATA : [];
  const meta = window.CONNECT_NT_META || {};
  const svgNamespace = "http://www.w3.org/2000/svg";

  const modes = {
    need: {
      label: "Connectivity need",
      score: "needScore",
      tier: "needTier",
      sort: "Sorted by the existing connectivity-need score.",
      caption: "Connectivity need",
      high: "High screening priority",
      medium: "Medium screening priority",
      low: "Lower screening priority",
      unknown: "Need evidence unavailable",
      note: "Combines mapped mobile/NBN gaps and recorded infrastructure distances.",
    },
    impact: {
      label: "Community impact",
      score: "impactScore",
      tier: "impactTier",
      sort: "Sorted by relative known population; unknown remains unknown.",
      caption: "Potential community impact",
      high: "Higher known population",
      medium: "Moderate known population",
      low: "Lower known population",
      unknown: "Population unknown",
      note: "A population-only prototype indicator. Youth and essential-service data are future evidence needs.",
    },
    delivery: {
      label: "Delivery context",
      score: "deliveryScore",
      tier: "deliveryTier",
      sort: "Sorted by proximity to recorded mobile, tower and Wi-Fi infrastructure.",
      caption: "Apparent delivery context",
      high: "More favourable proximity",
      medium: "Moderate proximity",
      low: "Higher apparent distance barrier",
      unknown: "Infrastructure evidence unavailable",
      note: "Proximity is not engineering feasibility, cost or permission to co-locate.",
    },
    resilience: {
      label: "Cyclone resilience",
      score: "cycloneScore",
      tier: "cycloneTier",
      sort: "Sorted by relative historical cyclone-track exposure since 1970.",
      caption: "Historical cyclone exposure",
      high: "Higher historical exposure",
      medium: "Moderate historical exposure",
      low: "Lower historical exposure",
      unknown: "Cyclone evidence unavailable",
      note: "Historical track proximity is not an outage prediction or engineering risk assessment.",
    },
    combined: {
      label: "Combined action priority",
      score: "combinedScore",
      tier: "combinedTier",
      sort: "Sorted by the transparent prototype combination of available indicators.",
      caption: "Combined action priority",
      high: "Higher due-diligence priority",
      medium: "Medium due-diligence priority",
      low: "Lower due-diligence priority",
      unknown: "Evidence incomplete",
      note: "Prototype weights are visible in Methodology and should be validated with stakeholders.",
    },
  };

  const state = {
    screen: "prototype",
    mode: "need",
    view: "map",
    filters: {
      search: "",
      region: "all",
      type: "all",
      population: "all",
      mobile: "all",
      nbn: "all",
      completeness: "all",
      distance: "all",
      tiers: new Set(),
    },
    selectedId: data.find((row) => row.name === "BATTON HILL")?.id || data[0]?.id || null,
    shortlist: new Set(),
    filterCollapsed: false,
    shortlistCollapsed: false,
    legendExpanded: true,
    mapViewBox: { x: 0, y: 0, width: 1000, height: 760 },
    dragging: null,
  };

  const elements = {
    map: document.getElementById("priority-map"),
    mapBase: document.getElementById("map-base"),
    regionLabels: document.getElementById("region-labels"),
    markers: document.getElementById("community-markers"),
    mapContainer: document.getElementById("map-container"),
    tableContainer: document.getElementById("table-container"),
    tableBody: document.getElementById("results-table-body"),
    tableCaption: document.getElementById("table-caption"),
    topList: document.getElementById("top-list"),
    visibleCount: document.getElementById("visible-count"),
    emptyMap: document.getElementById("empty-map-state"),
    filterPanel: document.getElementById("filter-panel"),
    shortlistPanel: document.getElementById("shortlist-panel"),
    openFilters: document.getElementById("open-filters"),
    openShortlist: document.getElementById("open-shortlist"),
    activeFilterSummary: document.getElementById("active-filter-summary"),
    detail: document.getElementById("community-detail"),
    detailName: document.getElementById("detail-name"),
    detailContext: document.getElementById("detail-context"),
    detailBadges: document.getElementById("detail-badges"),
    detailFacts: document.getElementById("detail-facts"),
    detailDrivers: document.getElementById("detail-drivers"),
    detailVerify: document.getElementById("detail-verify"),
    detailShortlist: document.getElementById("detail-shortlist"),
    legendTitle: document.getElementById("legend-title"),
    legendBody: document.getElementById("legend-body"),
    legendHigh: document.getElementById("legend-high"),
    legendMedium: document.getElementById("legend-medium"),
    legendLow: document.getElementById("legend-low"),
    legendUnknown: document.getElementById("legend-unknown"),
    legendNote: document.getElementById("legend-note"),
    sortDescription: document.getElementById("sort-description"),
    compareCount: document.getElementById("compare-count"),
    compareButton: document.getElementById("compare-button"),
    compareContent: document.getElementById("compare-content"),
    compareDialog: document.getElementById("compare-dialog"),
    methodologyDialog: document.getElementById("methodology-dialog"),
    methodologyContent: document.getElementById("methodology-content"),
  };

  const filters = {
    search: document.getElementById("community-search"),
    region: document.getElementById("region-filter"),
    type: document.getElementById("type-filter"),
    population: document.getElementById("population-filter"),
    mobile: document.getElementById("mobile-filter"),
    nbn: document.getElementById("nbn-filter"),
    completeness: document.getElementById("completeness-filter"),
    distance: document.getElementById("distance-filter"),
  };

  const formatNumber = new Intl.NumberFormat("en-AU");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBoolean(value, yes = "Mapped", no = "Not mapped") {
    if (value === true) return yes;
    if (value === false) return no;
    return "Unknown";
  }

  function terrestrialNbn(row) {
    if (row.nbnFixedLine === true || row.nbnFixedWireless === true) return true;
    if (row.nbnFixedLine === false && row.nbnFixedWireless === false) return false;
    return null;
  }

  function formatDistance(value) {
    return value === null || value === undefined ? "Unknown" : `${Number(value).toFixed(2)} km`;
  }

  function currentMode() {
    return modes[state.mode];
  }

  function scoreFor(row) {
    return row[currentMode().score];
  }

  function tierFor(row) {
    return row[currentMode().tier] || "Unknown";
  }

  function tierClass(tier) {
    return String(tier || "Unknown").toLowerCase();
  }

  function markerColor(tier) {
    if (state.mode === "delivery") {
      return { High: "#217a4a", Medium: "#b54708", Lower: "#b42318", Unknown: "#667085" }[tier] || "#667085";
    }
    return { High: "#b42318", Medium: "#b54708", Lower: "#217a4a", Unknown: "#667085" }[tier] || "#667085";
  }

  function project(lat, lon) {
    const bounds = { minLon: 128.65, maxLon: 138.35, minLat: -26.35, maxLat: -10.45 };
    const padding = { left: 165, right: 130, top: 58, bottom: 54 };
    const width = 1000 - padding.left - padding.right;
    const height = 760 - padding.top - padding.bottom;
    return {
      x: padding.left + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width,
      y: padding.top + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height,
    };
  }

  function setSvgAttributes(node, attributes) {
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function drawMapBase() {
    const outlineCoordinates = [
      [-14.9, 129.0], [-26.0, 129.0], [-26.0, 138.0], [-16.55, 138.0],
      [-15.9, 137.75], [-15.35, 137.95], [-14.65, 136.95], [-13.65, 136.55],
      [-12.55, 136.75], [-11.9, 136.25], [-11.25, 135.45], [-11.0, 134.45],
      [-11.25, 133.65], [-10.95, 132.8], [-11.35, 131.95], [-11.2, 131.1],
      [-11.75, 130.3], [-12.75, 129.65], [-14.0, 129.35], [-14.9, 129.0],
    ];
    const pathData = outlineCoordinates
      .map(([lat, lon], index) => {
        const point = project(lat, lon);
        return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      })
      .join(" ") + " Z";
    const outline = setSvgAttributes(document.createElementNS(svgNamespace, "path"), {
      d: pathData,
      class: "nt-outline",
    });
    elements.mapBase.appendChild(outline);

    const boundaryLines = [
      [[-16.0, 129.1], [-16.0, 137.8]],
      [[-18.0, 129.1], [-18.0, 138.0]],
      [[-20.0, 129.1], [-20.0, 138.0]],
      [[-22.0, 129.1], [-22.0, 138.0]],
      [[-11.2, 133.4], [-26.0, 133.4]],
    ];
    boundaryLines.forEach(([from, to]) => {
      const a = project(from[0], from[1]);
      const b = project(to[0], to[1]);
      const line = setSvgAttributes(document.createElementNS(svgNamespace, "line"), {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: "nt-boundary-line",
      });
      elements.mapBase.appendChild(line);
    });
  }

  function shortRegionName(region) {
    const replacements = {
      "GREATER DARWIN, PALMERSTON AND LITCHFIELD": "DARWIN / PALMERSTON",
      "DARWIN, PALMERSTON, LITCHFIELD": "DARWIN / PALMERSTON",
      "CENTRAL AUSTRALIA": "CENTRAL AUSTRALIA",
      "BIG RIVERS": "BIG RIVERS",
      "EAST ARNHEM": "EAST ARNHEM",
      "TOP END": "TOP END",
      BARKLY: "BARKLY",
    };
    return replacements[region] || region;
  }

  function drawRegionLabels() {
    elements.regionLabels.replaceChildren();
    Object.entries(meta.regionCentroids || {}).forEach(([region, centroid]) => {
      const point = project(centroid.lat, centroid.lon);
      const text = setSvgAttributes(document.createElementNS(svgNamespace, "text"), {
        x: point.x,
        y: point.y,
        class: "region-label",
      });
      text.textContent = shortRegionName(region);
      const count = setSvgAttributes(document.createElementNS(svgNamespace, "text"), {
        x: point.x,
        y: point.y + 14,
        class: "region-count",
      });
      count.textContent = `${centroid.count} communities`;
      elements.regionLabels.append(text, count);
    });
  }

  function matchesBooleanFilter(value, filterValue) {
    if (filterValue === "all") return true;
    if (filterValue === "yes") return value === true;
    if (filterValue === "no") return value === false;
    return value === null || value === undefined;
  }

  function matchesPopulation(row, filterValue) {
    if (filterValue === "all") return true;
    if (filterValue === "known") return row.population !== null;
    if (filterValue === "unknown") return row.population === null;
    if (row.population === null) return false;
    if (filterValue === "1-49") return row.population >= 1 && row.population <= 49;
    if (filterValue === "50-199") return row.population >= 50 && row.population <= 199;
    if (filterValue === "200+") return row.population >= 200;
    return true;
  }

  function matchesDistance(row, filterValue) {
    const distance = row.mobileSiteKm;
    if (filterValue === "all") return true;
    if (filterValue === "unknown") return distance === null;
    if (distance === null) return false;
    if (filterValue === "0-49") return distance < 50;
    if (filterValue === "50-99") return distance >= 50 && distance < 100;
    if (filterValue === "100+") return distance >= 100;
    return true;
  }

  function filteredRows() {
    const query = state.filters.search.trim().toLocaleLowerCase();
    return data.filter((row) => {
      const textMatch = !query || [row.name, row.region, row.type, row.landCouncil, row.localCouncil]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query));
      const tier = tierFor(row);
      return textMatch
        && (state.filters.region === "all" || row.region === state.filters.region)
        && (state.filters.type === "all" || row.type === state.filters.type)
        && matchesPopulation(row, state.filters.population)
        && matchesBooleanFilter(row.mobileAny, state.filters.mobile)
        && matchesBooleanFilter(terrestrialNbn(row), state.filters.nbn)
        && (state.filters.completeness === "all" || row.dataCompleteness === state.filters.completeness)
        && matchesDistance(row, state.filters.distance)
        && (state.filters.tiers.size === 0 || state.filters.tiers.has(tier));
    });
  }

  function sortedRows(rows) {
    return [...rows].sort((a, b) => {
      const aScore = scoreFor(a);
      const bScore = scoreFor(b);
      if (aScore === null && bScore === null) return a.name.localeCompare(b.name);
      if (aScore === null) return 1;
      if (bScore === null) return -1;
      return bScore - aScore || a.name.localeCompare(b.name);
    });
  }

  function markerNode(row) {
    const point = project(row.lat, row.lon);
    const tier = tierFor(row);
    const selected = row.id === state.selectedId;
    const size = selected ? 8 : tier === "High" ? 5.5 : 4.5;
    let node;

    if (tier === "High") {
      node = document.createElementNS(svgNamespace, "rect");
      setSvgAttributes(node, {
        x: point.x - size,
        y: point.y - size,
        width: size * 2,
        height: size * 2,
        transform: `rotate(45 ${point.x} ${point.y})`,
      });
    } else if (tier === "Medium") {
      node = document.createElementNS(svgNamespace, "rect");
      setSvgAttributes(node, {
        x: point.x - size,
        y: point.y - size,
        width: size * 2,
        height: size * 2,
      });
    } else if (tier === "Lower") {
      node = document.createElementNS(svgNamespace, "circle");
      setSvgAttributes(node, { cx: point.x, cy: point.y, r: size });
    } else {
      node = document.createElementNS(svgNamespace, "path");
      setSvgAttributes(node, {
        d: `M ${point.x} ${point.y - size - 1} L ${point.x + size + 1} ${point.y + size} L ${point.x - size - 1} ${point.y + size} Z`,
        fill: "#ffffff",
      });
    }

    const classes = ["community-marker"];
    if (selected) classes.push("is-selected");
    if (row.dataCompleteness !== "High") classes.push("is-medium-completeness");
    setSvgAttributes(node, {
      class: classes.join(" "),
      fill: tier === "Unknown" ? "#ffffff" : markerColor(tier),
      role: "button",
      tabindex: "0",
      "aria-label": `${row.name}, ${currentMode().label}, ${tier}, ${scoreFor(row) ?? "score unknown"}`,
      "data-community-id": row.id,
    });
    const title = document.createElementNS(svgNamespace, "title");
    title.textContent = `${row.name} — ${tier} — ${scoreFor(row) ?? "unknown"}`;
    node.appendChild(title);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCommunity(row.id);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCommunity(row.id);
      }
    });
    return node;
  }

  function renderMarkers(rows) {
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => fragment.appendChild(markerNode(row)));
    elements.markers.replaceChildren(fragment);
    elements.emptyMap.hidden = rows.length !== 0;
  }

  function driversFor(row, maximum = 3) {
    const drivers = [];
    if (state.mode === "impact") {
      drivers.push(row.population === null ? "Population unknown" : `Population ${formatNumber.format(row.population)}`);
      drivers.push(row.type);
    } else if (state.mode === "delivery") {
      drivers.push(row.mobileSiteKm === null ? "Mobile site distance unknown" : `${Math.round(row.mobileSiteKm)} km to mobile site`);
      drivers.push(row.towerKm === null ? "Tower distance unknown" : `${Math.round(row.towerKm)} km to recorded tower`);
    } else if (state.mode === "resilience") {
      drivers.push(row.cyclones200km === null ? "Cyclone data unavailable" : `${row.cyclones200km} tracks ≤200 km`);
      if (row.nearestCycloneTrackKm !== null) drivers.push(`${Math.round(row.nearestCycloneTrackKm)} km to nearest track`);
    } else {
      if (row.mobileAny === false) drivers.push("No mapped mobile");
      if (terrestrialNbn(row) === false) drivers.push("No mapped terrestrial NBN");
      if (row.mobileSiteKm !== null && row.mobileSiteKm >= 100) drivers.push(`${Math.round(row.mobileSiteKm)} km to mobile site`);
      if (row.population === null) drivers.push("Population unknown");
    }
    return drivers.slice(0, maximum);
  }

  function topItemTemplate(row, index) {
    const tier = tierFor(row);
    const score = scoreFor(row);
    const selected = row.id === state.selectedId;
    const added = state.shortlist.has(row.id);
    return `
      <li class="top-item${selected ? " is-selected" : ""}" data-community-id="${escapeHtml(row.id)}">
        <div class="top-item-row">
          <span class="top-rank">#${String(index + 1).padStart(2, "0")}</span>
          <span class="status-badge ${tierClass(tier)}">${escapeHtml(tier)} · ${score === null ? "unknown" : score.toFixed(1)}</span>
        </div>
        <div class="top-item-main">
          <div>
            <h3>${escapeHtml(row.name)}</h3>
            <p>${escapeHtml(row.region)} · ${escapeHtml(row.type)}</p>
          </div>
          <button class="shortlist-action${added ? " is-added" : ""}" data-shortlist-id="${escapeHtml(row.id)}" type="button">${added ? "Added" : "+ Shortlist"}</button>
        </div>
        <div class="driver-row">${driversFor(row, 2).map((driver) => `<span class="driver-chip">${escapeHtml(driver)}</span>`).join("")}</div>
      </li>`;
  }

  function renderTopList(rows) {
    const top = sortedRows(rows).slice(0, 10);
    elements.topList.innerHTML = top.length
      ? top.map(topItemTemplate).join("")
      : '<li class="top-item"><p>No candidates match the filters.</p></li>';

    elements.topList.querySelectorAll(".top-item[data-community-id]").forEach((item) => {
      item.addEventListener("click", () => selectCommunity(item.dataset.communityId));
    });
    elements.topList.querySelectorAll("[data-shortlist-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleShortlist(button.dataset.shortlistId);
      });
    });
  }

  function renderTable(rows) {
    elements.tableCaption.textContent = currentMode().sort;
    elements.tableBody.innerHTML = sortedRows(rows).map((row) => {
      const tier = tierFor(row);
      const score = scoreFor(row);
      return `<tr>
        <td><button type="button" class="table-community-button" data-table-community="${escapeHtml(row.id)}">${escapeHtml(row.name)}</button></td>
        <td>${escapeHtml(row.region)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td><span class="status-badge ${tierClass(tier)}">${escapeHtml(tier)}</span></td>
        <td>${score === null ? "Unknown" : score.toFixed(1)}</td>
        <td>${row.population === null ? "Unknown" : formatNumber.format(row.population)}</td>
        <td>${formatBoolean(row.mobileAny)}</td>
        <td>${formatBoolean(terrestrialNbn(row))}</td>
      </tr>`;
    }).join("");
    elements.tableBody.querySelectorAll("[data-table-community]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = "map";
        selectCommunity(button.dataset.tableCommunity);
      });
    });
  }

  function verifyText(row) {
    const needs = [];
    if (row.population === null) needs.push("population and likely beneficiaries");
    needs.push("actual service reliability", "engineering feasibility", "costs", "power and backhaul", "community priorities and consent");
    return `Verify next: ${needs.join(", ")}. Public data does not establish community support.`;
  }

  function detailFacts(row) {
    return [
      ["Population", row.population === null ? "Unknown" : formatNumber.format(row.population)],
      ["Mapped mobile", formatBoolean(row.mobileAny)],
      ["Mapped terrestrial NBN", formatBoolean(terrestrialNbn(row))],
      ["Nearest mobile site", formatDistance(row.mobileSiteKm)],
      ["Recorded Wi-Fi", formatDistance(row.wifiKm)],
      ["Cyclone tracks ≤200 km", row.cyclones200km === null ? "Not assessed" : formatNumber.format(row.cyclones200km)],
      ["Land Council", row.landCouncil],
      ["Project overlap", row.projectOverlap],
    ];
  }

  function renderDetail() {
    const row = data.find((item) => item.id === state.selectedId);
    if (!row) {
      elements.detail.hidden = true;
      return;
    }
    const tier = tierFor(row);
    const score = scoreFor(row);
    elements.detail.hidden = false;
    elements.detailName.textContent = row.name;
    elements.detailContext.textContent = `${row.region} · ${row.type}`;
    elements.detailBadges.innerHTML = `
      <span class="status-badge ${tierClass(tier)}">${escapeHtml(tier)} ${escapeHtml(currentMode().caption)}</span>
      <span class="status-badge completeness">${escapeHtml(row.dataCompleteness)} data completeness</span>
      <span class="score-label">${score === null ? "score unavailable" : `relative score ${score.toFixed(1)}`}</span>`;
    elements.detailFacts.innerHTML = detailFacts(row)
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join("");
    elements.detailDrivers.innerHTML = driversFor(row, 6)
      .map((driver) => `<li>${escapeHtml(driver)}</li>`)
      .join("");
    elements.detailVerify.textContent = verifyText(row);
    elements.detailShortlist.textContent = state.shortlist.has(row.id) ? "Remove from shortlist" : "Add to shortlist";
  }

  function activeFilterLabels() {
    const labels = [];
    if (state.filters.search) labels.push(`Search: ${state.filters.search}`);
    if (state.filters.region !== "all") labels.push(state.filters.region);
    if (state.filters.type !== "all") labels.push(state.filters.type);
    if (state.filters.population !== "all") labels.push(`Population: ${state.filters.population}`);
    if (state.filters.mobile !== "all") labels.push(`Mobile: ${state.filters.mobile}`);
    if (state.filters.nbn !== "all") labels.push(`NBN: ${state.filters.nbn}`);
    if (state.filters.completeness !== "all") labels.push(`${state.filters.completeness} completeness`);
    if (state.filters.distance !== "all") labels.push(`Mobile site: ${state.filters.distance}`);
    if (state.filters.tiers.size) labels.push(`Tier: ${[...state.filters.tiers].join(", ")}`);
    return labels;
  }

  function renderFilterSummary(rows) {
    const labels = activeFilterLabels();
    elements.activeFilterSummary.textContent = labels.length
      ? `${rows.length} communities · ${labels.join(" · ")}`
      : `All NT communities · ${rows.length} results`;
  }

  function renderLegend() {
    const mode = currentMode();
    elements.legendTitle.textContent = mode.label;
    elements.legendHigh.textContent = mode.high;
    elements.legendMedium.textContent = mode.medium;
    elements.legendLow.textContent = mode.low;
    elements.legendUnknown.textContent = mode.unknown;
    elements.legendNote.textContent = mode.note;
    elements.legendBody.hidden = !state.legendExpanded;
    document.getElementById("toggle-legend").textContent = state.legendExpanded ? "−" : "+";
    document.getElementById("toggle-legend").setAttribute("aria-expanded", String(state.legendExpanded));
  }

  function renderCompareTray() {
    const count = state.shortlist.size;
    elements.compareCount.textContent = `${count} selected for comparison`;
    elements.compareButton.textContent = `Compare (${count}/5)`;
    elements.compareButton.disabled = count < 2;
  }

  function updateView() {
    const mapVisible = state.view === "map";
    elements.mapContainer.hidden = !mapVisible;
    elements.tableContainer.hidden = mapVisible;
    document.getElementById("map-view-button").classList.toggle("is-active", mapVisible);
    document.getElementById("table-view-button").classList.toggle("is-active", !mapVisible);
  }

  function render() {
    const rows = filteredRows();
    elements.visibleCount.textContent = `${rows.length} visible`;
    elements.sortDescription.textContent = currentMode().sort;
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === state.mode);
    });
    document.querySelectorAll("[data-tier]").forEach((button) => {
      button.classList.toggle("is-active", state.filters.tiers.has(button.dataset.tier));
    });

    renderMarkers(rows);
    renderTopList(rows);
    renderTable(rows);
    renderFilterSummary(rows);
    renderLegend();
    renderCompareTray();
    renderDetail();
    updateView();
  }

  function selectCommunity(id) {
    state.selectedId = id;
    render();
  }

  function toggleShortlist(id) {
    if (state.shortlist.has(id)) {
      state.shortlist.delete(id);
    } else if (state.shortlist.size < 5) {
      state.shortlist.add(id);
    } else {
      window.alert("The comparison shortlist supports up to five communities.");
    }
    render();
  }

  function populateSelect(select, values) {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function initialiseFilters() {
    const regions = [...new Set(data.map((row) => row.region))].filter(Boolean).sort();
    const types = [...new Set(data.map((row) => row.type))].filter(Boolean).sort();
    populateSelect(filters.region, regions);
    populateSelect(filters.type, types);

    Object.entries(filters).forEach(([name, control]) => {
      const eventName = name === "search" ? "input" : "change";
      control.addEventListener(eventName, () => {
        state.filters[name] = control.value;
        render();
      });
    });

    document.querySelectorAll("[data-tier]").forEach((button) => {
      button.addEventListener("click", () => {
        const tier = button.dataset.tier;
        if (state.filters.tiers.has(tier)) state.filters.tiers.delete(tier);
        else state.filters.tiers.add(tier);
        render();
      });
    });
  }

  function resetFilters() {
    state.filters = {
      search: "",
      region: "all",
      type: "all",
      population: "all",
      mobile: "all",
      nbn: "all",
      completeness: "all",
      distance: "all",
      tiers: new Set(),
    };
    filters.search.value = "";
    Object.entries(filters).forEach(([name, control]) => {
      if (name !== "search") control.value = "all";
    });
    render();
  }

  function setViewBox() {
    const view = state.mapViewBox;
    elements.map.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
  }

  function zoomMap(factor) {
    const view = state.mapViewBox;
    const nextWidth = Math.max(350, Math.min(1200, view.width * factor));
    const nextHeight = nextWidth * 0.76;
    view.x += (view.width - nextWidth) / 2;
    view.y += (view.height - nextHeight) / 2;
    view.width = nextWidth;
    view.height = nextHeight;
    setViewBox();
  }

  function resetMap() {
    state.mapViewBox = { x: 0, y: 0, width: 1000, height: 760 };
    setViewBox();
  }

  function initialiseMapInteraction() {
    elements.map.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoomMap(event.deltaY < 0 ? 0.88 : 1.14);
    }, { passive: false });

    elements.map.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".community-marker")) return;
      state.dragging = { x: event.clientX, y: event.clientY, viewX: state.mapViewBox.x, viewY: state.mapViewBox.y };
      elements.map.classList.add("is-dragging");
      elements.map.setPointerCapture(event.pointerId);
    });
    elements.map.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const scaleX = state.mapViewBox.width / elements.map.clientWidth;
      const scaleY = state.mapViewBox.height / elements.map.clientHeight;
      state.mapViewBox.x = state.dragging.viewX - (event.clientX - state.dragging.x) * scaleX;
      state.mapViewBox.y = state.dragging.viewY - (event.clientY - state.dragging.y) * scaleY;
      setViewBox();
    });
    elements.map.addEventListener("pointerup", (event) => {
      state.dragging = null;
      elements.map.classList.remove("is-dragging");
      if (elements.map.hasPointerCapture(event.pointerId)) elements.map.releasePointerCapture(event.pointerId);
    });
  }

  function csvValue(value) {
    const string = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv(rows, filename) {
    const columns = [
      ["community", (row) => row.name],
      ["region", (row) => row.region],
      ["community_profile", (row) => row.type],
      ["selected_lens", () => currentMode().label],
      ["screening_tier", (row) => tierFor(row)],
      ["relative_score", (row) => scoreFor(row)],
      ["population", (row) => row.population],
      ["mapped_mobile", (row) => formatBoolean(row.mobileAny)],
      ["mapped_terrestrial_nbn", (row) => formatBoolean(terrestrialNbn(row))],
      ["nearest_mobile_site_km", (row) => row.mobileSiteKm],
      ["nearest_recorded_wifi_km", (row) => row.wifiKm],
      ["historical_cyclones_within_200km", (row) => row.cyclones200km],
      ["data_completeness", (row) => row.dataCompleteness],
      ["land_council", (row) => row.landCouncil],
      ["project_overlap", (row) => row.projectOverlap],
    ];
    const lines = [columns.map(([name]) => csvValue(name)).join(",")];
    rows.forEach((row) => lines.push(columns.map(([, getter]) => csvValue(getter(row))).join(",")));
    downloadBlob(filename, `\ufeff${lines.join("\n")}`, "text/csv;charset=utf-8");
  }

  function exportShortlist() {
    const shortlistRows = [...state.shortlist]
      .map((id) => data.find((row) => row.id === id))
      .filter(Boolean);
    const rows = shortlistRows.length ? shortlistRows : sortedRows(filteredRows()).slice(0, 10);
    exportCsv(rows, `connectnt-${state.mode}-shortlist.csv`);
  }

  function downloadEvidenceBrief() {
    const row = data.find((item) => item.id === state.selectedId);
    if (!row) return;
    const content = [
      "CONNECTNT SCREENING EVIDENCE BRIEF",
      "",
      `Community: ${row.name}`,
      `Region: ${row.region}`,
      `Community profile: ${row.type}`,
      `Selected lens: ${currentMode().label}`,
      `Relative score: ${scoreFor(row) ?? "Unknown"}`,
      `Screening tier: ${tierFor(row)}`,
      `Data completeness: ${row.dataCompleteness}`,
      "",
      "KNOWN PUBLIC-DATA INDICATORS",
      `Population: ${row.population ?? "Unknown"}`,
      `Mapped mobile: ${formatBoolean(row.mobileAny)}`,
      `Mapped terrestrial NBN: ${formatBoolean(terrestrialNbn(row))}`,
      `Nearest recorded mobile site: ${formatDistance(row.mobileSiteKm)}`,
      `Nearest recorded Wi-Fi: ${formatDistance(row.wifiKm)}`,
      `Historical cyclone tracks within 200 km since 1970: ${row.cyclones200km ?? "Not assessed"}`,
      `Land Council: ${row.landCouncil}`,
      `Funded project overlap: ${row.projectOverlap}`,
      "",
      "VERIFY NEXT",
      verifyText(row),
      "",
      "Screening result only. Confirm coverage, feasibility, community priorities, costs, power, backhaul and consent before investment decisions.",
    ].join("\n");
    downloadBlob(`connectnt-${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-evidence.txt`, content, "text/plain;charset=utf-8");
  }

  function renderMethodology() {
    const labels = {
      need: "Connectivity need",
      impact: "Community impact",
      delivery: "Delivery context",
      resilience: "Resilience exposure",
      combined: "Combined priority",
      tiers: "Priority tiers",
    };
    elements.methodologyContent.innerHTML = Object.entries(meta.methodology || {})
      .map(([key, text]) => `<div class="method-card"><strong>${escapeHtml(labels[key] || key)}</strong><p>${escapeHtml(text)}</p></div>`)
      .join("");
  }

  function renderComparison() {
    const rows = [...state.shortlist]
      .map((id) => data.find((row) => row.id === id))
      .filter(Boolean);
    const fields = [
      ["Region", (row) => row.region],
      ["Profile", (row) => row.type],
      ["Population", (row) => row.population ?? "Unknown"],
      ["Mapped mobile", (row) => formatBoolean(row.mobileAny)],
      ["Mapped terrestrial NBN", (row) => formatBoolean(terrestrialNbn(row))],
      ["Mobile site distance", (row) => formatDistance(row.mobileSiteKm)],
      ["Recorded Wi-Fi distance", (row) => formatDistance(row.wifiKm)],
      ["Cyclones within 200 km", (row) => row.cyclones200km ?? "Not assessed"],
      ["Need score", (row) => row.needScore ?? "Unknown"],
      ["Impact score", (row) => row.impactScore ?? "Unknown"],
      ["Delivery context", (row) => row.deliveryScore ?? "Unknown"],
      ["Resilience exposure", (row) => row.cycloneScore ?? "Unknown"],
      ["Data completeness", (row) => row.dataCompleteness],
      ["Land Council", (row) => row.landCouncil],
      ["Community support", () => "Not assessed"],
    ];
    elements.compareContent.innerHTML = `
      <div class="compare-table-wrapper"><table>
        <thead><tr><th>Evidence</th>${rows.map((row) => `<th>${escapeHtml(row.name)}</th>`).join("")}</tr></thead>
        <tbody>${fields.map(([label, getter]) => `<tr><th scope="row">${escapeHtml(label)}</th>${rows.map((row) => `<td>${escapeHtml(getter(row))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
  }

  function initialiseEvents() {
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        render();
      });
    });

    document.querySelectorAll("[data-screen]").forEach((button) => {
      button.addEventListener("click", () => {
        state.screen = button.dataset.screen;
        document.querySelectorAll("[data-screen]").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.screen === state.screen));
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("is-active"));
        document.getElementById(`${state.screen}-screen`).classList.add("is-active");
      });
    });

    document.getElementById("reset-filters").addEventListener("click", resetFilters);
    document.getElementById("map-view-button").addEventListener("click", () => { state.view = "map"; updateView(); });
    document.getElementById("table-view-button").addEventListener("click", () => { state.view = "table"; updateView(); });
    document.getElementById("zoom-in").addEventListener("click", () => zoomMap(0.82));
    document.getElementById("zoom-out").addEventListener("click", () => zoomMap(1.2));
    document.getElementById("reset-map").addEventListener("click", resetMap);
    document.getElementById("close-detail").addEventListener("click", () => { state.selectedId = null; render(); });
    elements.detailShortlist.addEventListener("click", () => state.selectedId && toggleShortlist(state.selectedId));
    document.getElementById("evidence-brief-button").addEventListener("click", downloadEvidenceBrief);
    document.getElementById("export-button").addEventListener("click", exportShortlist);
    document.getElementById("table-export-button").addEventListener("click", () => exportCsv(sortedRows(filteredRows()), `connectnt-${state.mode}-filtered.csv`));

    document.getElementById("methodology-button").addEventListener("click", () => {
      renderMethodology();
      elements.methodologyDialog.showModal();
    });
    elements.compareButton.addEventListener("click", () => {
      renderComparison();
      elements.compareDialog.showModal();
    });

    document.getElementById("toggle-legend").addEventListener("click", () => {
      state.legendExpanded = !state.legendExpanded;
      renderLegend();
    });

    document.getElementById("collapse-filters").addEventListener("click", () => {
      state.filterCollapsed = true;
      elements.filterPanel.classList.add("is-collapsed");
      elements.filterPanel.classList.remove("is-mobile-open");
      elements.openFilters.hidden = false;
    });
    elements.openFilters.addEventListener("click", () => {
      state.filterCollapsed = false;
      elements.filterPanel.classList.remove("is-collapsed");
      elements.filterPanel.classList.add("is-mobile-open");
      elements.openFilters.hidden = true;
    });
    document.getElementById("collapse-shortlist").addEventListener("click", () => {
      state.shortlistCollapsed = true;
      elements.shortlistPanel.classList.add("is-collapsed");
      elements.shortlistPanel.classList.remove("is-mobile-open");
      elements.openShortlist.hidden = false;
    });
    elements.openShortlist.addEventListener("click", () => {
      state.shortlistCollapsed = false;
      elements.shortlistPanel.classList.remove("is-collapsed");
      elements.shortlistPanel.classList.add("is-mobile-open");
      elements.openShortlist.hidden = true;
    });
  }

  function initialiseMeta() {
    document.getElementById("kpi-screened").textContent = formatNumber.format(meta.communityCount || data.length);
    document.getElementById("kpi-gap").textContent = formatNumber.format(meta.noMappedMobileAndTerrestrialNbn || 0);
    document.getElementById("kpi-population").textContent = formatNumber.format(meta.populationUnknown || 0);
    document.getElementById("official-map-link").href = meta.officialMapUrl || "https://spatial.infrastructure.gov.au/";
    document.getElementById("detail-official-link").href = meta.officialMapUrl || "https://spatial.infrastructure.gov.au/";
  }

  function initialise() {
    if (!data.length) {
      document.body.innerHTML = "<main style='padding:2rem;font-family:sans-serif'><h1>Prototype data is missing</h1><p>Run <code>python src/build_prototype_data.py</code> from the repository root.</p></main>";
      return;
    }
    initialiseMeta();
    initialiseFilters();
    initialiseEvents();
    initialiseMapInteraction();
    drawMapBase();
    drawRegionLabels();
    resetMap();
    render();

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("service-worker.js").catch(() => undefined);
    }
  }

  initialise();
})();
