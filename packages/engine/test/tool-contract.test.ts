import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildToolsBlock,
  compileToolContract,
  formatToolProtocolContract,
} from '../src/index.ts';

test('tool protocol contract documents Arrow host bridge', () => {
  const text = formatToolProtocolContract();

  assert.match(text, /Arrow host bridge/);
  assert.match(text, /host-bridge:summon/);
  assert.match(text, /callTool/);
  assert.match(text, /getState/);
  assert.match(text, /onState/);
  assert.match(text, /reactive\(\)/);
});

test('tool compiler returns prompt, pack, tool names, and validation metadata', () => {
  const contract = compileToolContract({
    tools: [
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

  assert.deepEqual(contract.toolNames, ['search', 'save']);
  assert.deepEqual(contract.validationTools, [
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
  assert.equal(contract.promptBlock?.id, 'tools');
  assert.match(contract.promptBlock?.text ?? '', /Available data resources/);
});

test('tools block renders Arrow-native protocol docs', () => {
  const text = buildToolsBlock({
    tools: [
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
        name: 'arrow search',
        code: 'import { callTool, onState } from "host-bridge:summon";\nconst run = () => callTool("search", { query: "boots" });\nonState(() => {});',
      },
    ],
  });

  assert.match(text, /Available data resources/);
  assert.match(text, /Arrow-native interactivity/);
  assert.match(text, /host-bridge:summon/);
  assert.match(text, /reactive\(\)/);
  assert.match(text, /callTool/);
  assert.match(text, /getState/);
  assert.match(text, /onState/);
  assert.match(text, /Default data: `\[\]`/);
  assert.match(text, /Never hallucinate fetched rows/);
  assert.match(text, /Render "no results" from the declared empty key/);
  assert.match(text, /State keys: loading=searching, data=results, error=searchError, empty=noResults/);
  assert.match(text, /Action state: pending=savePending, done=saveDone, error=saveError/);
  assert.match(text, /Controlled actions expose host-owned pending\/done\/error keys/);
  assert.doesNotMatch(text, /document\.getElementById/);
  assert.match(text, /arrow search/);
});

test('tools block filters script patterns', () => {
  const text = buildToolsBlock({
    tools: [
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
  });

  assert.match(text, /Host tool bridge/);
  assert.doesNotMatch(text, /Rules for scripts/);
  assert.doesNotMatch(text, /document\.getElementById/);
});
