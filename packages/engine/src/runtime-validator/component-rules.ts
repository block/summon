import type { ContractIssue } from '../contracts.js';
import type { SurfaceAuthority } from '../surface-plan.js';
import { block } from './issues.js';
import type {
  HtmlTraversalToken,
  RuntimeComponent,
  ValidationContext,
} from './types.js';

const COMPONENT_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export function buildComponentMap(context: ValidationContext): Map<string, RuntimeComponent> {
  const out = new Map<string, RuntimeComponent>();
  for (const component of context.components ?? []) {
    out.set(component.name, {
      name: component.name,
      surface: component.surface,
    });
  }
  return out;
}

export function scanComponentBindings(
  tokens: HtmlTraversalToken[],
  componentMap: Map<string, RuntimeComponent>,
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  const ids = new Set<string>();
  const stack: Array<{ tagName: string; component: boolean }> = [];
  let componentDepth = 0;

  for (const token of tokens) {
    if (token.kind === 'close') {
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack.pop();
        if (frame?.component) componentDepth -= 1;
        if (frame?.tagName === token.tagName) break;
      }
      continue;
    }

    const name = token.attrs.get('data-summon-component')?.trim();
    const id = token.attrs.get('data-summon-component-id')?.trim();
    const props = token.attrs.get('data-summon-props');
    const hasComponentAttr = name !== undefined ||
      id !== undefined ||
      props !== undefined;

    if (hasComponentAttr && name === undefined) {
      issues.push(
        block(
          'component-missing-name',
          '`data-summon-component-id` and `data-summon-props` require `data-summon-component`',
        ),
      );
    }

    if (name !== undefined) {
      const component = componentMap.get(name);
      if (!name || !component) {
        issues.push(block('unknown-component', `Component "${name || '(empty)'}" is not registered`));
      } else {
        validateSurfaceComponent(component, context, issues);
      }

      if (componentDepth > 0) {
        issues.push(block('nested-component', 'Component placeholders must not be nested'));
      }

      if (!id) {
        issues.push(
          block(
            'component-id-missing',
            `Component "${name}" must include data-summon-component-id`,
          ),
        );
      } else if (!COMPONENT_ID_RE.test(id)) {
        issues.push(
          block(
            'component-id-invalid',
            `Component "${name}" has invalid id "${id}"`,
          ),
        );
      } else if (ids.has(id)) {
        issues.push(
          block(
            'component-id-duplicate',
            `Component id "${id}" is used more than once in this section`,
          ),
        );
      } else {
        ids.add(id);
      }

      validatePropsJson(name, props, issues);
      if (!token.selfClosing) {
        stack.push({ tagName: token.tagName, component: true });
        componentDepth += 1;
      }
    } else if (!token.selfClosing) {
      stack.push({ tagName: token.tagName, component: false });
    }
  }
}

function validatePropsJson(
  name: string,
  raw: string | undefined,
  issues: ContractIssue[],
): void {
  if (raw === undefined) {
    issues.push(
      block(
        'component-props-missing',
        `Component "${name}" must include data-summon-props`,
      ),
    );
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    issues.push(
      block(
        'component-props-invalid',
        `Component "${name}" data-summon-props must be valid JSON`,
      ),
    );
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    issues.push(
      block(
        'component-props-invalid',
        `Component "${name}" data-summon-props must be a JSON object`,
      ),
    );
  }
}

function validateSurfaceComponent(
  component: RuntimeComponent,
  context: ValidationContext,
  issues: ContractIssue[],
): void {
  const plan = context.surfacePlan;
  if (!plan) return;

  const componentData = component.surface?.data ?? 'embedded';
  const componentAuthority = component.surface?.authority ?? 'none';

  if (plan.runtime === 'static' && (componentData !== 'embedded' || componentAuthority !== 'none')) {
    issues.push(
      block(
        'surface-runtime-exceeded',
        `Static surface can only use embedded display component "${component.name}"`,
      ),
    );
  }

  if (plan.runtime === 'worker' && componentData !== 'worker') {
    issues.push(
      block(
        'surface-runtime-exceeded',
        `Worker surface can only use worker-backed components; "${component.name}" is not worker-backed`,
      ),
    );
  }

  if (plan.data === 'embedded' && componentData !== 'embedded') {
    issues.push(
      block(
        'surface-data-exceeded',
        `Embedded-data surface cannot use component "${component.name}" with ${componentData} data`,
      ),
    );
  }
  if (plan.data === 'host-resource' && componentData === 'worker') {
    issues.push(
      block(
        'surface-data-exceeded',
        `Host-resource surface cannot use worker-backed component "${component.name}"`,
      ),
    );
  }
  if (plan.data === 'worker' && componentData !== 'worker') {
    issues.push(
      block(
        'surface-data-exceeded',
        `Worker-data surface can only use worker-backed components; "${component.name}" is not worker-backed`,
      ),
    );
  }

  if (!authorityAllows(plan.authority, componentAuthority)) {
    issues.push(
      block(
        'surface-authority-exceeded',
        `Surface authority "${plan.authority}" cannot use component "${component.name}" (${componentAuthority})`,
      ),
    );
  }
}

function authorityAllows(plan: SurfaceAuthority, component: SurfaceAuthority): boolean {
  switch (plan) {
    case 'none':
      return component === 'none';
    case 'read':
      return component === 'none' || component === 'read';
    case 'host-action':
      return component === 'none' || component === 'read' || component === 'host-action';
    case 'approval-gated':
      return component === 'none' || component === 'approval-gated';
  }
}
