import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFingerprintSteeringPayload,
  buildGhostSteeringPayload,
  fingerprintIdFromSelection,
  fingerprintSelectionValue,
} from '../src/index.ts';

test('buildFingerprintSteeringPayload emits the server fingerprint contract', () => {
  assert.deepEqual(
    buildFingerprintSteeringPayload({ id: 'editorial-mono', targetPath: '.' }),
    { fingerprint: { id: 'editorial-mono', targetPath: '.' } },
  );
});

test('buildFingerprintSteeringPayload never emits stale directionId steering', () => {
  const payload = buildFingerprintSteeringPayload({ id: 'editorial-mono' });
  assert.ok(payload);
  assert.equal('directionId' in payload, false);
});

test('fingerprint selection helpers round-trip explicit catalog picks', () => {
  const selection = fingerprintSelectionValue('editorial-mono');
  assert.equal(selection, 'fingerprint:editorial-mono');
  assert.equal(fingerprintIdFromSelection(selection), 'editorial-mono');
  assert.equal(fingerprintIdFromSelection('legacy-direction'), null);
});

test('buildGhostSteeringPayload emits the server ghost contract', () => {
  assert.deepEqual(
    buildGhostSteeringPayload({
      rootId: 'retail-dashboard',
      targetPath: 'apps/demo',
    }),
    {
      ghost: {
        rootId: 'retail-dashboard',
        targetPath: 'apps/demo',
      },
    },
  );
});
