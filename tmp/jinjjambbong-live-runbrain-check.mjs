import { runBrainSimulation } from '../src/harness/brain.js';

const result = await runBrainSimulation({
  brainAccount: 'oceanic.graph782@phuturemail.com',
  chromeProfile: 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong',
  expression: 'rank(ts_delta(anl4_adjusted_netincome_ft, 20)) + rank(vwap - close)',
  headed: false
});

console.log(JSON.stringify(result, null, 2));
