import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextPatchVersion } from './bump-miniapp-version.mjs';

test('increments the patch version by one', () => {
  assert.equal(nextPatchVersion('1.0.0'), '1.0.1');
  assert.equal(nextPatchVersion('2.7.9'), '2.7.10');
});

test('rejects invalid semantic versions', () => {
  assert.throws(() => nextPatchVersion('1.0'), /Invalid package version/);
  assert.throws(() => nextPatchVersion('v1.0.0'), /Invalid package version/);
});
