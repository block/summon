import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildToolsBlock,
  compileToolContract,
  formatToolProtocolContract,
} from '../src/index.ts';

test('tool protocol contract documents Surface Document host bridge', () => {
  const text = formatToolProtocolContract();

  assert.match(text, /Surface Document host bridge/);
  assert.match(text, /host-bridge:summon/);
  assert.match(text, /callTool/);
  assert.match(text, /getState/);
  assert.match(text, /onState/);
  assert.match(text, /state\(\)/);
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

test('tools block renders Surface Document protocol docs', () => {
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
  });

  assert.match(text, /Available data resources/);
  assert.match(text, /Surface Document may use host tools/);
  assert.match(text, /host-bridge:summon/);
  assert.match(text, /callTool/);
  assert.match(text, /getState/);
  assert.match(text, /onState/);
  assert.match(text, /state\(\)/);
  assert.match(text, /Default data: `\[\]`/);
  assert.match(text, /State keys: loading=searching, data=results, error=searchError, empty=noResults/);
  assert.match(text, /Action state: pending=savePending, done=saveDone, error=saveError/);
  assert.doesNotMatch(text, /unsupported runtime/);
});

test('tools block ignores unsupported script patterns', () => {
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

  assert.match(text, /Host bridge in main\.js/);
  assert.doesNotMatch(text, /script choose/);
  assert.doesNotMatch(text, /document\.getElementById\("x"\)/);
});
