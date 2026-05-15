import { submitResult, reportFailure } from '../src/harness/client.js';

const serverUrl = 'http://127.0.0.1:3000';
const common = {
  leaseId: '409c7e8a-07ca-4d25-82d2-183043c26935',
  workerId: '새우탕',
  brainAccount: 'mask.27-e61ff11f@phuturemail.com',
  chromeProfile: 'C:/Users/user/AppData/Local/worldquant-chrome-profiles/saewootang'
};

const result84 = await submitResult(serverUrl, {
  alphaId: 84,
  ...common,
  settings: {
    nanHandling: 'ON', instrumentType: 'EQUITY', delay: 1, universe: 'TOP3000', truncation: 0.08,
    unitHandling: 'VERIFY', testPeriod: 'P3Y', pasteurization: 'ON', region: 'USA', language: 'FASTEXPR',
    decay: 4, neutralization: 'MARKET', visualization: false
  },
  metrics: {
    simulationStatus: 'WARNING', simulationProgress: null, alphaId: 'MPbwlaEz', sharpe: 1.78, fitness: 0.88,
    turnover: 0.6113, grade: 'INFERIOR',
    message: 'Incompatible unit for input of "power" at index 0, expected "Unit[]", found "Unit[CSPrice:2]"; Incompatible unit for input of "subtract" at index 1, expected "Unit[]", found "Unit[CSPrice:1]". <linkToCommonErrorMessages>Learn more</linkToCommonErrorMessages>',
    alphaFetchError: null, location: 'https://api.worldquantbrain.com/simulations/4jJuQIfqU4C5cAiYILr5Rvc'
  }
});
console.log(JSON.stringify({ alpha84: result84 }));

const failure85 = await reportFailure(serverUrl, {
  alphaId: 85,
  ...common,
  retryable: false,
  failureClass: 'simulation_error',
  failureMessage: 'Attempted to use inaccessible or unknown operator "ts_max". <linkToCommonErrorMessages>Learn more</linkToCommonErrorMessages>'
});
console.log(JSON.stringify({ alpha85: failure85 }));
