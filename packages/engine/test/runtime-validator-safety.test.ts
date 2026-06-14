import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHtmlFragment } from '../src/index.ts';
import {
  baseContext,
  codes,
} from './runtime-validator-fixtures.ts';

test('blocks static scripts and inline handlers', () => {
  const issues = validateHtmlFragment(
    '<button onclick="go()"><script>console.log(1)</script>Go</button>',
    baseContext,
  );
  assert.deepEqual(codes(issues), ['inline-handler', 'static-script']);
});

test('blocks interactive scripts when script policy is declarative-only', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="choose">Pick</button><script>sandbox.emit("choose", {"option":"A"})</script>',
    {
      mode: 'interactive',
      scriptPolicy: 'forbid',
      capabilities: [{ name: 'choose', triggers: ['click'] }],
    },
  );
  assert.deepEqual(codes(issues), ['script-not-granted']);
});

test('blocks interactive scripts by default without a scripted surface plan', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="choose">Pick</button><script>sandbox.emit("choose", {"option":"A"})</script>',
    {
      mode: 'interactive',
      capabilities: [{ name: 'choose', triggers: ['click'] }],
    },
  );
  assert.deepEqual(codes(issues), ['script-not-granted']);
});

test('rejects legacy scripted surface plan with allow policy', () => {
  const issues = validateHtmlFragment(
    '<button>Pick</button><script>sandbox.emit("choose", {"option":"A"})</script>',
    {
      mode: 'interactive',
      scriptPolicy: 'allow',
      surfacePlan: {
        purpose: 'explore',
        runtime: 'scripted',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
      } as never,
      capabilities: [{ name: 'choose', kind: 'action', triggers: ['click'] }],
    },
  );
  assert.deepEqual(codes(issues), ['script-not-granted', 'surface-script-policy-removed']);
});

test('blocks external assets and unsafe tags', () => {
  const issues = validateHtmlFragment(
    '<iframe srcdoc=""></iframe><img src="https://example.com/a.png"><div style="background:url(/x.png)"></div>',
    baseContext,
  );
  assert.deepEqual(codes(issues), [
    'external-url',
    'external-url',
    'unsafe-attribute',
    'unsafe-tag',
    'unsafe-tag',
  ]);
});

test('blocks unknown declarative and script intents', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="delete_all">Delete</button><script>sandbox.emit("summon", {})</script>',
    {
      ...baseContext,
      mode: 'interactive',
      scriptPolicy: 'allow',
      surfacePlan: {
        purpose: 'explore',
        runtime: 'scripted',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
      } as never,
    },
  );
  assert.deepEqual(codes(issues), [
    'script-not-granted',
    'surface-script-policy-removed',
    'unknown-intent',
    'unknown-intent',
  ]);
});

test('rejects sandbox.emit even when the intent name is granted', () => {
  const issues = validateHtmlFragment(
    '<script>sandbox.emit("search", { query: "boots" })</script>',
    {
      mode: 'interactive',
      scriptPolicy: 'allow',
      surfacePlan: {
        purpose: 'explore',
        runtime: 'scripted',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
      } as never,
      capabilities: [{ name: 'search', triggers: ['mount'] }],
    },
  );
  assert.deepEqual(codes(issues), ['script-not-granted', 'surface-script-policy-removed']);
});
