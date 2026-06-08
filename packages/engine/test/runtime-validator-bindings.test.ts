import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHtmlFragment } from '../src/index.ts';
import { baseContext, codes } from './runtime-validator-fixtures.ts';

test('accepts click, submit, and mount attributes only for matching triggers', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="choose">Pick</button><form data-summon-on-submit="search"></form><div data-summon-on-mount="search" data-summon-args=\'{"query":"boots"}\'></div>',
    {
      mode: 'interactive',
      capabilities: [
        { name: 'choose', triggers: ['click'] },
        { name: 'search', triggers: ['submit', 'mount'] },
      ],
    },
  );
  assert.deepEqual(issues, []);
});

test('rejects malformed data-summon-args JSON', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="choose" data-summon-args="{bad json}">Pick</button>',
    { ...baseContext, mode: 'interactive' },
  );
  assert.deepEqual(codes(issues), ['invalid-args-json']);
});

test('accepts declarative resource submit, mount, foreach, and safe attr bindings', () => {
  const issues = validateHtmlFragment(
    `<div data-summon-resource="search" data-summon-resource-as="s">
      <form data-summon-resource-trigger="submit">
        <input name="query">
        <button data-summon-attr-disabled="$s.loading">Go</button>
      </form>
      <p data-summon-show="$s.loading">Searching...</p>
      <p data-summon-show="$s.error" data-summon-bind="$s.error"></p>
      <ul data-summon-show="$s.data" data-summon-foreach="$s.data" data-summon-as="r"><template><li data-summon-bind="$r.title"></li></template></ul>
    </div>
    <div data-summon-resource="profile" data-summon-resource-as="p" data-summon-resource-trigger="mount" data-summon-args='{"username":"octocat"}'>
      <p data-summon-show="$p.loading">Loading...</p>
      <p data-summon-show="$p.error" data-summon-bind="$p.error"></p>
      <img data-summon-attr-src="$p.data.avatar" data-summon-attr-alt="$p.data.login">
      <ul data-summon-foreach="$p.data.repos" data-summon-as="repo"><template><li data-summon-bind="$repo.name"></li></template></ul>
    </div>`,
    {
      mode: 'interactive',
      capabilities: [
        {
          name: 'search',
          kind: 'resource',
          triggers: ['submit'],
          stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
        },
        {
          name: 'profile',
          kind: 'resource',
          triggers: ['mount'],
          stateKeys: { loading: 'profileLoading', data: 'profile', error: 'profileError' },
        },
      ],
    },
  );
  assert.deepEqual(issues, []);
});

test('warns when data resource UI omits lifecycle bindings without blocking', () => {
  const issues = validateHtmlFragment(
    `<form data-summon-resource="search" data-summon-resource-as="s" data-summon-resource-trigger="submit">
      <input name="query">
      <button>Go</button>
    </form>`,
    {
      mode: 'interactive',
      capabilities: [
        {
          name: 'search',
          kind: 'resource',
          triggers: ['submit'],
          stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
        },
      ],
    },
  );

  assert.equal(issues.some((issue) => issue.severity === 'block'), false);
  assert.deepEqual(codes(issues), [
    'resource-data-not-rendered',
    'resource-error-not-rendered',
    'resource-loading-not-rendered',
  ]);
});

test('rejects invalid resource declarations and unsafe attr bindings', () => {
  const issues = validateHtmlFragment(
    `<button data-summon-resource="choose" data-summon-resource-trigger="click">Bad</button>
     <div data-summon-resource="missing"></div>
     <form data-summon-resource="search" data-summon-resource-trigger="click" data-summon-on-click="choose">
       <button data-summon-attr-disabled="$search.loading">Go</button>
       <p data-summon-show="$search.loading">Loading...</p>
       <p data-summon-show="$search.error" data-summon-bind="$search.error"></p>
       <ul data-summon-show="$search.data" data-summon-foreach="$search.data" data-summon-as="r"><template><li data-summon-bind="$r.title"></li></template></ul>
     </form>
     <div data-summon-resource="slow" data-summon-resource-trigger="mount"></div>
     <a data-summon-attr-href="url">x</a>
     <div data-summon-attr-src="avatar"></div>`,
    {
      mode: 'interactive',
      capabilities: [
        { name: 'choose', kind: 'action', triggers: ['click'] },
        {
          name: 'search',
          kind: 'resource',
          triggers: ['submit'],
          stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
        },
        {
          name: 'slow',
          kind: 'resource',
          triggers: ['mount'],
          stateKeys: { loading: 'slowLoading' },
        },
      ],
    },
  );
  assert.deepEqual(codes(issues), [
    'bad-attr-binding-placement',
    'intent-trigger-not-granted',
    'mixed-resource-legacy-trigger',
    'non-resource-capability',
    'resource-state-keys-incomplete',
    'resource-trigger-without-resource',
    'unknown-resource',
    'unsafe-attr-binding',
  ]);
});

test('rejects declarative attributes for unknown or non-matching trigger grants', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="search">Search</button><div data-summon-on-mount="choose"></div><div data-summon-on-mount="missing"></div>',
    {
      mode: 'interactive',
      capabilities: [
        { name: 'choose', triggers: ['click'] },
        { name: 'search', triggers: ['submit', 'mount'] },
      ],
    },
  );
  assert.deepEqual(codes(issues), [
    'intent-trigger-not-granted',
    'intent-trigger-not-granted',
    'unknown-intent',
  ]);
});

test('accepts registered component placeholders', () => {
  const issues = validateHtmlFragment(
    `<section>
      <div data-summon-component="MetricCard" data-summon-component-id="revenue-card" data-summon-props='{"label":"Revenue","value":"$284,120"}'></div>
    </section>`,
    {
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'static',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
      components: [
        { name: 'MetricCard', surface: { data: 'embedded', authority: 'none' } },
      ],
    },
  );
  assert.deepEqual(issues, []);
});

test('rejects malformed component placeholders', () => {
  const issues = validateHtmlFragment(
    `<div data-summon-component="MetricCard" data-summon-component-id="duplicate" data-summon-props='{"label":"Revenue"}'>
       <div data-summon-component="MetricCard" data-summon-component-id="nested" data-summon-props='{"label":"Nested"}'></div>
     </div>
     <div data-summon-component="MetricCard" data-summon-component-id="duplicate" data-summon-props='{"label":"Again"}'></div>
     <div data-summon-component="Missing" data-summon-component-id="missing" data-summon-props='{}'></div>
     <div data-summon-component="MetricCard" data-summon-props='{}'></div>
     <div data-summon-component="MetricCard" data-summon-component-id="bad-props" data-summon-props="{bad}"></div>`,
    {
      mode: 'interactive',
      components: [
        { name: 'MetricCard', surface: { data: 'embedded', authority: 'none' } },
      ],
    },
  );
  assert.deepEqual(codes(issues), [
    'component-id-duplicate',
    'component-id-missing',
    'component-props-invalid',
    'nested-component',
    'unknown-component',
  ]);
});

test('rejects component islands that exceed the selected surface plan', () => {
  const issues = validateHtmlFragment(
    `<div data-summon-component="HostChart" data-summon-component-id="chart" data-summon-props='{"query":"launch"}'></div>`,
    {
      mode: 'static',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'static',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
      components: [
        { name: 'HostChart', surface: { data: 'host-resource', authority: 'read' } },
      ],
    },
  );
  assert.deepEqual(codes(issues), [
    'surface-authority-exceeded',
    'surface-data-exceeded',
    'surface-runtime-exceeded',
  ]);
});
