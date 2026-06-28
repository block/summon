import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

const packageAliases = {
  summon: 'summon',
  '@anarchitecture/summon': 'summon',
  'summon-server': 'summon-server',
  '@anarchitecture/summon-server': 'summon-server',
  'summon-react': 'summon-react',
  '@anarchitecture/summon-react': 'summon-react',
};

const requested = process.argv.slice(2).map((name) => packageAliases[name] ?? name);
const targets = requested.length > 0 ? requested : ['summon', 'summon-server', 'summon-react'];

const textExtensions = new Set(['.js', '.d.ts']);
const copiedExtensions = new Set(['.js', '.d.ts', '.css']);

const coreExports = {
  '.': {
    values: {
      './_internal/engine/index.js': [
          'compileSurfaceContractView',
          'compileSurfacePolicy',
          'isArrowSurfaceArtifact',
          'normalizeArrowSurfaceArtifact',
          'normalizeSurfacePolicy',
          'surfaceContractViewFromCompiledPolicy',
          'SURFACE_PERSISTENCE_VALUES',
          'SURFACE_PURPOSE_VALUES',
          'SURFACE_TIER_VALUES',
          'validateArrowSurfaceArtifact',
        ],
      './_internal/host/index.js': [
        'createToolRegistry',
        'defineAction',
        'defineApprovalAction',
        'defineTool',
        'defineDataResource',
        'defineToolHandler',
        'defineWorkerAction',
        'defineWorkerResource',
        'ToolArgsError',
        'PolicyEngine',
      ],
    },
    types: {
      './_internal/engine/index.js': [
        'ToolBindingSpec',
        'ToolKind',
        'ToolPack',
        'ToolPattern',
        'ToolStateKeys',
        'ToolSurface',
        'ToolTrigger',
        'ToolTriggerSpec',
        'SurfaceEvent',
        'SurfaceEventLine',
          'ArrowArtifactValidationOptions',
          'ArrowNetworkPolicy',
          'ArrowSurfaceArtifact',
        'CompileSurfaceContractViewOptions',
        'CompiledSurfacePolicy',
        'CompileSurfacePolicyOptions',
        'ToolSpec',
        'NormalizedSurfacePolicy',
        'SurfaceContractLayout',
        'SurfaceContractTool',
        'SurfaceContractView',
          'SurfacePersistence',
          'SurfacePolicy',
          'SurfaceNetwork',
          'SurfacePurpose',
        'SurfaceTier',
      ],
      './_internal/host/index.js': [
        'ActionDefinition',
        'ApprovalActionDefinition',
        'ApprovalDecision',
        'ApprovalStateKeys',
        'ToolDefinition',
        'ToolRegistry',
        'DataResourceDefinition',
        'ToolContext',
          'ToolHandlerEntry',
          'ToolHandler',
          'PolicyEngineOptions',
          'PolicyDispatchResult',
          'StateShapeDescriptor',
        'TypedToolHandlerEntry',
      ],
    },
  },
  './engine': {
    values: {
      './_internal/engine/index.js': [        'DEFAULT_SUMMON_OUTPUT_RUNTIME',
        'DEFAULT_SURFACE_PLAN',
        'DEFAULT_VALIDATION_LIMITS',
        'RUNTIME_PROFILES',
        'OPPORTUNISTIC_TOKENS',
        'OPT_OUT_GROUPS',
        'OPT_OUT_TOKENS',
        'ProtocolParseError',
        'REQUIRED_TOKENS',
          'SHADOW_TOKENS',
          'SUMMON_ARROW_ARTIFACT_INSTRUCTIONS',
          'SUMMON_FIXED_INSTRUCTIONS',
          'SUMMON_OUTPUT_RUNTIME_VALUES',
          'SUMMON_PROTOCOL_VERSION',
          'SURFACE_AUTHORITY_VALUES',
          'SURFACE_DATA_VALUES',
          'SURFACE_NETWORK_VALUES',
          'SURFACE_PERSISTENCE_VALUES',
        'SURFACE_PURPOSE_VALUES',        'StreamGraph',
        'TOKEN_CONTRACT',
        'buildToolsBlock',
        'buildLayoutBlock',
        'buildSurfaceContractBlock',
        'buildSurfacePlanBlock',
        'compileToolContract',
        'compileSurfaceContractView',
        'compileSurfacePolicy',
        'compileSystemContracts',
        'compileTokenContract',        'contractIssue',
        'arrowArtifactFromBundle',
        'GENERATION_FINGERPRINT_SELECTION_PREFIX',
        'buildFingerprintSteeringPayload',
        'buildGhostSteeringPayload',
        'createArrowBundleJsonSchema',
        'createHtmlBundleJsonSchema',
        'createProtocolHardener',
        'defaultTriggersForKind',        'formatToolProtocolContract',
        'formatTokenContract',
        'fingerprintIdFromSelection',
        'fingerprintSelectionValue',
        'hasCompleteResourceStateKeys',
          'htmlArtifactFromBundle',
          'hintsForContractIssue',
          'inferSurfacePlan',
          'isArrowSurfaceArtifact',
          'isHtmlOutputRuntime',
          'isHtmlSurfaceArtifact',
          'isProtocolLine',
          'normalizeArrowBundle',
          'normalizeArrowSurfaceArtifact',          'normalizeSurfacePolicy',
        'normalizeHtmlBundle',
        'normalizeHtmlSurfacePatch',
        'normalizeSurfacePlan',
        'suggestSurfacePlan',
        'normalizeValidationLimits',
        'parseDefinedTokens',
        'parseProtocolLine',
        'parseProtocolLineStrict',
        'parseTokenValues',
        'runtimeProfile',
        'surfaceContractViewFromCompiledPolicy',          'SURFACE_TIER_VALUES',
          'validateArrowSurfaceArtifact',
          'validateDirection',
        'validateProtocolLine',
        'withIssueSeverity',
      ],
    },
    types: {
        './_internal/engine/index.js': [
          'ArtifactLine',
          'ArrowArtifactValidationOptions',
          'ArrowNetworkPolicy',
          'ArrowSurfaceArtifact',
          'HtmlSurfaceArtifact',
          'HtmlSurfacePatch',
          'SummonArrowBundle',
          'SummonHtmlBundle',
          'SummonOutputRuntime',
          'RuntimeDelivery',
          'RuntimeFormat',
          'RuntimeProfile',
          'RuntimeTrust',
          'ToolBindingSpec',        'ToolKind',
        'ToolPack',
        'ToolPattern',
        'ToolStateKeys',
        'ToolSurface',
        'ToolTrigger',
        'ToolTriggerSpec',
        'CompiledToolContract',
        'CompiledSurfacePolicy',
        'CompiledSystemContracts',
        'CompiledTokenContract',
        'CompileSurfaceContractViewOptions',
        'CompileSurfacePolicyOptions',
        'ContractIssue',
        'ContractIssueSeverity',
        'ContractIssueSource',
        'ContractPromptBlock',
        'DataResourceSpec',
        'DirectionOpts',
        'GhostGenerationContext',
        'GhostGenerationSource',
        'GenerationFingerprintSteeringInput',
        'GenerationFingerprintSteeringPayload',
        'GenerationGhostSteeringInput',
        'GenerationGhostSteeringPayload',
        'GenerationSteeringPayload',
        'GhostTokenSourceKind',
        'ToolSpec',
        'MetaLine',
        'NormalizedSurfacePolicy',
        'OptOutGroup',
        'OptOutValue',
        'SurfaceEvent',
        'SurfaceEventLine',
        'ProtocolHardener',
        'ProtocolHardenerOptions',
        'ProtocolHardenerResult',
        'ProtocolLine',
        'ProtocolParseErrorCode',
        'ProtocolParseOptions',
        'ProtocolSkipMetaValue',        'StreamGraphArtifact',
        'StreamGraphHealth',
        'StreamGraphSnapshot',
        'SummonLayout',
        'SummonLayoutSlot',
        'SurfaceAuthority',
        'SurfaceContractLayout',
        'SurfaceContractSurface',
        'SurfaceContractTool',
        'SurfaceContractView',
          'SurfaceData',
          'SurfaceNetwork',
          'SurfacePersistence',
        'SurfacePolicy',
        'SurfacePlan',        'SurfacePlanInferenceInput',
        'SurfacePlanMode',
        'SurfacePurpose',        'SurfaceTier',
        'SystemContractInput',
        'TokenContract',
        'TokenContractInput',
        'TokenKind',
        'TokenSpec',
        'ValidationTool',
        'ValidationContext',
        'ValidationLimits',
        'ValidationResult',
      ],
    },
  },
  './host': {
    values: {
      './_internal/host/index.js': [
        'HTML_IFRAME_SANDBOX',
        'ToolArgsError',
        'PolicyEngine',
        'SUMMON_SURFACE_ENVELOPE_VERSION',
        'bindEndpoint',
        'buildHtmlSandboxCsp',
        'buildHtmlSandboxSrcdoc',
        'consumeSurfaceStream',
        'createToolRegistry',
        'createSurfaceEnvelope',
        'defineAction',
        'defineApprovalAction',
        'defineTool',
        'defineDataResource',
        'defineToolHandler',
        'defineWorkerAction',
        'defineWorkerResource',
        'isSurfaceEnvelope',
        'mountInlineSurface',
        'parseHtmlSandboxMessage',
        'parseSurfaceEnvelope',
      ],
    },
    types: {
      './_internal/host/index.js': [
        'ActionDefinition',
        'ApprovalActionDefinition',
          'ApprovalDecision',
          'ApprovalStateKeys',
          'Artifact',
          'ArrowNetworkPolicy',
          'ArrowSurfaceArtifact',
          'HtmlSandboxMessage',
          'HtmlSandboxSrcdocOptions',
          'InlineSurfaceArtifact',
        'ToolDefinition',
        'ToolRegistry',
        'CreateSurfaceEnvelopeInput',
        'DataResourceDefinition',
        'EndpointBinding',
        'EndpointStateKeys',
        'InlineSurfaceHandle',
        'InlineSurfaceOptions',
        'ToolContext',
        'ToolHandlerEntry',
          'ToolHandler',
          'PolicyEngineOptions',
          'PolicyDispatchResult',
        'StateShapeDescriptor',
        'SurfaceEnvelope',
        'SurfacePreviewNode',
        'SurfacePreviewSnapshot',
        'SurfaceStreamContext',
        'SurfaceStreamLineDecision',
        'SurfaceStreamOptions',
        'SurfaceStreamParseError',
        'SurfaceStreamResult',
        'SurfaceStreamSource',
        'SurfaceArtifact',
        'TypedToolHandlerEntry',
      ],
    },
  },
  './browser': {
    values: {
      './_internal/host/browser.js': [
        'HTML_IFRAME_SANDBOX',
        'buildHtmlPreviewCsp',
        'buildHtmlPreviewSrcdoc',
        'buildHtmlSandboxCsp',
        'buildHtmlSandboxSrcdoc',
        'consumeSurfaceStream',
        'mountInlineSurface',
        'parseHtmlSandboxMessage',
      ],
    },
    types: {
        './_internal/host/browser.js': [
          'Artifact',
          'ArrowNetworkPolicy',
          'ArrowSurfaceArtifact',
          'HtmlSandboxMessage',
          'HtmlSandboxSrcdocOptions',
          'HtmlPreviewSrcdocOptions',
          'HtmlStreamPreviewDelta',
          'InlineSurfaceArtifact',
        'InlineSurfaceHandle',
        'InlineSurfaceOptions',
        'SurfacePreviewNode',
        'SurfacePreviewSnapshot',
        'SurfaceStreamContext',
        'SurfaceStreamLineDecision',
        'SurfaceStreamOptions',
        'SurfaceStreamParseError',
        'SurfaceStreamResult',
        'SurfaceStreamSource',
        'SurfaceArtifact',
      ],
    },
  },
  './policy': {
    values: {
      './_internal/host/policy.js': [
        'ToolArgsError',
        'PolicyEngine',
        'defineToolHandler',
      ],
    },
    types: {
      './_internal/host/policy.js': [
        'ToolContext',
        'ToolHandlerEntry',
          'ToolHandler',
          'PolicyEngineOptions',
          'PolicyDispatchResult',
          'TypedToolHandlerEntry',
      ],
    },
  },
  './envelope': {
    values: {
      './_internal/host/envelope.js': [
        'SUMMON_SURFACE_ENVELOPE_VERSION',
        'createSurfaceEnvelope',
        'isSurfaceEnvelope',
        'parseSurfaceEnvelope',
      ],
    },
    types: {
      './_internal/host/envelope.js': [
        'CreateSurfaceEnvelopeInput',
        'SurfaceEnvelope',
      ],
    },
  },
  './assets': {
    values: {
      './_internal/sandbox-runtime/assets.js': [
        'tokensSource',
      ],
    },
    types: {},
  },
  './devtools': {
    values: {
      './_internal/devtools/index.js': [
        'createEventStore',
      ],
    },
    types: {
      './_internal/devtools/index.js': [
        'BaseEvent',
        'DevtoolsEvent',
        'DevtoolsEventKind',
        'EventStore',
        'EventStoreOptions',
        'ToolDispatchedEvent',
        'ToolCalledEvent',
        'ToolRejectedEvent',
        'ToolSettledEvent',
        'ServerLineEvent',
        'TransportParseErrorEvent',
        'RenderEvent',
        'RenderedEvent',
        'StatePushedEvent',
        'StreamGraphEvent',
        'StreamLifecycleEvent',
        'SurfaceDisposedEvent',
        'SurfaceMountedEvent',
        'SurfacePreviewEvent',
        'SurfaceRuntimeErrorEvent',
        'SurfaceContractEvent',
        'SurfacePlanEvent',
      ],
    },
  },
};

const serverExports = {
  '.': {
    values: {
      './_internal/server/index.js': [
        'defaultHostPolicyResolver',
        'inferSurfaceGoal',
        'planAgentSurface',
        'policyFromGoal',        'runAgentSurfaceGeneration',
        'runSurfaceGeneration',
        'summarizeContractIssues',
      ],
    },
    types: {
      './_internal/server/index.js': [
        'AgentGoalProvider',
        'AgentGoalRequest',
        'AgentGoalTextClient',
        'AgentGoalTextRequest',
        'AgentPolicyResolution',
        'AgentSurfaceGenerationInput',
        'AgentSurfaceGenerationSummary',
        'AgentSurfacePlanResult',
        'AgentSurfacePlanningInput',
        'AgentSurfacePlanningOptions',
        'ContractIssue',
        'ContractPromptBlock',
        'GenerateSurfaceInput',
        'GenerationSummary',
        'GhostGenerationContext',
        'HostPolicyResolutionRequest',
        'HostPolicyResolver',
        'ProtocolLine',
        'ProtocolSkipMetaValue',
        'ArrowBundleRequest',
        'ArrowBundleRepairRequest',
        'HtmlBundleRequest',
        'HtmlBundleRepairRequest',
        'SurfaceModelProvider',
        'SurfaceModelRequest',
        'SurfaceGoal',
        'SurfaceGoalDataNeed',
        'SurfaceGoalInteraction',
        'SurfaceGoalSideEffect',
        'SurfaceGoalSource',
        'SurfaceGenerationInput',
        'SurfaceGenerationSummary',
      ],
    },
  },
};

const reactExports = {
  '.': {
    values: {
      './_internal/react/index.js': [
        'SummonSurface',
      ],
    },
    types: {
      './_internal/react/index.js': [
        'SummonSurfaceHandle',
        'SummonSurfaceProps',
        'SummonRenderableArtifact',
      ],
    },
  },
};

function resolveRoot(...parts) {
  return join(rootDir, ...parts);
}

async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

function rewriteSpecifiers(text, replacements) {
  let next = text;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function stripSourceMapReference(text) {
  return text.replace(/^\/\/# sourceMappingURL=.*(?:\r?\n)?/gm, '');
}

async function copyDistTree(sourceDir, destinationDir, replacements = []) {
  await mkdir(destinationDir, { recursive: true });
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const destination = join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      await copyDistTree(source, destination, replacements);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = entry.name.endsWith('.d.ts') ? '.d.ts' : extname(entry.name);
    if (!copiedExtensions.has(extension)) continue;
    const content = await readFile(source, textExtensions.has(extension) ? 'utf8' : undefined);
    if (textExtensions.has(extension)) {
      await writeText(destination, stripSourceMapReference(rewriteSpecifiers(content, replacements)));
    } else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content);
    }
  }
}

async function assertBuilt(packageDir) {
  const distDir = resolveRoot(packageDir, 'dist');
  try {
    const info = await stat(distDir);
    if (info.isDirectory()) return;
  } catch {
    // handled below
  }
  throw new Error(`${packageDir} must be built before public packages are assembled`);
}

function exportLines(map, kind = 'value') {
  const lines = [];
  for (const [source, names] of Object.entries(map)) {
    if (names.length === 0) continue;
    const keyword = kind === 'type' ? 'export type' : 'export';
    lines.push(`${keyword} {\n${names.map((name) => `  ${name},`).join('\n')}\n} from '${source}';`);
  }
  return lines;
}

function wrapperModule({ values, types }, includeTypes) {
  return [
    ...exportLines(values),
    ...(includeTypes ? exportLines(types, 'type') : []),
    '',
  ].join('\n');
}

async function writeWrappers(distDir, definitions) {
  const files = {
    '.': 'index',
    './browser': 'browser',
    './engine': 'engine',
    './host': 'host',
    './policy': 'policy',
    './envelope': 'envelope',
    './assets': 'assets',
    './devtools': 'devtools',
  };

  for (const [subpath, definition] of Object.entries(definitions)) {
    const basename = files[subpath];
    if (!basename) throw new Error(`No wrapper file mapping for ${subpath}`);
    await writeText(join(distDir, `${basename}.js`), wrapperModule(definition, false));
    await writeText(join(distDir, `${basename}.d.ts`), wrapperModule(definition, true));
  }
}

async function buildCore() {
  await Promise.all([
    assertBuilt('packages/devtools'),
    assertBuilt('packages/engine'),
    assertBuilt('packages/host'),
    assertBuilt('packages/sandbox-runtime'),
  ]);

  const distDir = resolveRoot('packages/summon/dist');
  await rm(distDir, { recursive: true, force: true });

  await copyDistTree(resolveRoot('packages/engine/dist'), join(distDir, '_internal', 'engine'));
  await copyDistTree(resolveRoot('packages/devtools/dist'), join(distDir, '_internal', 'devtools'));
  await copyDistTree(resolveRoot('packages/sandbox-runtime/dist'), join(distDir, '_internal', 'sandbox-runtime'));
  await copyDistTree(resolveRoot('packages/host/dist'), join(distDir, '_internal', 'host'), [
    ['@summon-internal/sandbox-runtime/assets', '../sandbox-runtime/assets.js'],
    ['@summon-internal/devtools', '../devtools/index.js'],
    ['@summon-internal/engine', '../engine/index.js'],
  ]);

  await writeWrappers(distDir, coreExports);
}

async function buildServer() {
  await Promise.all([
    assertBuilt('packages/engine'),
    assertBuilt('packages/server'),
  ]);

  const distDir = resolveRoot('packages/summon-server/dist');
  await rm(distDir, { recursive: true, force: true });
  await copyDistTree(resolveRoot('packages/server/dist'), join(distDir, '_internal', 'server'), [
    ['@summon-internal/engine', '@anarchitecture/summon/engine'],
  ]);
  await writeWrappers(distDir, serverExports);
}

async function buildReact() {
  await assertBuilt('packages/react');
  const distDir = resolveRoot('packages/summon-react/dist');
  await rm(distDir, { recursive: true, force: true });
  await copyDistTree(resolveRoot('packages/react/dist'), join(distDir, '_internal', 'react'), [
    ['@summon-internal/sandbox-runtime/assets', '@anarchitecture/summon/assets'],
    ['@summon-internal/host/envelope', '@anarchitecture/summon/envelope'],
    ['@summon-internal/devtools', '@anarchitecture/summon/devtools'],
    ['@summon-internal/engine', '@anarchitecture/summon/engine'],
    ['@summon-internal/host', '@anarchitecture/summon/host'],
  ]);
  await writeWrappers(distDir, reactExports);
}

const builders = {
  summon: buildCore,
  'summon-server': buildServer,
  'summon-react': buildReact,
};

for (const target of targets) {
  const build = builders[target];
  if (!build) {
    throw new Error(`Unknown public package target: ${target}`);
  }
  await build();
  console.log(`built ${target}`);
}
