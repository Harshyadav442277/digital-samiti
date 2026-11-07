import './check-journeys.mjs';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://localhost:3017';
assert.equal((await fetch(origin+'/api/autopay/run')).status,401);
assert.equal((await fetch(origin+'/api/auth/get-session')).status,200);
console.log('PASS: protected scheduler and authentication session endpoint.');
