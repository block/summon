import assert from 'node:assert/strict';
import test from 'node:test';
import { compileArtifactHtml } from '../src/index.ts';
import { baseContext, codes } from './runtime-validator-fixtures.ts';

test('compiler canonicalizes malformed browser HTML', () => {
  const result = compileArtifactHtml('<p><div>Inside</div></p>', baseContext);

  assert.equal(result.compilerVersion, 'summon-artifact-compiler-v2');
  assert.equal(codes(result.issues).includes('unsafe-tag'), false);
  assert.notEqual(result.html, '<p><div>Inside</div></p>');
  assert.match(result.html, /<div>Inside<\/div>/);
});

test('compiler handles slash-after-tag and quoted-greater-than edge cases', () => {
  const script = compileArtifactHtml('<script/src=x>alert(1)</script>', {
    mode: 'interactive',
    capabilities: [{ name: 'choose', triggers: ['click'] }],
  });
  assert.ok(codes(script.issues).includes('script-not-granted'));

  const iframe = compileArtifactHtml('<iframe/srcdoc="<p>x</p>"></iframe>', baseContext);
  assert.ok(codes(iframe.issues).includes('unsafe-tag'));

  const img = compileArtifactHtml('<img alt=">" src="https://example.test/a.png">', baseContext);
  assert.deepEqual(codes(img.issues), ['external-url']);
});

test('compiler decodes HTML entities before URL checks', () => {
  const jsUrl = compileArtifactHtml('<a href="javascript&#58;alert(1)">bad</a>', baseContext);
  assert.deepEqual(codes(jsUrl.issues), ['external-url']);

  const assetUrl = compileArtifactHtml('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">', baseContext);
  assert.deepEqual(assetUrl.issues, []);
});

test('compiler ignores comments and escaped raw-text false positives', () => {
  const result = compileArtifactHtml(
    '<p>&lt;script&gt;safe text&lt;/script&gt;</p><!-- <iframe srcdoc=""> -->',
    baseContext,
  );

  assert.deepEqual(result.issues, []);
  assert.match(result.html, /&lt;script&gt;safe text&lt;\/script&gt;/);
});

test('compiler blocks unsafe SVG and executable SVG escapes', () => {
  const foreignObject = compileArtifactHtml('<svg viewBox="0 0 10 10"><foreignObject><div>x</div></foreignObject></svg>', baseContext);
  assert.ok(codes(foreignObject.issues).includes('unsafe-tag'));

  const svgScript = compileArtifactHtml('<svg><script>alert(1)</script></svg>', { mode: 'interactive' });
  assert.ok(codes(svgScript.issues).includes('script-not-granted'));
});

test('compiler blocks CSS imports and escaped external url values', () => {
  const result = compileArtifactHtml(
    '<style>@import url("data:text/css,body{}"); .x{background:url("\\68 ttps://example.test/a.png")}</style>',
    baseContext,
  );

  assert.deepEqual(codes(result.issues), ['css-import', 'external-url']);
});

test('compiler accepts declarative local state and motion primitives', () => {
  const result = compileArtifactHtml(
    '<div data-summon-local="{&quot;tab&quot;:&quot;overview&quot;,&quot;expanded&quot;:false}" data-summon-motion="enter:rise; update:pulse" data-summon-transition="fade-slide"><button data-summon-set="tab=activity" data-summon-class-active="tab == &quot;activity&quot;">Activity</button><button data-summon-toggle="expanded" data-summon-attr-disabled="!expanded">Toggle</button><section data-summon-show="tab == &quot;activity&quot;"></section><section data-summon-hide="expanded"></section></div>',
    {
      mode: 'interactive',
      scriptPolicy: 'forbid',
    },
  );

  assert.deepEqual(result.issues, []);
});
