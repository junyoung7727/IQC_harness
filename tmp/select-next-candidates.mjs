import { DatabaseSync } from 'node:sqlite';
import { parseExpression, computeSimilarity } from '../src/harness/similarity.js';

const db = new DatabaseSync('data/harness.db');
const all = db.prepare('SELECT alpha_id, expression FROM alphas').all();
const sigs = all.map((r)=>({id:r.alpha_id, sig: parseExpression(r.expression)}));

const candidates = {
  'alpha_signature_test(ts_delta(roe_trailing_12m, 9))': 'alpha_signature_test 1',
  'alpha_signature_a(ts_delta(cashflow_op, 11))': 'alpha_signature_a 1',
  'liquidity_gate(vec_avg(average_daily_volume), 3)': 'liquidity_gate',
  'liquidity_gate(ts_delta(liquidity_beta, 5), 4)': 'liquidity_gate delta',
  'macro_curve(ts_delta(inflation_rate_1m, 6), 6)': 'macro_curve',
  'macro_tilt(ts_delta(debt_growth, 10), ts_delta(roic, 10), 4)': 'macro_tilt',
  'cashflow_shock(ts_delta(cashflow_per_share_maximum, 10), ts_delta(fnd2_dbplanepdfbnfpythree, 10))': 'cashflow_shock',
  'quality_gate(ts_delta(free_float_turnover, 11), 0.4)': 'quality_gate',
  'volatility_bucket(ts_delta(volatility_60d, 12), 3)': 'volatility_bucket',
  'sentiment_dislocation(ts_delta(dividend_estimate_value, 12), ts_delta(analyst_tone_score, 12))': 'sentiment_variant',
};

for (const [expr,label] of Object.entries(candidates)) {
  const sig = parseExpression(expr);
  let maxSim = -1;
  let closest = null;
  for (const row of sigs) {
    const sim = computeSimilarity(sig, row.sig);
    if (sim > maxSim) { maxSim = sim; closest = row.id; }
  }
  console.log(label, '\n expr:', expr, '\n max_similarity:', maxSim, 'closest:', closest);
}
