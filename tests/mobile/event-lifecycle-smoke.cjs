// Run from repo root after `npm ci` in src/mobile/kzndoghouse-app:
// node tests/mobile/event-lifecycle-smoke.cjs
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../src/mobile/kzndoghouse-app');
const ts = require(path.join(root, 'node_modules', 'typescript'));
const src = fs.readFileSync(path.join(root, 'src/lib/events.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
vm.runInNewContext(js, { exports: moduleExports, require: () => ({ supabase: {} }), console });
const now = Date.parse('2026-11-01T12:00:00Z');
const event = (start, end) => ({ start_at: start, end_at: end,
  volunteer_signup_enabled: true, max_volunteers: 10 });
const upcoming = event('2026-11-01T13:00:00Z', '2026-11-01T14:00:00Z');
const ongoing = event('2026-11-01T11:00:00Z', '2026-11-01T13:00:00Z');
const ended = event('2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z');
assert.equal(moduleExports.hasEnded(upcoming, now), false);
assert.equal(moduleExports.hasEnded(ongoing, now), false);
assert.equal(moduleExports.hasEnded(ended, now), true);
assert.equal(moduleExports.getSignupState(upcoming, null, 0, now), 'open');
assert.equal(moduleExports.getSignupState(ongoing, null, 0, now), 'started');
assert.equal(moduleExports.getSignupState(ended, null, 0, now), 'ended');
assert.equal(moduleExports.getSignupState(ended, { status: 'Confirmed' }, 1, now), 'ended');
assert.equal(moduleExports.hasEnded(event('2026-10-31T12:00:00Z', null), now), true);
assert.equal(moduleExports.hasEnded(event('2026-11-01T11:00:00Z', null), now), false);
assert.equal(moduleExports.isCheckInOpen(ended, now), false);
console.log('PASS: upcoming, ongoing, ended, assigned-past, legacy-end and check-in timing');
