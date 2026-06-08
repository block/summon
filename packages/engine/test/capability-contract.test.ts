import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAPABILITY_BINDING_SPECS,
  CAPABILITY_TRIGGER_SPECS,
  buildCapabilitiesBlock,
  compileCapabilityContract,
  formatCapabilityProtocolContract,
} from '../src/index.ts';

test('capability protocol contract includes every trigger and binding spec', () => {
  const text = formatCapabilityProtocolContract();

  for (const spec of CAPABILITY_TRIGGER_SPECS) {
    assert.match(text, new RegExp(spec.legacyAttribute));
    assert.match(text, new RegExp(`data-summon-resource-trigger="${spec.resourceTriggerValue}"`));
  }
  for (const spec of CAPABILITY_BINDING_SPECS) {
    assert.match(text, new RegExp(spec.attribute));
  }
});

test('capability compiler returns prompt, pack, intent names, and validation metadata', () => {
  const contract = compileCapabilityContract({
    intents: [
      {
        name: 'search',
        description: 'Run a search.',
        argsSchema: '{query: string}',
        stateShape: '{searching: boolean, results: any[] | null, searchError: string | null}',
        kind: 'resource',
        triggers: ['submit', 'mount'],
        stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
        resultSchema: '{title: string}[]',
        defaultDataShape: '[]',
        defaultData: [],
      },
    ],
  });

  assert.deepEqual(contract.intentNames, ['search']);
  assert.deepEqual(contract.validationCapabilities, [
    {
      name: 'search',
      kind: 'resource',
      triggers: ['submit', 'mount'],
      stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
    },
  ]);
  assert.deepEqual(contract.initialState, {
    searching: false,
    results: [],
    searchError: null,
  });
  assert.equal(contract.promptBlock?.id, 'capabilities');
  assert.match(contract.promptBlock?.text ?? '', /Available data resources/);
});

test('capabilities block renders generated protocol docs', () => {
  const text = buildCapabilitiesBlock({
    intents: [
      {
        name: 'search',
        description: 'Run a search.',
        argsSchema: '{query: string}',
        stateShape: '{searching: boolean, results: any[] | null, searchError: string | null}',
        kind: 'resource',
        triggers: ['submit', 'mount'],
        stateKeys: { loading: 'searching', data: 'results', error: 'searchError' },
        resultSchema: '{title: string}[]',
        defaultDataShape: '[]',
      },
    ],
    patterns: [
      {
        name: 'script search',
        code: '<button id="go">Go</button><script>document.getElementById("go")?.addEventListener("click", () => sandbox.emit("search", {query:"boots"}))</script>',
      },
      {
        name: 'declarative search',
        code: '<form data-summon-resource="search" data-summon-resource-trigger="submit"></form>',
      },
    ],
  });

  assert.match(text, /Available data resources/);
  assert.match(text, /Declarative-only interactivity/);
  assert.match(text, /data-summon-resource="<name>"/);
  assert.match(text, /\$alias\.loading/);
  assert.match(text, /Default data: `\[\]`/);
  assert.match(text, /Never hallucinate fetched rows/);
  assert.match(text, /data-summon-show="\$alias\.data"/);
  assert.match(text, /State keys: loading=searching, data=results, error=searchError/);
  assert.doesNotMatch(text, /data-summon-on-click="counter"/);
  assert.doesNotMatch(text, /data-summon-on-submit="submit"/);
  assert.doesNotMatch(text, /data-summon-on-click="log"/);
  assert.doesNotMatch(text, /document\.getElementById/);
  assert.match(text, /data-summon-resource="search"/);
});

test('capabilities block includes scripted guidance only with explicit allow policy', () => {
  const text = buildCapabilitiesBlock({
    intents: [
      {
        name: 'choose',
        description: 'Choose an option.',
        argsSchema: '{option: string}',
        stateShape: '{}',
      },
    ],
    patterns: [
      {
        name: 'script choose',
        code: '<button id="x">Pick</button><script>document.getElementById("x")?.addEventListener("click", () => sandbox.emit("choose", {option:"A"}))</script>',
      },
    ],
  }, { scriptPolicy: 'allow' });

  assert.match(text, /Rules for scripts/);
  assert.match(text, /document\.getElementById/);
});
