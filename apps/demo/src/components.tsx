import {
  createComponentRegistry,
  type ComponentDefinition,
  type ComponentRegistry,
} from '@anarchitecture/summon';
import type { ComponentPack } from '@anarchitecture/summon';
import { defineReactComponent } from '@anarchitecture/summon-react';
import type { CSSProperties } from 'react';
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
    defineReactComponent<MetricCardProps>({
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
      component: MetricCard,
    }),
    defineReactComponent<TrendSparklineProps>({
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
      component: TrendSparkline,
    }),
    defineReactComponent<ApprovalStatusProps>({
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
      component: ApprovalStatus,
    }),
  ];
}

function MetricCard({ label, value, delta, tone = 'neutral' }: MetricCardProps) {
  const border = tone === 'warn' ? '#cc4b03' : '#e6e6e6';
  const background = tone === 'good' ? '#f2fff6' : tone === 'warn' ? '#fff7ed' : '#fff';
  const deltaColor = tone === 'warn' ? '#cc4b03' : tone === 'good' ? '#008c2e' : '#6b6b6b';
  return (
    <div style={{ ...hostCardStyle, borderColor: border, background, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={metricValueStyle}>{value}</strong>
        {delta ? <span style={{ ...metricDeltaStyle, color: deltaColor }}>{delta}</span> : null}
      </div>
    </div>
  );
}

function TrendSparkline({ label, points, caption }: TrendSparklineProps) {
  const safePoints = points.length >= 2 ? points : [0, 0];
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const spread = max - min || 1;
  const d = safePoints.map((point, index) => {
    const x = (index / Math.max(safePoints.length - 1, 1)) * 220 + 10;
    const y = 74 - ((point - min) / spread) * 54 + 10;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div style={{ ...hostCardStyle, borderColor: '#e6e6e6', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        <span style={{ fontSize: 11, color: '#6b6b6b' }}>{safePoints.length} pts</span>
      </div>
      <svg viewBox="0 0 240 96" width="100%" height="72" role="img" aria-label={label} style={{ display: 'block', marginTop: 4 }}>
        <path d="M10 84 H230" stroke="#e6e6e6" strokeWidth="1" />
        <path d={d} fill="none" stroke="#101010" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {caption ? <div style={{ fontSize: 12, color: '#6b6b6b' }}>{caption}</div> : null}
    </div>
  );
}

function ApprovalStatus({ status, title, detail }: ApprovalStatusProps) {
  const colors = {
    pending: ['#fff7ed', '#cc4b03', 'Pending'],
    approved: ['#f2fff6', '#008c2e', 'Approved'],
    blocked: ['#fff1f2', '#cc0023', 'Blocked'],
  } as const;
  const [bg, fg, label] = colors[status];
  return (
    <div style={{ ...hostCardStyle, borderColor: fg, background: bg, display: 'grid', gap: 8 }}>
      <span style={{ ...approvalBadgeStyle, background: fg }}>{label}</span>
      <strong style={{ fontSize: 17, lineHeight: 1.15 }}>{title}</strong>
      {detail ? <span style={{ fontSize: 12, color: '#4b5563' }}>{detail}</span> : null}
    </div>
  );
}

const hostCardStyle: CSSProperties = {
  height: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid #e6e6e6',
  color: '#101010',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
};

const metricLabelStyle: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b6b6b',
  fontWeight: 700,
};

const metricValueStyle: CSSProperties = {
  fontSize: 34,
  lineHeight: 1,
  letterSpacing: '-0.03em',
};

const metricDeltaStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const approvalBadgeStyle: CSSProperties = {
  width: 'max-content',
  padding: '3px 9px',
  borderRadius: 999,
  color: 'white',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};
