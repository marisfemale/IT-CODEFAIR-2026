"use strict";
const PriorityEngine = (() => {
  function prepare(model) {
    const factors = model.weights.map((w) => w.Feature);
    const weights = model.weights.map((w) => Number(w.Weight));
    const rows = model.rows.map((row) => ({
      ...row,
      baselineRank: Number(row.priority_rank),
      normalised: factors.map((key) => {
        const [min, max] = model.ranges[key];
        return max === min ? 0 : (Number(row[key]) - min) / (max - min);
      }),
    }));
    return { ...model, factors, defaults: weights, rows };
  }
  function rebalance(weights, index, percent) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= weights.length ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100
    )
      throw Error("Weight must be between 0 and 100.");
    const target = percent / 100,
      remaining = weights.reduce((sum, w, i) => sum + (i === index ? 0 : w), 0);
    return weights.map((w, i) =>
      i === index
        ? target
        : remaining > 1e-15
          ? (w / remaining) * (1 - target)
          : (1 - target) / (weights.length - 1),
    );
  }
  function rank(model, weights) {
    if (
      weights.length !== model.factors.length ||
      weights.some((w) => !Number.isFinite(w) || w < 0) ||
      Math.abs(weights.reduce((s, w) => s + w, 0) - 1) > 1e-9
    )
      throw Error("Weights must total 100%.");
    const rows = model.rows.map((r) => {
      const contributions = r.normalised.map((v, i) => v * weights[i]);
      return {
        ...r,
        contributions,
        score: contributions.reduce((s, v) => s + v, 0),
      };
    });
    rows.sort(
      (a, b) =>
        b.score - a.score ||
        a.community_name.localeCompare(b.community_name) ||
        a.community_id.localeCompare(b.community_id),
    );
    let groupScore = null,
      rank = 0;
    rows.forEach((r, i) => {
      if (groupScore === null || Math.abs(r.score - groupScore) > 1e-12) {
        rank = i + 1;
        groupScore = r.score;
      }
      r.rank = rank;
      r.movement = r.baselineRank - rank;
    });
    // Give exact ties a stable, readable display order.
    rows.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.community_name.localeCompare(b.community_name) ||
        a.community_id.localeCompare(b.community_id),
    );
    return rows;
  }
  return { prepare, rebalance, rank };
})();
export default PriorityEngine;
