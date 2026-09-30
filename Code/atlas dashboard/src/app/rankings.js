import PriorityEngine from "./priority-engine.js";
("use strict");
(() => {
  const get = (id) => document.getElementById(id),
    safe = (s) =>
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
      ),
    number = (n) => Number(n).toLocaleString("en-AU");
  const definitions = {
    mobile_need: {
      label: "Mobile need",
      color: "#087c69",
      hint: "Higher need flag → higher priority",
    },
    nbn_need: {
      label: "NBN need",
      color: "#487eaa",
      hint: "Higher need flag → higher priority",
    },
    nearest_mobile_site_distance_km: {
      label: "Distance to mobile site",
      color: "#d17631",
      hint: "Greater distance → higher priority",
    },
    distance_community_to_wifi_km: {
      label: "Distance to Wi-Fi",
      color: "#8669b2",
      hint: "Greater distance → higher priority",
    },
    population_final: {
      label: "Population",
      color: "#ae557a",
      hint: "Larger population → higher priority",
    },
  };
  let models = [],
    states = [],
    modelIndex = 0,
    ranked = [],
    visible = [],
    rankPage = 0,
    communities = new Map(),
    selectedId = null;
  const pageSize = 15,
    model = () => models[modelIndex],
    state = () => states[modelIndex];
  function setView(priority) {
    get("overview-panel").hidden = priority;
    get("priority-panel").hidden = !priority;
    get("download").hidden = priority;
    for (const [id, active] of [
      ["overview-tab", !priority],
      ["priority-tab", priority],
    ]) {
      get(id).setAttribute("aria-selected", String(active));
      get(id).tabIndex = active ? 0 : -1;
    }
  }
  get("overview-tab").onclick = () => setView(false);
  get("priority-tab").onclick = () => setView(true);
  for (const id of ["overview-tab", "priority-tab"])
    get(id).addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const priority =
          e.key === "End" || (e.key !== "Home" && id === "overview-tab");
        setView(priority);
        get(priority ? "priority-tab" : "overview-tab").focus();
      }
    });
  function controls() {
    get("weight-controls").innerHTML = model()
      .factors.map((key, i) => {
        const d = definitions[key];
        return `<div class="weight-control" style="--factor:${d.color}"><div class="weight-head"><label for="weight-${i}">${d.label}</label><div class="weight-number"><input id="weight-number-${i}" data-weight="${i}" type="number" min="0" max="100" step="0.01" aria-label="${d.label} weight percent"><span>%</span></div></div><input id="weight-${i}" data-weight="${i}" type="range" min="0" max="100" step="0.01" aria-label="${d.label} weight" aria-describedby="weight-hint-${i}"><p id="weight-hint-${i}">${d.hint}</p></div>`;
      })
      .join("");
    get("factor-legend").innerHTML = model()
      .factors.map(
        (k) =>
          `<span style="--factor:${definitions[k].color}"><i></i>${definitions[k].label}</span>`,
      )
      .join("");
    get("rank-scope").textContent =
      modelIndex === 0
        ? "792 communities · Connectivity need and infrastructure distance."
        : "468 communities with known population · 324 communities excluded for missing population.";
    syncControls();
  }
  function syncControls() {
    model().factors.forEach((k, i) => {
      const value = state().weights[i] * 100;
      get(`weight-${i}`).value = value.toFixed(2);
      get(`weight-${i}`).setAttribute(
        "aria-valuetext",
        `${value.toFixed(2)} percent`,
      );
      get(`weight-number-${i}`).value = value.toFixed(2);
    });
    const original = state().weights.every(
      (w, i) => Math.abs(w - model().defaults[i]) < 1e-12,
    );
    get("scenario-badge").textContent = original
      ? "Original EWM weights"
      : "Custom weight scenario";
    get("scenario-badge").className =
      "pill" + (original ? "" : " scenario-custom");
  }
  function movement(r) {
    return r.movement > 0
      ? `<span class="movement rise">↑ ${r.movement}</span>`
      : r.movement < 0
        ? `<span class="movement fall">↓ ${-r.movement}</span>`
        : '<span class="movement same">—</span>';
  }
  function compute() {
    ranked = PriorityEngine.rank(model(), state().weights);
    renderResults();
  }
  function renderResults() {
    const q = get("rank-search").value.trim().toLowerCase(),
      type = get("rank-type").value;
    visible = ranked.filter(
      (r) =>
        (!q || r.community_name.toLowerCase().includes(q)) &&
        (type === "all" ||
          communities.get(r.community_id)?.community_type === type),
    );
    const top = visible.slice(0, 10),
      leader = visible[0],
      changed = ranked.filter((r) => r.movement !== 0).length,
      originalTop = new Set(
        model()
          .rows.filter((r) => r.baselineRank <= 10)
          .map((r) => r.community_id),
      ),
      retained = ranked
        .slice(0, 10)
        .filter((r) => originalTop.has(r.community_id)).length;
    get("rank-summary").innerHTML =
      `<div class="rank-stat"><small>Highest priority in selection</small><strong>${leader ? safe(leader.community_name) : "No match"}</strong><p>${leader ? `Rank ${leader.rank} · score ${leader.score.toFixed(4)}` : "Try clearing the filters"}</p></div><div class="rank-stat"><small>Changed ranks · full model</small><strong>${number(changed)}</strong><p>Compared with original EWM</p></div><div class="rank-stat"><small>Original top 10 retained</small><strong>${retained} / 10</strong><p>First 10 overall; ties by name</p></div>`;
    get("rank-chart").innerHTML = top.length
      ? top
          .map(
            (r) =>
              `<button class="ranking-bar" data-community="${r.community_id}" aria-label="View ${safe(r.community_name)} priority breakdown, rank ${r.rank}, score ${r.score.toFixed(4)}"><span class="rank-index">${r.rank}</span><span class="rank-name">${safe(r.community_name)}</span><span class="stack-track">${r.contributions.map((c, i) => `<span class="stack-segment" style="width:${c * 100}%;--factor:${definitions[model().factors[i]].color}" title="${definitions[model().factors[i]].label}: ${c.toFixed(4)}"></span>`).join("")}</span><span class="rank-score">${r.score.toFixed(4)}</span></button>`,
          )
          .join("")
      : '<p class="empty">No communities match your selection.</p>';
    get("rank-match-count").textContent =
      `${number(visible.length)} of ${number(ranked.length)} communities`;
    get("rank-method-rows").innerHTML = model()
      .factors.map(
        (k, i) =>
          `<tr><td>${definitions[k].label}</td><td>${number(model().ranges[k][0])}</td><td>${number(model().ranges[k][1])}</td><td>${(model().defaults[i] * 100).toFixed(2)}%</td><td>${(state().weights[i] * 100).toFixed(2)}%</td></tr>`,
      )
      .join("");
    renderTable();
    if (get("rank-detail").open && selectedId) detail(selectedId, false);
  }
  function renderTable() {
    const sort = get("rank-sort").value;
    const list = [...visible].sort((a, b) =>
      sort === "up"
        ? b.movement - a.movement || a.rank - b.rank
        : sort === "down"
          ? a.movement - b.movement || a.rank - b.rank
          : sort === "name"
            ? a.community_name.localeCompare(b.community_name)
            : a.rank - b.rank,
    );
    rankPage = Math.min(
      rankPage,
      Math.max(0, Math.ceil(list.length / pageSize) - 1),
    );
    get("rank-rows").innerHTML =
      list
        .slice(rankPage * pageSize, (rankPage + 1) * pageSize)
        .map((r) => {
          const pop = communities.get(r.community_id)?.population_final;
          return `<tr><td><b>${r.rank}</b></td><td><button data-community="${r.community_id}">${safe(r.community_name)}</button></td><td>${r.score.toFixed(4)}</td><td>${r.baselineRank}</td><td>${movement(r)}</td><td>${pop == null || pop === "" ? "Unknown" : number(pop)}</td><td>${r.mobile_need}</td><td>${r.nbn_need}</td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="8" class="empty">No communities match. Clear filters to see the ranking.</td></tr>';
    get("rank-page-label").textContent = list.length
      ? `${rankPage * pageSize + 1}–${Math.min((rankPage + 1) * pageSize, list.length)} of ${number(list.length)} communities`
      : "0 communities";
    get("rank-prev").disabled = rankPage === 0;
    get("rank-next").disabled = (rankPage + 1) * pageSize >= list.length;
  }
  function detail(id, open = true) {
    const r = ranked.find((r) => r.community_id === id);
    if (!r) return;
    selectedId = id;
    get("rank-detail-name").textContent = r.community_name;
    get("rank-detail-sub").textContent =
      `${get("rank-model").selectedOptions[0].textContent} · Community ID ${r.community_id}`;
    get("rank-detail-body").innerHTML =
      `<div class="detail-grid"><div><small>Current rank</small><b>${r.rank} of ${ranked.length}</b></div><div><small>Movement from original #${r.baselineRank}</small><b>${r.movement > 0 ? "Up " + r.movement : r.movement < 0 ? "Down " + -r.movement : "No change"}</b></div><div><small>Current score</small><b>${r.score.toFixed(6)}</b></div><div><small>Original score</small><b>${Number(r.priority_score).toFixed(6)}</b></div></div><div class="table-scroll"><table><thead><tr><th>Factor</th><th>Raw value</th><th>Normalised</th><th>Weight</th><th>Contribution</th></tr></thead><tbody>${model()
        .factors.map(
          (k, i) =>
            `<tr><td>${definitions[k].label}</td><td>${number(r[k])}</td><td>${r.normalised[i].toFixed(4)}</td><td>${(state().weights[i] * 100).toFixed(2)}%</td><td>${r.contributions[i].toFixed(6)}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div><p class="footnote">Contribution = normalised value × weight. Contributions sum to the current score before rounding. ${modelIndex === 0 ? "Population is not included in this model." : "Population contributes independently of recorded connectivity need."}</p>`;
    if (open) get("rank-detail").showModal();
  }
  get("rank-detail-close").onclick = () => get("rank-detail").close();
  get("rank-detail").addEventListener("click", (e) => {
    if (e.target === get("rank-detail")) {
      const b = e.target.getBoundingClientRect();
      if (
        e.clientX < b.left ||
        e.clientX > b.right ||
        e.clientY < b.top ||
        e.clientY > b.bottom
      )
        e.target.close();
    }
  });
  for (const id of ["rank-chart", "rank-rows"])
    get(id).addEventListener("click", (e) => {
      const target = e.target.closest("[data-community]");
      if (target) detail(target.dataset.community);
    });
  get("weight-controls").addEventListener("input", (e) => {
    if (e.target.type !== "range") return;
    setWeight(+e.target.dataset.weight, Number(e.target.value));
  });
  get("weight-controls").addEventListener("change", (e) => {
    if (e.target.type !== "number") return;
    const value = Number(e.target.value);
    if (
      e.target.value === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      syncControls();
      return;
    }
    setWeight(+e.target.dataset.weight, value);
  });
  function setWeight(index, value) {
    state().weights = PriorityEngine.rebalance(state().weights, index, value);
    rankPage = 0;
    syncControls();
    compute();
  }
  get("weights-reset").onclick = () => {
    state().weights = [...model().defaults];
    rankPage = 0;
    syncControls();
    compute();
  };
  get("weights-equal").onclick = () => {
    state().weights = model().factors.map(() => 1 / model().factors.length);
    rankPage = 0;
    syncControls();
    compute();
  };
  get("rank-model").onchange = () => {
    modelIndex = Number(get("rank-model").value);
    rankPage = 0;
    controls();
    compute();
  };
  for (const id of ["rank-search", "rank-type"])
    get(id).addEventListener(id === "rank-search" ? "input" : "change", () => {
      rankPage = 0;
      renderResults();
    });
  get("rank-sort").onchange = () => {
    rankPage = 0;
    renderTable();
  };
  get("rank-filter-reset").onclick = () => {
    get("rank-search").value = "";
    get("rank-type").value = "all";
    get("rank-sort").value = "rank";
    rankPage = 0;
    renderResults();
  };
  get("rank-prev").onclick = () => {
    rankPage--;
    renderTable();
  };
  get("rank-next").onclick = () => {
    rankPage++;
    renderTable();
  };
  get("rank-export").onclick = () => {
    const factors = model().factors,
      headers = [
        "model",
        "current_rank",
        "original_rank",
        "rank_movement",
        "community_id",
        "community_name",
        "priority_score",
        "original_priority_score",
        ...factors,
        ...factors.map((k) => "weight_" + k),
        ...factors.map((k) => "normalised_" + k),
      ];
    const quote = (v) => '"' + String(v).replace(/"/g, '""') + '"',
      rows = visible.map((r) => [
        modelIndex + 1,
        r.rank,
        r.baselineRank,
        r.movement,
        r.community_id,
        r.community_name,
        r.score,
        r.priority_score,
        ...factors.map((k) => r[k]),
        ...state().weights,
        ...r.normalised,
      ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(quote).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `connectivity-priority-model-${modelIndex + 1}-scenario.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  Promise.all(
    ["rankings.json", "data.json"].map((url) =>
      fetch(url).then((r) => {
        if (!r.ok) throw Error("Dataset unavailable");
        return r.json();
      }),
    ),
  )
    .then(([input, base]) => {
      models = input.map(PriorityEngine.prepare);
      states = models.map((m) => ({ weights: [...m.defaults] }));
      communities = new Map(base.map((r) => [r.community_id, r]));
      get("rank-type").innerHTML += [
        ...new Set(base.map((r) => r.community_type)),
      ]
        .sort()
        .map((t) => `<option>${safe(t)}</option>`)
        .join("");
      controls();
      compute();
      get("rank-loading").hidden = true;
      get("rank-app").hidden = false;
      get("rank-export").disabled = false;
      registerPriorityTool();
    })
    .catch(() => {
      get("rank-loading").textContent =
        "Priority data could not be loaded. Refresh the page to try again.";
    });
  function registerPriorityTool() {
    if (!document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    window.addEventListener("pagehide", () => lifecycle.abort(), {
      once: true,
    });
    try {
      Promise.resolve(
        document.modelContext.registerTool(
          {
            name: "set_priority_weights",
            title: "Adjust community priority weights",
            description:
              "Switch priority model and set all factor weights as percentages totaling 100, updating the visible ranking. Returns the top five across the full model.",
            inputSchema: {
              type: "object",
              properties: {
                model: { type: "integer", enum: [1, 2] },
                weights: {
                  type: "object",
                  properties: Object.fromEntries(
                    Object.keys(definitions).map((k) => [
                      k,
                      { type: "number", minimum: 0, maximum: 100 },
                    ]),
                  ),
                  additionalProperties: false,
                },
              },
              required: ["model", "weights"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (
                !input ||
                ![1, 2].includes(input.model) ||
                !input.weights ||
                typeof input.weights !== "object"
              )
                throw Error("Provide model 1 or 2 and weights.");
              const m = models[input.model - 1],
                keys = Object.keys(input.weights);
              if (
                keys.length !== m.factors.length ||
                keys.some((k) => !m.factors.includes(k))
              )
                throw Error(
                  "Provide exactly the factors in the selected model.",
                );
              const values = m.factors.map((k) => input.weights[k]);
              if (
                values.some(
                  (v) =>
                    typeof v !== "number" ||
                    !Number.isFinite(v) ||
                    v < 0 ||
                    v > 100,
                ) ||
                Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 1e-8
              )
                throw Error("Percentages must total 100.");
              modelIndex = input.model - 1;
              state().weights = values.map((v) => v / 100);
              get("rank-model").value = String(modelIndex);
              rankPage = 0;
              get("rank-search").value = "";
              get("rank-type").value = "all";
              controls();
              compute();
              setView(true);
              return {
                model: input.model,
                communities: ranked.length,
                top: ranked.slice(0, 5).map((r) => ({
                  community: r.community_name,
                  rank: r.rank,
                  score: r.score,
                  movement: r.movement,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
  }
})();
