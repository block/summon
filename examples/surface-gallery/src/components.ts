import {
  createComponentRegistry,
  defineComponent,
  type ComponentDefinition,
  type ComponentRegistry,
} from '@anarchitecture/summon';
import { z } from 'zod';
import {
  hostApprovalBadgeClass,
  hostApprovalClass,
  hostApprovalDetailClass,
  hostApprovalTitleClass,
  hostMetricClass,
  hostMetricDeltaClass,
  hostMetricLabelClass,
  hostMetricValueClass,
  hostTrendCaptionClass,
  hostTrendClass,
  hostTrendHeaderClass,
  hostTrendMetaClass,
  hostTrendSvgClass,
} from './ui.js';

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

export function createGalleryComponentRegistry(componentNames?: readonly string[]): ComponentRegistry {
  const allowed = componentNames ? new Set(componentNames) : null;
  return createComponentRegistry(
    galleryComponentDefinitions().filter((definition) =>
      allowed ? allowed.has(definition.name) : true,
    ),
  );
}

export function allGalleryComponentNames(): string[] {
  return galleryComponentDefinitions().map((definition) => definition.name);
}

function galleryComponentDefinitions(): ComponentDefinition<any>[] {
  return [
    defineComponent<MetricCardProps>({
      name: 'MetricCard',
      description:
        'Trusted host KPI card with label, value, optional delta, and tone. Use for readiness metrics, risk, progress, or launch quality.',
      propsSchema: metricCardPropsSchema,
      sizing: { height: '112px', description: 'Use in a compact dashboard grid.' },
      examples: [
        {
          name: 'Metric card',
          code: `<div data-summon-component="MetricCard" data-summon-component-id="launch-score" data-summon-props='{"label":"Launch score","value":"84","delta":"+6 pts","tone":"good"}' style="width:220px;height:112px;"></div>`,
        },
      ],
      render: ({ container, props }) => {
        const tone = props.tone ?? 'neutral';
        const border = tone === 'warn' ? '#b45309' : tone === 'good' ? '#15803d' : '#d7d7d7';
        const bg = tone === 'warn' ? '#fff7ed' : tone === 'good' ? '#f0fdf4' : '#ffffff';
        const accent = tone === 'warn' ? '#b45309' : tone === 'good' ? '#15803d' : '#555555';
        container.innerHTML = `
          <div class="${hostMetricClass}" style="border-color:${border};background:${bg};">
            <span class="${hostMetricLabelClass}">${esc(props.label)}</span>
            <strong class="${hostMetricValueClass}">${esc(props.value)}</strong>
            ${props.delta ? `<em class="${hostMetricDeltaClass}" style="color:${accent};">${esc(props.delta)}</em>` : ''}
          </div>`;
      },
    }),
    defineComponent<TrendSparklineProps>({
      name: 'TrendSparkline',
      description:
        'Trusted host trend line from numeric points. Use when the generated surface needs visual trend data.',
      propsSchema: trendSparklinePropsSchema,
      sizing: { height: '132px', description: 'Enough height for chart and caption.' },
      examples: [
        {
          name: 'Trend sparkline',
          code: `<div data-summon-component="TrendSparkline" data-summon-component-id="quality-trend" data-summon-props='{"label":"Quality trend","points":[62,67,71,76,82,84],"caption":"Six-week readiness climb"}' style="width:260px;height:132px;"></div>`,
        },
      ],
      render: ({ container, props }) => {
        const points = props.points.length >= 2 ? props.points : [0, 0];
        const min = Math.min(...points);
        const max = Math.max(...points);
        const spread = max - min || 1;
        const d = points.map((point, index) => {
          const x = 10 + (index / Math.max(points.length - 1, 1)) * 220;
          const y = 82 - ((point - min) / spread) * 56;
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
        container.innerHTML = `
          <div class="${hostTrendClass}">
            <div class="${hostTrendHeaderClass}"><strong>${esc(props.label)}</strong><span class="${hostTrendMetaClass}">${points.length} pts</span></div>
            <svg class="${hostTrendSvgClass}" viewBox="0 0 240 96" role="img" aria-label="${esc(props.label)}">
              <path d="M10 84 H230" stroke="#e5e7eb" stroke-width="1"></path>
              <path d="${d}" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            ${props.caption ? `<p class="${hostTrendCaptionClass}">${esc(props.caption)}</p>` : ''}
          </div>`;
      },
    }),
    defineComponent<ApprovalStatusProps>({
      name: 'ApprovalStatus',
      description:
        'Trusted host status card for pending, approved, or blocked readiness gates.',
      propsSchema: approvalStatusPropsSchema,
      sizing: { height: '112px', description: 'Fits a compact status area.' },
      examples: [
        {
          name: 'Approval status',
          code: `<div data-summon-component="ApprovalStatus" data-summon-component-id="release-gate" data-summon-props='{"status":"pending","title":"Release review","detail":"Awaiting marketing approval"}' style="width:260px;height:112px;"></div>`,
        },
      ],
      render: ({ container, props }) => {
        const colors = {
          pending: ['#fff7ed', '#b45309', 'Pending'],
          approved: ['#f0fdf4', '#15803d', 'Approved'],
          blocked: ['#fff1f2', '#be123c', 'Blocked'],
        } as const;
        const [bg, fg, label] = colors[props.status];
        container.innerHTML = `
          <div class="${hostApprovalClass}" style="background:${bg};border-color:${fg};">
            <span class="${hostApprovalBadgeClass}" style="background:${fg};">${label}</span>
            <strong class="${hostApprovalTitleClass}">${esc(props.title)}</strong>
            ${props.detail ? `<p class="${hostApprovalDetailClass}">${esc(props.detail)}</p>` : ''}
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
