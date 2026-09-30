import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import PriorityEngine from "../src/app/priority-engine.js";

const data = JSON.parse(
  readFileSync(new URL("../public/data.json", import.meta.url)),
);
const models = JSON.parse(
  readFileSync(new URL("../public/rankings.json", import.meta.url)),
).map(PriorityEngine.prepare);

test("community snapshot matches the original dashboard", () => {
  assert.equal(data.length, 792);
  assert.equal(new Set(data.map((r) => r.community_id)).size, 792);
  assert.equal(
    data.filter((r) => r.mobile_outdoor_coverage_any_network === "Yes").length,
    350,
  );
  assert.equal(data.filter((r) => r.population_final !== "").length, 468);
  assert.equal(
    data.reduce((sum, r) => sum + Number(r.population_final), 0),
    52602,
  );
  assert.ok(
    data.every(
      (r) =>
        Number.isFinite(Number(r.community_longitude)) &&
        Number.isFinite(Number(r.community_latitude)),
    ),
  );
});

test("default weights reproduce both original models and uploaded scores", () => {
  assert.deepEqual(
    models.map((m) => m.rows.length),
    [792, 468],
  );
  const ids = new Set(data.map((r) => r.community_id));
  for (const model of models) {
    for (const row of PriorityEngine.rank(model, model.defaults)) {
      assert.ok(ids.has(row.community_id));
      assert.equal(row.rank, row.baselineRank, row.community_name);
      assert.ok(
        Math.abs(row.score - Number(row.priority_score)) < 1e-7,
        row.community_name,
      );
      assert.ok(row.score >= 0 && row.score <= 1);
    }
  }
  const known = new Set(
    data.filter((r) => r.population_final !== "").map((r) => r.community_id),
  );
  assert.ok(models[1].rows.every((r) => known.has(r.community_id)));
});

test("weight extremes rebalance and maintain a valid full ranking", () => {
  for (const model of models) {
    let weights = [...model.defaults];
    for (const percent of [100, 0, 50, 12.34]) {
      weights = PriorityEngine.rebalance(weights, 0, percent);
      assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
      assert.ok(Math.abs(weights[0] - percent / 100) < 1e-12);
      const rows = PriorityEngine.rank(model, weights);
      assert.equal(rows.length, model.rows.length);
      assert.ok(rows.every((r) => Number.isFinite(r.score)));
      assert.ok(rows.every((r, i) => !i || r.rank >= rows[i - 1].rank));
    }
  }
  assert.throws(() => PriorityEngine.rebalance([0.5, 0.5], 0, 101));
  assert.throws(() => PriorityEngine.rank(models[0], [1]));
});

test("score ties use competition ranks and stable name order", () => {
  const model = PriorityEngine.prepare({
    weights: [{ Feature: "need", Weight: 1 }],
    ranges: { need: [0, 1] },
    rows: [
      { community_id: "2", community_name: "Beta", need: 1, priority_rank: 1 },
      { community_id: "1", community_name: "Alpha", need: 1, priority_rank: 1 },
      { community_id: "3", community_name: "Gamma", need: 0, priority_rank: 3 },
    ],
  });
  const result = PriorityEngine.rank(model, [1]);
  assert.deepEqual(
    result.map((r) => r.community_name),
    ["Alpha", "Beta", "Gamma"],
  );
  assert.deepEqual(
    result.map((r) => r.rank),
    [1, 1, 3],
  );
});
