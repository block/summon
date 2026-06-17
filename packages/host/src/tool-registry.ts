import type {
  ActionStateKeys,
  ToolKind,
  ToolPack,
  ToolPattern,
  ToolStateKeys,
  ToolTrigger,
  CompiledToolContract,
  ToolSpec,
  ResourceStateKeys,
  ToolSurface,
} from '@summon-internal/engine';
import { compileToolContract } from '@summon-internal/engine';
import type { ZodType, ZodTypeAny } from 'zod';
import { defineToolHandler, type ToolHandlerEntry, type ToolHandler } from './policy-engine.js';

export type { ActionStateKeys, ResourceStateKeys } from '@summon-internal/engine';

export type StateShapeDescriptor = string | Record<string, unknown>;

export interface ToolDefinition<T = unknown> {
  name: string;
  description: string;
  argsSchema: ZodType<T>;
  /** Optional override for prompt-facing schema text when Zod introspection is too lossy. */
  argsSchemaText?: string;
  stateShape: StateShapeDescriptor;
  kind?: ToolKind;
  triggers?: ToolTrigger[];
  stateKeys?: ToolStateKeys;
  actionStateKeys?: ActionStateKeys;
  resultSchema?: string;
  defaultDataShape?: string;
  defaultData?: unknown;
  patterns?: ToolPattern[];
  surface?: ToolSurface;
  handler: ToolHandler<T>;
}

export interface ActionDefinition<T = unknown> {
  name: string;
  description: string;
  argsSchema: ZodType<T>;
  argsSchemaText?: string;
  stateShape: StateShapeDescriptor;
  triggers?: ToolTrigger[];
  patterns?: ToolPattern[];
  surface?: ToolSurface;
  controlled?: boolean | { stateKeys?: Partial<ActionStateKeys> };
  handler: ToolHandler<T>;
}

export interface DataResourceDefinition<In = unknown, Out = unknown> {
  name: string;
  description: string;
  argsSchema: ZodType<In>;
  argsSchemaText?: string;
  resultSchema: ZodType<Out>;
  resultSchemaText?: string;
  defaultData?: Out | null;
  stateShape?: StateShapeDescriptor;
  stateKeys: ResourceStateKeys;
  triggers: ToolTrigger[];
  patterns?: ToolPattern[];
  concurrency?: 'latest' | 'drop';
  surface?: ToolSurface;
  onStart?: (input: In) => Record<string, unknown>;
  onError?: (message: string) => void;
  isEmpty?: (data: Out) => boolean;
  fetch: (input: In, signal: AbortSignal) => Promise<Out>;
}

export type ApprovalDecision =
  | 'approved'
  | 'denied'
  | {
      status: 'approved' | 'denied';
      reason?: string;
    };

export interface ApprovalPrepared<Plan = unknown> {
  summary: string;
  details?: unknown;
  plan: Plan;
  expiresAt?: string;
}

export interface ApprovalRequest<TArgs = unknown, Plan = unknown> {
  id: string;
  tool: string;
  args: TArgs;
  summary: string;
  details?: unknown;
  plan: Plan;
  status: 'pending';
  expiresAt?: string;
}

export interface ApprovalStateKeys {
  requestId: string;
  pending: string;
  approved: string;
  denied: string;
  error: string;
}

export interface ApprovalActionDefinition<T = unknown, Plan = unknown> extends ActionDefinition<T> {
  approval: {
    prepare?: (args: T) => Promise<ApprovalPrepared<Plan>> | ApprovalPrepared<Plan>;
    request: (
      args: T,
      request?: ApprovalRequest<T, Plan>,
    ) => Promise<ApprovalDecision> | ApprovalDecision;
    summary?: string | ((args: T) => string);
    stateKeys?: Partial<ApprovalStateKeys>;
  };
}

export interface ToolRegistry {
  toContract(): CompiledToolContract;
  toPolicyHandlers(): Record<string, ToolHandlerEntry<any>>;
  tools(): string[];
  without(names: string[]): ToolRegistry;
}

export function defineTool<T>(
  definition: ToolDefinition<T>,
): ToolDefinition<T> {
  const kind = definition.kind ?? 'action';
  return {
    ...definition,
    kind,
    triggers: definition.triggers ?? defaultTriggersForHostKind(kind),
    surface: normalizeSurfaceForKind(kind, definition.surface),
  };
}

export function defineAction<T>(definition: ActionDefinition<T>): ToolDefinition<T> {
  const stateKeys = actionStateKeys(definition.name, definition.controlled);
  return defineTool({
    ...definition,
    kind: 'action',
    triggers: definition.triggers ?? ['click', 'submit'],
    ...(stateKeys
      ? {
          actionStateKeys: stateKeys,
          stateShape: `${formatStateShape(definition.stateShape)} & {${stateKeys.pending}: boolean, ${stateKeys.done}: boolean, ${stateKeys.error}: string | null}`,
          handler: createControlledActionHandler(definition, stateKeys),
        }
      : {}),
  });
}

export function defineWorkerAction<T>(definition: ActionDefinition<T>): ToolDefinition<T> {
  return defineAction({
    ...definition,
    surface: {
      ...definition.surface,
      data: 'worker',
      authority: definition.surface?.authority ?? 'host-action',
    },
  });
}

export function defineApprovalAction<T, Plan = T>(
  definition: ApprovalActionDefinition<T, Plan>,
): ToolDefinition<T> {
  const stateKeys = approvalStateKeys(definition.name, definition.approval.stateKeys);
  const approvedHandler = definition.handler;
  return defineAction({
    ...definition,
    controlled: undefined,
    surface: {
      ...definition.surface,
      authority: 'approval-gated',
    },
    stateShape: `${formatStateShape(definition.stateShape)} & {${stateKeys.requestId}: string | null, ${stateKeys.pending}: boolean, ${stateKeys.approved}: boolean, ${stateKeys.denied}: boolean, ${stateKeys.error}: string | null}`,
    handler: async (ctx) => {
      const requestId = nextApprovalRequestId(definition.name);
      try {
        const prepared = await prepareApprovalRequest(definition, ctx.args);
        const request = createApprovalRequest(definition.name, ctx.args, requestId, prepared);
        ctx.push({
          [stateKeys.requestId]: request.id,
          [stateKeys.pending]: true,
          [stateKeys.approved]: false,
          [stateKeys.denied]: false,
          [stateKeys.error]: null,
        });
        const decision = normalizeApprovalDecision(await definition.approval.request(ctx.args, request));
        if (decision.status !== 'approved') {
          ctx.push({
            [stateKeys.requestId]: request.id,
            [stateKeys.pending]: false,
            [stateKeys.approved]: false,
            [stateKeys.denied]: true,
            [stateKeys.error]: decision.reason ?? 'Approval denied',
          });
          return;
        }
        ctx.push({
          [stateKeys.requestId]: request.id,
          [stateKeys.pending]: false,
          [stateKeys.approved]: true,
          [stateKeys.denied]: false,
          [stateKeys.error]: null,
        });
        await approvedHandler({ ...ctx, approval: request });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.push({
          [stateKeys.requestId]: requestId,
          [stateKeys.pending]: false,
          [stateKeys.approved]: false,
          [stateKeys.denied]: false,
          [stateKeys.error]: message,
        });
        throw err;
      }
    },
  });
}

export function defineDataResource<In, Out>(
  definition: DataResourceDefinition<In, Out>,
): ToolDefinition<In> {
  validateDefaultData(definition);
  const handler = createDataResourceHandler(definition);
  const hasDefaultData = hasOwnDefaultData(definition);
  const resultSchema = definition.resultSchemaText ?? formatZodSchema(definition.resultSchema);
  return defineTool({
    name: definition.name,
    description: definition.description,
    argsSchema: definition.argsSchema,
    argsSchemaText: definition.argsSchemaText,
    stateShape:
      definition.stateShape ??
      deriveResourceStateShape(definition.stateKeys, definition.resultSchema, definition.resultSchemaText),
    kind: 'resource',
    triggers: definition.triggers,
    stateKeys: definition.stateKeys,
    resultSchema,
    ...(hasDefaultData
      ? {
          defaultData: definition.defaultData ?? null,
          defaultDataShape: formatDefaultDataShape(definition.defaultData ?? null),
        }
      : {}),
    patterns: definition.patterns,
    surface: {
      ...definition.surface,
      data: definition.surface?.data ?? 'host-resource',
      authority: definition.surface?.authority ?? 'read',
    },
    handler,
  });
}

export function defineWorkerResource<In, Out>(
  definition: DataResourceDefinition<In, Out>,
): ToolDefinition<In> {
  return defineDataResource({
    ...definition,
    surface: {
      ...definition.surface,
      data: 'worker',
      authority: definition.surface?.authority ?? 'read',
    },
  });
}

export function createToolRegistry(
  definitions: ToolDefinition<any>[],
): ToolRegistry {
  assertUniqueToolNames(definitions);
  return new StaticToolRegistry(definitions);
}

class StaticToolRegistry implements ToolRegistry {
  constructor(private readonly definitions: ToolDefinition<any>[]) {}

  toContract(): CompiledToolContract {
    const tools: ToolSpec[] = this.definitions.map((definition) => {
      const tool: ToolSpec = {
        name: definition.name,
        description: definition.description,
        argsSchema: definition.argsSchemaText ?? formatZodSchema(definition.argsSchema),
        stateShape: formatStateShape(definition.stateShape),
        kind: definition.kind ?? 'action',
        triggers: definition.triggers ?? ['click', 'submit'],
      };
      if (definition.stateKeys) tool.stateKeys = definition.stateKeys;
      if (definition.actionStateKeys) tool.actionStateKeys = definition.actionStateKeys;
      if (definition.surface) tool.surface = definition.surface;
      if (definition.resultSchema) tool.resultSchema = definition.resultSchema;
      if (definition.defaultDataShape) tool.defaultDataShape = definition.defaultDataShape;
      if ('defaultData' in definition) tool.defaultData = definition.defaultData;
      return tool;
    });
    const patterns = this.definitions.flatMap((definition) =>
      (definition.patterns ?? []).map((pattern) => ({
        ...pattern,
        tool: pattern.tool ?? definition.name,
      })),
    );
    const pack: ToolPack = patterns.length > 0 ? { tools, patterns } : { tools };
    return compileToolContract(pack);
  }

  toPolicyHandlers(): Record<string, ToolHandlerEntry<any>> {
    return Object.fromEntries(
      this.definitions.map((definition) => [
        definition.name,
        defineToolHandler(definition.argsSchema, definition.handler),
      ]),
    );
  }

  tools(): string[] {
    return this.definitions.map((definition) => definition.name);
  }

  without(names: string[]): ToolRegistry {
    const excluded = new Set(names);
    return new StaticToolRegistry(
      this.definitions.filter((definition) => !excluded.has(definition.name)),
    );
  }
}

function createDataResourceHandler<In, Out>(
  definition: DataResourceDefinition<In, Out>,
): ToolHandler<In> {
  const { stateKeys, concurrency = 'latest' } = definition;
  let inflight: AbortController | null = null;
  const defaultData = definition.defaultData ?? null;

  return async ({ args, push }) => {
    if (inflight) {
      if (concurrency === 'drop') return;
      inflight.abort();
    }

    const controller = new AbortController();
    inflight = controller;

    push({
      ...definition.onStart?.(args),
      [stateKeys.loading]: true,
      [stateKeys.data]: defaultData,
      [stateKeys.error]: null,
      ...resourceEmptyPatch(stateKeys, false),
    });

    try {
      const raw = await definition.fetch(args, controller.signal);
      if (controller.signal.aborted) return;

      const parsed = definition.resultSchema.safeParse(raw);
      if (!parsed.success) {
        const message = `Resource "${definition.name}" returned invalid data`;
        definition.onError?.(message);
        push({
          [stateKeys.loading]: false,
          [stateKeys.data]: defaultData,
          [stateKeys.error]: message,
          ...resourceEmptyPatch(stateKeys, false),
        });
        return;
      }

      push({
        [stateKeys.loading]: false,
        [stateKeys.data]: parsed.data,
        [stateKeys.error]: null,
        ...resourceEmptyPatch(stateKeys, resourceIsEmpty(definition, parsed.data)),
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      definition.onError?.(message);
      push({
        [stateKeys.loading]: false,
        [stateKeys.data]: defaultData,
        [stateKeys.error]: message,
        ...resourceEmptyPatch(stateKeys, false),
      });
    } finally {
      if (inflight === controller) inflight = null;
    }
  };
}

function actionStateKeys(
  name: string,
  controlled: ActionDefinition['controlled'],
): ActionStateKeys | null {
  if (!controlled) return null;
  const partial = typeof controlled === 'object' ? controlled.stateKeys : undefined;
  return {
    pending: partial?.pending ?? `${name}Pending`,
    done: partial?.done ?? `${name}Done`,
    error: partial?.error ?? `${name}Error`,
  };
}

function createControlledActionHandler<T>(
  definition: ActionDefinition<T>,
  stateKeys: ActionStateKeys,
): ToolHandler<T> {
  const handler = definition.handler;
  return async (ctx) => {
    ctx.push({
      [stateKeys.pending]: true,
      [stateKeys.done]: false,
      [stateKeys.error]: null,
    });
    try {
      await handler(ctx);
      ctx.push({
        [stateKeys.pending]: false,
        [stateKeys.done]: true,
        [stateKeys.error]: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.push({
        [stateKeys.pending]: false,
        [stateKeys.done]: false,
        [stateKeys.error]: message,
      });
      throw err;
    }
  };
}

function resourceEmptyPatch(
  stateKeys: ResourceStateKeys,
  empty: boolean,
): Record<string, unknown> {
  return stateKeys.empty ? { [stateKeys.empty]: empty } : {};
}

function resourceIsEmpty<In, Out>(
  definition: DataResourceDefinition<In, Out>,
  data: Out,
): boolean {
  if (definition.isEmpty) return definition.isEmpty(data);
  return Array.isArray(data) && data.length === 0;
}

function validateDefaultData<In, Out>(
  definition: DataResourceDefinition<In, Out>,
): void {
  if (!hasOwnDefaultData(definition) || definition.defaultData === null || definition.defaultData === undefined) {
    return;
  }
  const parsed = definition.resultSchema.safeParse(definition.defaultData);
  if (!parsed.success) {
    throw new Error(`Default data for data resource "${definition.name}" does not match resultSchema`);
  }
}

function hasOwnDefaultData<In, Out>(
  definition: DataResourceDefinition<In, Out>,
): boolean {
  return Object.prototype.hasOwnProperty.call(definition, 'defaultData');
}

function formatDefaultDataShape(value: unknown): string {
  if (value === null) return 'null';
  try {
    const json = JSON.stringify(value);
    if (json) return json.length > 240 ? `${json.slice(0, 237)}...` : json;
  } catch {
    // fall through to broad shape
  }
  return typeof value;
}

function deriveResourceStateShape(
  keys: ResourceStateKeys,
  resultSchema: ZodTypeAny,
  resultSchemaText?: string,
): string {
  const result = resultSchemaText ?? formatZodSchema(resultSchema);
  const empty = keys.empty ? `, ${keys.empty}: boolean` : '';
  return `{${keys.loading}: boolean, ${keys.data}: ${result} | null, ${keys.error}: string | null${empty}}`;
}

function assertUniqueToolNames(definitions: ToolDefinition<any>[]): void {
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.name)) {
      throw new Error(`Duplicate tool "${definition.name}"`);
    }
    seen.add(definition.name);
  }
}

function formatStateShape(shape: StateShapeDescriptor): string {
  if (typeof shape === 'string') return shape;
  return JSON.stringify(shape);
}

function defaultTriggersForHostKind(kind: string): ToolTrigger[] {
  return kind === 'resource' ? ['submit', 'mount'] : ['click', 'submit'];
}

function normalizeSurfaceForKind(
  kind: string,
  surface: ToolSurface | undefined,
): ToolSurface {
  if (kind === 'resource') {
    return {
      data: surface?.data ?? 'host-resource',
      authority: surface?.authority ?? 'read',
    };
  }
  return {
    ...surface,
    authority: surface?.authority ?? 'host-action',
  };
}

function approvalStateKeys(name: string, partial: Partial<ApprovalStateKeys> | undefined): ApprovalStateKeys {
  return {
    requestId: partial?.requestId ?? `${name}ApprovalRequestId`,
    pending: partial?.pending ?? `${name}ApprovalPending`,
    approved: partial?.approved ?? `${name}ApprovalApproved`,
    denied: partial?.denied ?? `${name}ApprovalDenied`,
    error: partial?.error ?? `${name}ApprovalError`,
  };
}

let approvalRequestSeq = 0;

function nextApprovalRequestId(name: string): string {
  approvalRequestSeq += 1;
  const safeName = name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'approval';
  return `${safeName}-${Date.now().toString(36)}-${approvalRequestSeq.toString(36)}`;
}

async function prepareApprovalRequest<T, Plan>(
  definition: ApprovalActionDefinition<T, Plan>,
  args: T,
): Promise<ApprovalPrepared<Plan>> {
  if (definition.approval.prepare) return definition.approval.prepare(args);
  return {
    summary: approvalSummary(definition.approval.summary, args, definition.name),
    plan: args as unknown as Plan,
  };
}

function approvalSummary<T>(
  summary: ApprovalActionDefinition<T>['approval']['summary'],
  args: T,
  name: string,
): string {
  if (typeof summary === 'function') return summary(args);
  if (summary) return summary;
  return `Approve ${name}`;
}

function createApprovalRequest<T, Plan>(
  tool: string,
  args: T,
  id: string,
  prepared: ApprovalPrepared<Plan>,
): ApprovalRequest<T, Plan> {
  const request: ApprovalRequest<T, Plan> = {
    id,
    tool,
    args,
    summary: prepared.summary,
    plan: prepared.plan,
    status: 'pending',
  };
  if (prepared.details !== undefined) request.details = prepared.details;
  if (prepared.expiresAt !== undefined) request.expiresAt = prepared.expiresAt;
  return request;
}

function normalizeApprovalDecision(decision: ApprovalDecision): { status: 'approved' | 'denied'; reason?: string } {
  if (decision === 'approved' || decision === 'denied') return { status: decision };
  return decision;
}

export function formatZodSchema(schema: ZodTypeAny): string {
  return formatZodType(schema, '{...}');
}

function formatZodType(schema: ZodTypeAny, fallback: string): string {
  const def = getDef(schema);
  const typeName = def?.typeName;

  switch (typeName) {
    case 'ZodOptional':
      return formatZodType(def?.innerType as ZodTypeAny, fallback);
    case 'ZodNullable':
      return `${formatZodType(def?.innerType as ZodTypeAny, fallback)} | null`;
    case 'ZodDefault':
      return formatZodType((def?.innerType ?? def?.schema) as ZodTypeAny, fallback);
    case 'ZodEffects':
      return formatZodType(def?.schema as ZodTypeAny, fallback);
    case 'ZodObject':
      return formatZodObject(schema, fallback);
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBigInt':
      return 'bigint';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodDate':
      return 'Date';
    case 'ZodNull':
      return 'null';
    case 'ZodUndefined':
    case 'ZodVoid':
      return 'undefined';
    case 'ZodAny':
    case 'ZodUnknown':
      return 'any';
    case 'ZodArray': {
      const inner = (def?.type ?? def?.element) as ZodTypeAny | undefined;
      return inner ? `${formatZodType(inner, 'any')}[]` : 'any[]';
    }
    case 'ZodTuple': {
      const items = Array.isArray(def?.items) ? (def.items as ZodTypeAny[]) : [];
      return items.length > 0
        ? `[${items.map((item) => formatZodType(item, 'any')).join(', ')}]`
        : '[]';
    }
    case 'ZodRecord': {
      const valueType = def?.valueType as ZodTypeAny | undefined;
      return `{[key: string]: ${valueType ? formatZodType(valueType, 'any') : 'any'}}`;
    }
    case 'ZodLiteral':
      return JSON.stringify(def?.value);
    case 'ZodEnum': {
      const values = Array.isArray(def?.values) ? (def.values as unknown[]) : [];
      return values.length > 0 ? values.map((value) => JSON.stringify(value)).join(' | ') : fallback;
    }
    case 'ZodNativeEnum': {
      const values = nativeEnumValues(def?.values);
      return values.length > 0 ? values.map((value) => JSON.stringify(value)).join(' | ') : fallback;
    }
    case 'ZodUnion': {
      const options = Array.isArray(def?.options) ? (def.options as ZodTypeAny[]) : [];
      return options.length > 0
        ? options.map((option) => formatZodType(option, 'any')).join(' | ')
        : fallback;
    }
    case 'ZodDiscriminatedUnion': {
      const options = def?.options instanceof Map
        ? Array.from(def.options.values()) as ZodTypeAny[]
        : Array.isArray(def?.options)
          ? def.options as ZodTypeAny[]
          : [];
      return options.length > 0
        ? options.map((option) => formatZodType(option, 'any')).join(' | ')
        : fallback;
    }
    default:
      return fallback;
  }
}

function formatZodObject(schema: ZodTypeAny, fallback: string): string {
  const def = getDef(schema);
  const rawShape = typeof def?.shape === 'function' ? def.shape() : def?.shape;
  if (!rawShape || typeof rawShape !== 'object') return fallback;

  const fields = Object.entries(rawShape as Record<string, ZodTypeAny>).map(([key, field]) => {
    const optional = isOptionalField(field);
    const marker = optional ? '?' : '';
    return `${formatObjectKey(key)}${marker}: ${formatZodType(field, 'any')}`;
  });

  return `{${fields.join(', ')}}`;
}

function isOptionalField(schema: ZodTypeAny): boolean {
  const typeName = getDef(schema)?.typeName;
  if (typeName === 'ZodOptional' || typeName === 'ZodDefault') return true;
  if (typeName === 'ZodEffects') {
    const inner = getDef(schema)?.schema as ZodTypeAny | undefined;
    return inner ? isOptionalField(inner) : false;
  }
  return false;
}

function nativeEnumValues(values: unknown): unknown[] {
  if (!values || typeof values !== 'object') return [];
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(values as Record<string, unknown>)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    // Numeric native enums include reverse mappings. Drop the string names
    // when the enum object also contains the matching numeric value.
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(values, value)) continue;
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function formatObjectKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function getDef(schema: ZodTypeAny): Record<string, any> | undefined {
  return (schema as unknown as { _def?: Record<string, any> })._def;
}
