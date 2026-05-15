import { DatabaseSync } from 'node:sqlite';
import { parseExpression, computeSimilarity } from '../src/harness/similarity.js';

const db = new DatabaseSync('data/harness.db');
const rows = db.prepare('SELECT alpha_id, expression FROM alphas').all();
const sigs = rows.map((r) => ({ id: r.alpha_id, sig: parseExpression(r.expression) }));

const candidates = {
  alpha_signature_b: 'alpha_signature_b(ts_delta(roe_trailing_12m, 9), ts_delta(op_earnings_retention, 9))',
  growth_tilt: 'value_dislocation(ts_delta(dividend_yield, 12), ts_delta(free_cash_flow_to_debt, 12))',
  quality_diverge: 'momentum_decay(ts_delta(ebitda_margin, 9), ts_delta(book_value_per_share, 9), 6)',
  micro_beta: 'macro_pressure(ts_delta(inflation_rate_1m, 9), ts_delta(roe_trailing, 9), 4)',
  alt_gate: 'turnover_gate(ts_delta(liquidity_beta, 10), 3)',
  reserve_tilt: 'beta_reversal(ts_delta(debt_growth, 10), ts_delta(roic, 10), 4)',
  asset_flow: 'growth_gate(ts_delta(cashflow_per_share, 10), ts_delta(free_cash_flow_to_debt, 10), 4)',
  vol_bucket: 'volatility_bucket(ts_delta(volatility_20d, 8), 5)',
};

for (const [label, expr] of Object.entries(candidates)) {
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
  console.log(`${label} -> ${expr}`);
  console.log(`  max_similarity=${maxSim} closest=${closest}`);
}
