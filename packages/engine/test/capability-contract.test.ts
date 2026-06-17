import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCapabilitiesBlock,
  compileCapabilityContract,
  formatCapabilityProtocolContract,
} from '../src/index.ts';

test('capability protocol contract documents Arrow host bridge', () => {
  const text = formatCapabilityProtocolContract();

  assert.match(text, /Arrow host bridge/);
  assert.match(text, /host-bridge:summon/);
  assert.match(text, /invoke/);
  assert.match(text, /getState/);
  assert.match(text, /onState/);
  assert.match(text, /reactive\(\)/);
  assert.doesNotMatch(text, /data-summon-on-click/);
  assert.doesNotMatch(text, /data-summon-resource-trigger/);
  assert.doesNotMatch(text, /data-summon-bind/);
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
        stateKeys: { loading: 'searching', data: 'results', error: 'searchError', empty: 'noResults' },
        resultSchema: '{title: string}[]',
        defaultDataShape: '[]',
        defaultData: [],
      },
      {
        name: 'save',
        description: 'Save a choice.',
        argsSchema: '{choice: string}',
        stateShape: '{savedChoice: string | null}',
        kind: 'action',
        triggers: ['click'],
        actionStateKeys: { pending: 'savePending', done: 'saveDone', error: 'saveError' },
      },
    ],
  });

  assert.deepEqual(contract.intentNames, ['search', 'save']);
  assert.deepEqual(contract.validationCapabilities, [
    {
      name: 'search',
      kind: 'resource',
      triggers: ['submit', 'mount'],
      stateKeys: { loading: 'searching', data: 'results', error: 'searchError', empty: 'noResults' },
    },
    {
      name: 'save',
      kind: 'action',
      triggers: ['click'],
      actionStateKeys: { pending: 'savePending', done: 'saveDone', error: 'saveError' },
    },
  ]);
  assert.deepEqual(contract.initialState, {
    searching: false,
    results: [],
    searchError: null,
    noResults: false,
    savePending: false,
    saveDone: false,
    saveError: null,
  });
  assert.equal(contract.promptBlock?.id, 'capabilities');
  assert.match(contract.promptBlock?.text ?? '', /Available data resources/);
});

test('capabilities block renders Arrow-native protocol docs', () => {
  const text = buildCapabilitiesBlock({
    intents: [
      {
        name: 'search',
        description: 'Run a search.',
        argsSchema: '{query: string}',
        stateShape: '{searching: boolean, results: any[] | null, searchError: string | null}',
        kind: 'resource',
        triggers: ['submit', 'mount'],
        stateKeys: { loading: 'searching', data: 'results', error: 'searchError', empty: 'noResults' },
        resultSchema: '{title: string}[]',
        defaultDataShape: '[]',
      },
      {
        name: 'save',
        description: 'Save a choice.',
        argsSchema: '{choice: string}',
        stateShape: '{savedChoice: string | null}',
        kind: 'action',
        triggers: ['click'],
        actionStateKeys: { pending: 'savePending', done: 'saveDone', error: 'saveError' },
      },
    ],
    patterns: [
      {
        name: 'script search',
        code: '<button id="go">Go</button><script>document.getElementById("go")?.addEventListener("click", () => sandbox.emit("search", {query:"boots"}))</script>',
      },
      {
        name: 'legacy declarative search',
        code: '<form data-summon-resource="search" data-summon-resource-trigger="submit"></form>',
      },
      {
        name: 'arrow search',
        code: 'import { invoke, onState } from "host-bridge:summon";\nconst run = () => invoke("search", { query: "boots" });\nonState(() => {});',
      },
    ],
  });

  assert.match(text, /Available data resources/);
  assert.match(text, /Arrow-native interactivity/);
  assert.match(text, /host-bridge:summon/);
  assert.match(text, /reactive\(\)/);
  assert.match(text, /invoke/);
  assert.match(text, /getState/);
  assert.match(text, /onState/);
  assert.match(text, /Default data: `\[\]`/);
  assert.match(text, /Never hallucinate fetched rows/);
  assert.match(text, /Render "no results" from the declared empty key/);
  assert.match(text, /State keys: loading=searching, data=results, error=searchError, empty=noResults/);
  assert.match(text, /Action state: pending=savePending, done=saveDone, error=saveError/);
  assert.match(text, /Controlled actions expose host-owned pending\/done\/error keys/);
  assert.doesNotMatch(text, /data-summon-on-click="counter"/);
  assert.doesNotMatch(text, /data-summon-on-submit="submit"/);
  assert.doesNotMatch(text, /data-summon-on-click="log"/);
  assert.doesNotMatch(text, /document\.getElementById/);
  assert.doesNotMatch(text, /data-summon-resource="search"/);
  assert.match(text, /arrow search/);
});

test('capabilities block filters script patterns even with script allow policy', () => {
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

  assert.match(text, /Script policy — Arrow host bridge only/);
  assert.doesNotMatch(text, /Rules for scripts/);
  assert.doesNotMatch(text, /document\.getElementById/);
});
