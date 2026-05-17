import { DatabaseSync } from 'node:sqlite';
import { parseExpression, computeSimilarity } from '../src/harness/similarity.js';

const db = new DatabaseSync('data/harness.db');
const rows = db.prepare('SELECT alpha_id, expression FROM alphas').all();
const sigs = rows.map((r) => ({ id: r.alpha_id, sig: parseExpression(r.expression) }));

const candidates = [
  'rank(ts_corr(rank(volume), rank(cashflow), 18))',
  'group_rank(ts_delta(actual_eps_value_annual, 8), industry)',
  'rank(ts_delta(beta_2y, 14) - ts_delta(investment_to_assets, 14))',
  'group_rank(ts_std_dev(implied_volatility_call_60, 20), sector)',
  'rank(ts_delta(roe_trailing_12m, 5) + ts_delta(dividend_yield, 5))',
  'group_rank(ts_delta(actual_eps_value_annual, 8), industry)'
];

for (const expr of candidates) {
  const sig = parseExpression(expr);
  let maxSim = -1;
  let closest = null;
  for (const row of sigs) {
    const sim = computeSimilarity(sig, row.sig);
    if (sim > maxSim) {
      maxSim = sim;
      closest = row.id;
    }
  }
  console.log(expr);
  console.log(`max_similarity=${maxSim} closest=${closest}`);
}
