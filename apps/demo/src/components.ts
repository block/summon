import {
  createComponentRegistry,
  defineComponent,
  type ComponentDefinition,
  type ComponentRegistry,
} from '@anarchitecture/summon';
import type { ComponentPack } from '@anarchitecture/summon';
import { z } from 'zod';

const metricCardPropsSchema = z.object({
  label: z.string(),
  value: z.string(),
  delta: z.string().optional(),
  tone: z.enum(['neutral', 'good', 'warn']).optional(),
});

const trendSparklinePropsSchema = z.object({
  label: z.string(),
  points: z.array(z.number()).min(2).max(12),
  caption: z.string().optional(),
});

const approvalStatusPropsSchema = z.object({
  status: z.enum(['pending', 'approved', 'blocked']),
  title: z.string(),
  detail: z.string().optional(),
});

type MetricCardProps = z.infer<typeof metricCardPropsSchema>;
type TrendSparklineProps = z.infer<typeof trendSparklinePropsSchema>;
type ApprovalStatusProps = z.infer<typeof approvalStatusPropsSchema>;

export function createDemoComponentRegistry(componentNames?: readonly string[]): ComponentRegistry {
  const allowed = componentNames ? new Set(componentNames) : null;
  const definitions = demoComponentDefinitions().filter((definition) =>
    allowed ? allowed.has(definition.name) : true,
  );
  return createComponentRegistry(definitions);
}

export function baseDemoComponentPack(): ComponentPack {
  return createDemoComponentRegistry().toContract().pack;
}

export function narrowComponentPack(pack: ComponentPack, componentNames: readonly string[]): ComponentPack {
  const allowed = new Set(componentNames);
  return {
    components: pack.components.filter((component) => allowed.has(component.name)),
  };
}

function demoComponentDefinitions(): ComponentDefinition<any>[] {
  return [
    defineComponent<MetricCardProps>({
      name: 'MetricCard',
      description:
        'Displays one compact KPI with an optional delta and tone. Use for launch metrics, readiness scores, revenue, risk, or progress numbers.',
      propsSchema: metricCardPropsSchema,
      sizing: { height: 'var(--space-10)', description: 'Works well in a 2-4 column metric grid.' },
      examples: [
        {
          name: 'KPI placeholder',
          code: `<div data-summon-component="MetricCard" data-summon-component-id="launch-score" data-summon-props='{"label":"Launch score","value":"84","delta":"+6 pts","tone":"good"}' style="min-height:var(--space-10);"></div>`,
        },
      ],
      render: ({ container, props }) => {
        const tone = props.tone ?? 'neutral';
        container.innerHTML = `
          <div style="
            height:100%; box-sizing:border-box; padding:14px 16px;
            border-radius:14px; border:1px solid ${tone === 'warn' ? '#cc4b03' : '#e6e6e6'};
            background:${tone === 'good' ? '#f2fff6' : tone === 'warn' ? '#fff7ed' : '#fff'};
            color:#101010; display:flex; flex-direction:column; justify-content:space-between;
            font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#6b6b6b; font-weight:700;">${esc(props.label)}</div>
            <div style="display:flex; align-items:baseline; gap:8px;">
              <strong style="font-size:34px; line-height:1; letter-spacing:-.03em;">${esc(props.value)}</strong>
              ${props.delta ? `<span style="font-size:13px; font-weight:700; color:${tone === 'warn' ? '#cc4b03' : tone === 'good' ? '#008c2e' : '#6b6b6b'};">${esc(props.delta)}</span>` : ''}
            </div>
          </div>`;
      },
    }),
    defineComponent<TrendSparklineProps>({
      name: 'TrendSparkline',
      description:
        'Displays a small trend line from numeric points. Use when a generated surface needs a compact visual trend instead of a text-only metric.',
      propsSchema: trendSparklinePropsSchema,
      sizing: { height: 'var(--space-11)', description: 'Needs enough height for the chart and caption.' },
      examples: [
        {
          name: 'Trend placeholder',
          code: `<div data-summon-component="TrendSparkline" data-summon-component-id="quality-trend" data-summon-props='{"label":"Quality trend","points":[62,67,71,76,82,84],"caption":"Six-week readiness climb"}' style="min-height:var(--space-11);"></div>`,
        },
      ],
      render: ({ container, props }) => {
        const points = props.points.length >= 2 ? props.points : [0, 0];
        const min = Math.min(...points);
        const max = Math.max(...points);
        const spread = max - min || 1;
        const d = points.map((point, index) => {
          const x = (index / Math.max(points.length - 1, 1)) * 220 + 10;
          const y = 74 - ((point - min) / spread) * 54 + 10;
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
        container.innerHTML = `
          <div style="height:100%; box-sizing:border-box; padding:14px 16px; border:1px solid #e6e6e6; border-radius:14px; background:#fff; font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
              <strong style="font-size:14px;">${esc(props.label)}</strong>
              <span style="font-size:11px; color:#6b6b6b;">${points.length} pts</span>
            </div>
            <svg viewBox="0 0 240 96" width="100%" height="72" role="img" aria-label="${esc(props.label)}" style="display:block; margin-top:4px;">
              <path d="M10 84 H230" stroke="#e6e6e6" stroke-width="1" />
              <path d="${d}" fill="none" stroke="#101010" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            ${props.caption ? `<div style="font-size:12px; color:#6b6b6b;">${esc(props.caption)}</div>` : ''}
          </div>`;
      },
    }),
    defineComponent<ApprovalStatusProps>({
      name: 'ApprovalStatus',
      description:
        'Displays a launch or publish approval state with a strong status treatment. Use for pending, approved, or blocked readiness gates.',
      propsSchema: approvalStatusPropsSchema,
      sizing: { height: 'var(--space-9)', description: 'Fits a compact status row or card.' },
      examples: [
        {
          name: 'Approval placeholder',
          code: `<div data-summon-component="ApprovalStatus" data-summon-component-id="release-gate" data-summon-props='{"status":"pending","title":"Release review","detail":"Awaiting marketing approval"}' style="min-height:var(--space-9);"></div>`,
        },
      ],
      render: ({ container, props }) => {
        const colors = {
          pending: ['#fff7ed', '#cc4b03', 'Pending'],
          approved: ['#f2fff6', '#008c2e', 'Approved'],
          blocked: ['#fff1f2', '#cc0023', 'Blocked'],
        } as const;
        const [bg, fg, label] = colors[props.status];
        container.innerHTML = `
          <div style="height:100%; box-sizing:border-box; padding:14px 16px; border-radius:14px; background:${bg}; border:1px solid ${fg}; color:#101010; font-family:system-ui,-apple-system,Segoe UI,sans-serif; display:grid; gap:8px;">
            <span style="width:max-content; padding:3px 9px; border-radius:999px; background:${fg}; color:white; font-size:11px; font-weight:800; letter-spacing:.04em; text-transform:uppercase;">${label}</span>
            <strong style="font-size:17px; line-height:1.15;">${esc(props.title)}</strong>
            ${props.detail ? `<span style="font-size:12px; color:#4b5563;">${esc(props.detail)}</span>` : ''}
          </div>`;
      },
    }),
  ];
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}
