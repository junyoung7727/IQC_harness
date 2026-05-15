import { preflightBrainAccess } from '../src/harness/brain.js';

const result = await preflightBrainAccess({
  brainAccount: 'oceanic.graph782@phuturemail.com',
  chromeProfile: 'C:\\Users\\user\\AppData\\Local\\worldquant-chrome-profiles\\jinjjambbong',
  headed: false
});

console.log(JSON.stringify(result, null, 2));
