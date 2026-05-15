import { DatabaseSync } from 'node:sqlite';
import { parseExpression, computeSimilarity } from '../src/harness/similarity.js';

const db = new DatabaseSync('data/harness.db');
const allRows = db.prepare('SELECT alpha_id, expression FROM alphas').all();
const signatures = allRows.map(r => ({
  id: r.alpha_id,
  expression: r.expression,
  signature: parseExpression(r.expression),
}));

const candidates = [
  'alpha_curve(ts_delta(market_beta_12m, 6), ts_delta(beta_2y, 6), 6)',
  'cashflow_shock(ts_delta(free_cash_flow_to_debt, 8), ts_delta(operating_cash_flow, 8))',
  'macro_tilt(ts_delta(gdp_growth_rate, 12), ts_delta(inflation_rate_1m, 12), 3)',
  'quality_gate(ts_delta(roe_trailing_12m, 5), 0.5)',
  'vol_spread(ts_delta(ask_bid_spread, 10), ts_delta(trade_volume, 10))',
];

for (const expr of candidates) {
  const sig = parseExpression(expr);
  let maxSim = -1;
  let maxId = null;
  for (const row of signatures) {
    const sim = computeSimilarity(sig, row.signature);
    if (sim > maxSim) {
      maxSim = sim;
      maxId = row.id;
    }
  }
  console.log(`candidate=${expr}`);
  console.log(`  max_similarity=${maxSim} closest=${maxId}`);
}
