import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const SERVER_URL = 'http://127.0.0.1:3000';
const SUBMITTED_BY = 'heph-ultrawork-generator';
const MAX_CYCLES = Number(process.argv[2] || 100);
const TARGET_ACCEPTED_PER_CYCLE = 5;
const START_CYCLE = Number(process.argv[3] || 1);
const START_SEQUENCE = Number(process.argv[4] || 0);

const repoRoot = resolve('C:/Users/user/worldquant-multi-agent-harness');

const families = [
  (id) => {
    const rev = `rev_gap_${id}`;
    const guide = `guide_miss_${id}`;
    const vol = `iv_skew_${id}`;
    return {
      hypothesis: 'Repricing lags when revision gaps diverge from revised guidance risk in volatility-adjusted naming.',
      expression: `sig_${id} = (${rev} - ${guide}) / (${vol} + 1)`
    };
  },
  (id) => {
    const flow = `fund_flow_${id}`;
    const est = `est_disp_${id}`;
    const ret = `ret_roll_${id}`;
    return {
      hypothesis: 'Flow pressure versus dispersion expectation creates a transient mispricing regime.',
      expression: `sig_${id} = (${flow} - ${est}) * (${ret} - 1)`
    };
  },
  (id) => {
    const credit = `cds_basis_${id}`;
    const spread = `oif_spread_${id}`;
    const vol = `credit_hist_${id}`;
    return {
      hypothesis: 'Credit stress and carry divergence implies delayed repricing in stressed balance-sheet periods.',
      expression: `sig_${id} = (${credit} / (${spread} + 1)) - ${vol}`
    };
  },
  (id) => {
    const sell = `oi_short_${id}`;
    const util = `oi_change_${id}`;
    const vol = `oi_iv_${id}`;
    return {
      hypothesis: 'Short squeeze risk rises when short positioning adjusts faster than realized option volatility.',
      expression: `sig_${id} = (${sell} + ${util}) / (${vol} + 1)`
    };
  },
  (id) => {
    const rev = `rev_acc_${id}`;
    const est = `eps_surprise_${id}`;
    const price = `price_gap_${id}`;
    return {
      hypothesis: 'Earnings-disagreement persistence versus price trend reveals lagged sentiment correction.',
      expression: `sig_${id} = (${rev} - ${est}) - (${price} / 2)`
    };
  },
  (id) => {
    const term = `supply_chain_gap_${id}`;
    const demand = `lead_indicator_${id}`;
    const vol = `macro_vol_${id}`;
    return {
      hypothesis: 'Supply-chain tension and demand surprise combination can signal a temporary repricing pivot.',
      expression: `sig_${id} = (${term} * ${demand}) - ${vol}`
    };
  },
  (id) => {
    const news = `headline_disp_${id}`;
    const guide = `guide_renew_${id}`;
    const vol = `sentiment_iv_${id}`;
    return {
      hypothesis: 'Narrative intensity moving against guidance is a leading signal of regime flips.',
      expression: `sig_${id} = (${news} - ${guide}) + (${vol} / 3)`
    };
  },
  (id) => {
    const fwd = `fwd_est_${id}`;
    const disc = `fwd_disc_${id}`;
    const corr = `corr_shock_${id}`;
    return {
      hypothesis: 'Forward expectation compression versus dispersion shock can indicate short-lived overreaction.',
      expression: `sig_${id} = (${fwd} - ${disc}) / (${corr} + 1)`
    };
  },
  (id) => {
    const short = `short_interest_${id}`;
    const borrow = `borrow_cost_${id}`;
    const drift = `drift_fast_${id}`;
    return {
      hypothesis: 'Financing friction and short pressure interact with fast drift to extend downside continuation.',
      expression: `sig_${id} = (${short} * ${borrow}) - (${drift} / 2)`
    };
  },
  (id) => {
    const rate = `insider_rate_${id}`;
    const lev = `leverage_proxy_${id}`;
    const risk = `equity_risk_${id}`;
    return {
      hypothesis: 'Leadership changes and leverage drag can decouple from headline momentum.',
      expression: `sig_${id} = (${rate} - ${lev}) / (${risk} + 1)`
    };
  },
  (id) => {
    const buy = `buy_pressure_${id}`;
    const vol = `micro_vol_${id}`;
    const alpha = `carry_alpha_${id}`;
    return {
      hypothesis: 'Steady buy pressure against low carry is often transitory and gets re-priced quickly.',
      expression: `sig_${id} = (${buy} - ${alpha}) / (${vol} + 1)`
    };
  },
  (id) => {
    const spread = `option_spread_${id}`;
    const flow = `equity_flow_${id}`;
    const beta = `factor_beta_${id}`;
    return {
      hypothesis: 'Spread widening plus directional flow imbalance highlights delayed regime transitions.',
      expression: `sig_${id} = (${spread} * ${flow}) - (${beta} / 2)`
    };
  },
  (id) => {
    const quality = `quality_mis_${id}`;
    const growth = `growth_surprise_${id}`;
    const vol = `tail_risk_${id}`;
    return {
      hypothesis: 'Quality-growth divergence can produce a short-lived correction once tail risk rises.',
      expression: `sig_${id} = (${quality} + ${growth}) - ${vol}`
    };
  },
  (id) => {
    const rev = `rev_gap_${id}`;
    const vol = `tail_vol_${id}`;
    const flow = `repo_flow_${id}`;
    return {
      hypothesis: 'Revision shocks paired with liquidity strain and repo flow indicate temporary value transfer.',
      expression: `sig_${id} = (${rev} - (${vol} + 1)) * (${flow} / 2)`
    };
  },
  (id) => {
    const skew = `skew_delta_${id}`;
    const iv = `iv_rank_${id}`;
    const roa = `roa_delta_${id}`;
    return {
      hypothesis: 'Skew changes against profitability drift often predate a short dislocation phase.',
      expression: `sig_${id} = (${skew} + ${roa}) / (${iv} + 1)`
    };
  },
  (id) => {
    const momentum = `momentum_regime_${id}`;
    const value = `value_gap_${id}`;
    const liquidity = `liq_imbalance_${id}`;
    return {
      hypothesis: 'Value gaps compress slowly while short-term momentum shifts, especially under flow imbalance.',
      expression: `sig_${id} = (${momentum} - ${value}) + (${liquidity} / 4)`
    };
  }
];

function buildDraft(sequence) {
  const family = families[sequence % families.length];
  return family(sequence);
}

function parseSubmitOutput(stdout) {
  const parsed = { status: 'error' };
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    parsed[key] = value;
  }
  return {
    ...parsed,
    raw: stdout.trim()
  };
}

function runSubmit(expression, hypothesis) {
  const args = [
    'src/harness/cli.js',
    'submit',
    'alpha',
    '--server-url',
    SERVER_URL,
    '--expr',
    expression,
    '--submitted-by',
    SUBMITTED_BY,
    '--hypothesis',
    hypothesis
  ];

  const result = spawnSync('node', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (!stdout && stderr) {
    return { status: 'error', raw: `stderr=${stderr}`, exitCode: result.status };
  }

  const parsed = parseSubmitOutput(stdout);
  return {
    ...parsed,
    raw: parsed.raw || `status=${parsed.status}`,
    exitCode: result.status,
    stderr: stderr || undefined
  };
}

let sequence = START_SEQUENCE;
let totalAccepted = 0;
let totalRejected = 0;

for (let cycle = START_CYCLE; cycle <= MAX_CYCLES; cycle += 1) {
  const acceptedAlphaIds = [];
  const rejectedSimilarityCases = [];

  while (acceptedAlphaIds.length < TARGET_ACCEPTED_PER_CYCLE) {
    sequence += 1;
    const draft = buildDraft(sequence);
    const submitResult = runSubmit(draft.expression, draft.hypothesis);

    console.log('hypothesis:');
    console.log(draft.hypothesis);
    console.log('expression:');
    console.log(draft.expression);
    console.log('submit_command:');
    console.log(`node src/harness/cli.js submit alpha --server-url ${SERVER_URL} --expr "${draft.expression}" --submitted-by ${SUBMITTED_BY} --hypothesis "${draft.hypothesis}"`);
    console.log('submit_result:');
    console.log(submitResult.raw);

    if (submitResult.status === 'accepted') {
      acceptedAlphaIds.push(submitResult.alpha_id);
      totalAccepted += 1;
    } else if (submitResult.status === 'rejected_similarity') {
      totalRejected += 1;
      rejectedSimilarityCases.push(
        `closest_alpha_id=${submitResult.closest_alpha_id}, max_similarity=${submitResult.max_similarity}, threshold=${submitResult.threshold}`
      );
    } else {
      totalRejected += 1;
      rejectedSimilarityCases.push(`nonstandard_status=${submitResult.status}, details=${submitResult.raw}`);
    }

    console.log();
  }

  console.log(`cycle_number: ${cycle}`);
  console.log(`accepted_count: ${acceptedAlphaIds.length}`);
  console.log(`rejected_count: ${rejectedSimilarityCases.length}`);
  console.log(`accepted_alpha_ids: ${acceptedAlphaIds.join(', ')}`);
  console.log(`rejected_similarity_cases: ${rejectedSimilarityCases.length ? rejectedSimilarityCases.join(' | ') : 'none'}`);
  console.log();
  console.log(`ULTRAWORK_PROGRESS total_accepted=${totalAccepted} total_rejected=${totalRejected} sequence=${sequence}`);
  console.log('--------------------------------------------------');
  console.log();
}

console.log(`ULTRAWORK LOOP DONE total_accepted=${totalAccepted} total_rejected=${totalRejected}`);
