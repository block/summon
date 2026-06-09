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
        'compileSurfacePolicy',
        'normalizeSurfacePolicy',
        'SURFACE_PERSISTENCE_VALUES',
        'SURFACE_PURPOSE_VALUES',
        'SURFACE_TIER_VALUES',
      ],
      './_internal/host/index.js': [
        'createCapabilityRegistry',
        'createComponentRegistry',
        'defineAction',
        'defineApprovalAction',
        'defineCapability',
        'defineComponent',
        'defineDataResource',
        'defineIntent',
        'defineWorkerAction',
        'defineWorkerResource',
        'IntentArgsError',
        'PolicyEngine',
      ],
    },
    types: {
      './_internal/engine/index.js': [
        'CapabilityBindingSpec',
        'CapabilityKind',
        'CapabilityPack',
        'CapabilityPattern',
        'CapabilityStateKeys',
        'CapabilitySurface',
        'CapabilityTrigger',
        'CapabilityTriggerSpec',
        'ComponentPack',
        'ComponentSpec',
        'ComponentSurface',
        'CompiledSurfacePolicy',
        'CompileSurfacePolicyOptions',
        'IntentSpec',
        'NormalizedSurfacePolicy',
        'SurfacePersistence',
        'SurfacePolicy',
        'SurfacePurpose',
        'SurfaceTier',
      ],
      './_internal/host/index.js': [
        'ActionDefinition',
        'ApprovalActionDefinition',
        'ApprovalDecision',
        'ApprovalStateKeys',
        'CapabilityDefinition',
        'CapabilityRegistry',
        'ComponentDefinition',
        'ComponentDestroyer',
        'ComponentPropsParseResult',
        'ComponentRegistry',
        'ComponentRenderContext',
        'ComponentRenderer',
        'DataResourceDefinition',
        'IntentContext',
        'IntentEntry',
        'IntentHandler',
        'PolicyEngineOptions',
        'StateShapeDescriptor',
        'TypedIntentEntry',
      ],
    },
  },
  './engine': {
    values: {
      './_internal/engine/index.js': [
        'CAPABILITY_BINDING_SPECS',
        'CAPABILITY_TRIGGER_SPECS',
        'DEFAULT_SURFACE_CEILING',
        'DEFAULT_SURFACE_PLAN',
        'DEFAULT_VALIDATION_LIMITS',
        'OPPORTUNISTIC_TOKENS',
        'OPT_OUT_GROUPS',
        'OPT_OUT_TOKENS',
        'ProtocolParseError',
        'REQUIRED_TOKENS',
        'SHADOW_TOKENS',
        'SUMMON_FIXED_INSTRUCTIONS',
        'SUMMON_PROTOCOL_VERSION',
        'SUMMON_SYSTEM_PROMPT',
        'SURFACE_AUTHORITY_VALUES',
        'SURFACE_DATA_VALUES',
        'SURFACE_PERSISTENCE_VALUES',
        'SURFACE_PURPOSE_VALUES',
        'SURFACE_RUNTIME_VALUES',
        'SectionAccumulator',
        'StreamGraph',
        'TOKEN_CONTRACT',
        'buildCapabilitiesBlock',
        'buildComponentsBlock',
        'buildDirectionBlock',
        'buildLayoutBlock',
        'buildOverrideBlock',
        'buildPosturesBlock',
        'buildSurfacePlanBlock',
        'coerceOpts',
        'compileCapabilityContract',
        'compileComponentContract',
        'compileDirectionContract',
        'compileSurfacePolicy',
        'compileSystemContracts',
        'compileTokenContract',
        'constrainSurfacePlan',
        'contractIssue',
        'createProtocolHardener',
        'defaultTriggersForKind',
        'deriveSurfacePlanControls',
        'formatCapabilityProtocolContract',
        'formatTokenContract',
        'hasCompleteResourceStateKeys',
        'hintsForContractIssue',
        'inferSurfacePlan',
        'isProtocolLine',
        'normalizeSurfaceCeiling',
        'normalizeSurfacePolicy',
        'normalizeSurfacePlan',
        'suggestSurfacePlan',
        'normalizeValidationLimits',
        'parseDefinedTokens',
        'parseProtocolLine',
        'parseProtocolLineStrict',
        'parseTokenValues',
        'surfacePlanScriptPolicy',
        'surfacePlanWithinCeiling',
        'SURFACE_TIER_VALUES',
        'validateDirection',
        'validateHtmlFragment',
        'validateProtocolLine',
        'withIssueSeverity',
      ],
    },
    types: {
      './_internal/engine/index.js': [
        'AddLine',
        'CapabilitiesBlockOptions',
        'CapabilityBindingSpec',
        'CapabilityContractOptions',
        'CapabilityKind',
        'CapabilityPack',
        'CapabilityPattern',
        'CapabilityStateKeys',
        'CapabilitySurface',
        'CapabilityTrigger',
        'CapabilityTriggerSpec',
        'CompiledCapabilityContract',
        'CompiledComponentContract',
        'CompiledDirectionContract',
        'CompiledSurfacePolicy',
        'CompiledSystemContracts',
        'CompiledTokenContract',
        'CompileSurfacePolicyOptions',
        'ComponentExample',
        'ComponentPack',
        'ComponentSizing',
        'ComponentSpec',
        'ComponentSurface',
        'ContractIssue',
        'ContractIssueSeverity',
        'ContractIssueSource',
        'ContractPromptBlock',
        'DataResourceSpec',
        'DirectionContractInput',
        'DirectionInput',
        'DirectionOpts',
        'Exemplar',
        'IntentSpec',
        'MetaLine',
        'NormalizedSurfacePolicy',
        'OptOutGroup',
        'OptOutValue',
        'PostureContract',
        'PostureRegistry',
        'ProtocolHardener',
        'ProtocolHardenerOptions',
        'ProtocolHardenerResult',
        'ProtocolLine',
        'ProtocolParseErrorCode',
        'ProtocolParseOptions',
        'ProtocolSkipMetaValue',
        'RepairFeedbackMetaValue',
        'ScreenSynthesizedMetaValue',
        'ScriptPolicy',
        'SectionAccumulatorSnapshot',
        'SectionApplyKind',
        'SectionApplyResult',
        'SectionSnapshotEntry',
        'SetLine',
        'StreamGraphEdge',
        'StreamGraphHealth',
        'StreamGraphSection',
        'StreamGraphSnapshot',
        'SummonLayout',
        'SummonLayoutSlot',
        'SurfaceAuthority',
        'SurfaceCeiling',
        'SurfaceData',
        'SurfacePersistence',
        'SurfacePolicy',
        'SurfacePlan',
        'SurfacePlanControls',
        'SurfacePlanInferenceInput',
        'SurfacePlanMode',
        'SurfacePurpose',
        'SurfaceRuntime',
        'SurfaceTier',
        'SystemContractInput',
        'TokenContract',
        'TokenContractInput',
        'TokenKind',
        'TokenOverride',
        'TokenSpec',
        'ValidationCapability',
        'ValidationComponent',
        'ValidationContext',
        'ValidationLimits',
        'ValidationResult',
      ],
    },
  },
  './host': {
    values: {
      './_internal/host/index.js': [
        'IntentArgsError',
        'PolicyEngine',
        'SUMMON_SURFACE_ENVELOPE_VERSION',
        'bindEndpoint',
        'consumeSurfaceStream',
        'createCapabilityRegistry',
        'createComponentIslandRegistry',
        'createComponentRegistry',
        'createStrictInputRegistry',
        'createSurfaceEnvelope',
        'defineAction',
        'defineApprovalAction',
        'defineCapability',
        'defineComponent',
        'defineDataResource',
        'defineIntent',
        'defineWorkerAction',
        'defineWorkerResource',
        'isSurfaceEnvelope',
        'parseSurfaceEnvelope',
        'spawnSandbox',
      ],
    },
    types: {
      './_internal/host/index.js': [
        'ActionDefinition',
        'ApprovalActionDefinition',
        'ApprovalDecision',
        'ApprovalStateKeys',
        'Artifact',
        'CapabilityDefinition',
        'CapabilityRegistry',
        'ComponentDefinition',
        'ComponentDestroyer',
        'ComponentIslandBounds',
        'ComponentIslandDescriptor',
        'ComponentIslandError',
        'ComponentIslandErrorCode',
        'ComponentIslandRegistry',
        'ComponentIslandRegistryOptions',
        'ComponentIslandSyncContext',
        'ComponentPropsParseResult',
        'ComponentRegistry',
        'ComponentRenderContext',
        'ComponentRenderer',
        'ComponentsMessage',
        'CreateSurfaceEnvelopeInput',
        'DataResourceDefinition',
        'EndpointBinding',
        'EndpointStateKeys',
        'FatalMessage',
        'IntentContext',
        'IntentEntry',
        'IntentHandler',
        'IntentMessage',
        'PolicyEngineOptions',
        'ReadyMessage',
        'SandboxHandle',
        'SandboxInboundMessage',
        'SpawnOptions',
        'StateMessage',
        'StateShapeDescriptor',
        'StrictInputBounds',
        'StrictInputController',
        'StrictInputFactory',
        'StrictInputFactoryArgs',
        'StrictInputRegistry',
        'StrictInputRegistryOptions',
        'SurfaceEnvelope',
        'SurfaceStreamContext',
        'SurfaceStreamLineDecision',
        'SurfaceStreamOptions',
        'SurfaceStreamParseError',
        'SurfaceStreamRenderMode',
        'SurfaceStreamResult',
        'SurfaceStreamSource',
        'TypedIntentEntry',
      ],
    },
  },
  './browser': {
    values: {
      './_internal/host/browser.js': [
        'consumeSurfaceStream',
        'createComponentIslandRegistry',
        'createStrictInputRegistry',
        'spawnSandbox',
      ],
    },
    types: {
      './_internal/host/browser.js': [
        'Artifact',
        'ComponentIslandBounds',
        'ComponentIslandDescriptor',
        'ComponentIslandError',
        'ComponentIslandErrorCode',
        'ComponentIslandRegistry',
        'ComponentIslandRegistryOptions',
        'ComponentIslandSyncContext',
        'ComponentsMessage',
        'FatalMessage',
        'IntentMessage',
        'ReadyMessage',
        'SandboxHandle',
        'SandboxInboundMessage',
        'SpawnOptions',
        'StateMessage',
        'StrictInputBounds',
        'StrictInputController',
        'StrictInputFactory',
        'StrictInputFactoryArgs',
        'StrictInputRegistry',
        'StrictInputRegistryOptions',
        'SurfaceStreamContext',
        'SurfaceStreamLineDecision',
        'SurfaceStreamOptions',
        'SurfaceStreamParseError',
        'SurfaceStreamRenderMode',
        'SurfaceStreamResult',
        'SurfaceStreamSource',
      ],
    },
  },
  './policy': {
    values: {
      './_internal/host/policy.js': [
        'IntentArgsError',
        'PolicyEngine',
        'defineIntent',
      ],
    },
    types: {
      './_internal/host/policy.js': [
        'IntentContext',
        'IntentEntry',
        'IntentHandler',
        'PolicyEngineOptions',
        'TypedIntentEntry',
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
        'bootstrapSource',
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
        'ComponentErrorEvent',
        'ComponentSyncEvent',
        'DevtoolsEvent',
        'DevtoolsEventKind',
        'EventStore',
        'EventStoreOptions',
        'IntentDispatchedEvent',
        'IntentEmittedEvent',
        'IntentRejectedEvent',
        'IntentSettledEvent',
        'ProtocolLineEvent',
        'ProtocolParseErrorEvent',
        'RenderEvent',
        'SandboxDisposedEvent',
        'SandboxFatalEvent',
        'SandboxReadyEvent',
        'SandboxSpawnedEvent',
        'StatePushedEvent',
        'StreamGraphEvent',
        'StreamLifecycleEvent',
        'SurfacePlanEvent',
      ],
    },
  },
};

const serverExports = {
  '.': {
    values: {
      './_internal/server/index.js': [
        'createProtocolLineWriter',
        'generateSurfaceStream',
        'resolveSurfaceGenerationPlan',
        'runSurfaceGeneration',
        'summarizeContractIssues',
      ],
    },
    types: {
      './_internal/server/index.js': [
        'ContractIssue',
        'ContractPromptBlock',
        'GenerateEditInput',
        'GenerateSurfaceInput',
        'GenerationSummary',
        'ProtocolLine',
        'ProtocolLineWritableTarget',
        'ProtocolLineWriterOptions',
        'ProtocolSkipMetaValue',
        'RepairFeedbackMetaValue',
        'RepairOptions',
        'RepairStats',
        'ResolvedSurfaceGenerationPlan',
        'ResolveSurfaceGenerationPlanInput',
        'SummonModelChunk',
        'SummonModelProvider',
        'SummonModelRequest',
        'SummonRepairProvider',
        'SummonRepairRequest',
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
        'defineReactComponent',
      ],
    },
    types: {
      './_internal/react/index.js': [
        'ReactComponentRuntimeContext',
        'ReactComponentWithRuntimeDefinition',
        'SummonSurfaceChrome',
        'SummonSurfaceProps',
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
