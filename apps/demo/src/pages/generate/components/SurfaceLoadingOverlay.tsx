import type { CSSProperties } from "react";
import { cn } from "../../../lib/cn.js";
import type {
  GenerationPreviewModel,
  GenerationPreviewSection,
} from "../generationPreview.js";

const dotGridSide = 11;
const dotGridCenter = (dotGridSide - 1) / 2;
const maxDotDistance = Math.hypot(dotGridCenter, dotGridCenter);
const rippleDots = Array.from({ length: dotGridSide * dotGridSide }, (_, index) => {
  const x = index % dotGridSide;
  const y = Math.floor(index / dotGridSide);
  const distance = Math.hypot(x - dotGridCenter, y - dotGridCenter);
  const normalized = distance / maxDotDistance;
  const delay = Math.round(distance * 72 + ((x * 7 + y * 3) % 5) * 10);
  const opacity = Math.max(0.2, 0.8 - normalized * 0.5);
  const scale = Math.max(0.62, 1.08 - normalized * 0.42);

  return {
    id: `${x}-${y}`,
    style: {
      "--ripple-delay": `${delay}ms`,
      "--dot-rest-opacity": Math.max(0.1, opacity * 0.3).toFixed(2),
      "--dot-settle-opacity": Math.max(0.14, opacity * 0.58).toFixed(2),
      "--dot-peak-opacity": opacity.toFixed(2),
      "--dot-rest-scale": Math.max(0.38, scale * 0.68).toFixed(2),
      "--dot-settle-scale": Math.max(0.5, scale * 1.04).toFixed(2),
      "--dot-peak-scale": Math.max(0.72, scale * 1.62).toFixed(2),
    } as CSSProperties,
  };
});

export function SurfaceLoadingOverlay({
  statusText,
  preview,
  label = "summoning",
  compact = false,
  fullPage = false,
  className,
}: {
  statusText: string;
  preview?: GenerationPreviewModel;
  label?: string;
  compact?: boolean;
  fullPage?: boolean;
  className?: string;
}) {
  const sections = (preview?.sections ?? []).slice(0, compact ? 3 : 4);

  return (
    <div
      className={cn(
        "pointer-events-none inset-0 flex items-center justify-center overflow-hidden bg-surface/96 px-6 text-center backdrop-blur-md transition-[opacity,filter,transform] duration-500 ease-out motion-safe:animate-[summon-blur-fade-up_420ms_cubic-bezier(0.22,1,0.36,1)_both]",
        fullPage ? "fixed z-50" : "absolute z-[3]",
        className,
      )}
      data-summon-host-loader
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${preview?.phase ?? statusText}`}
    >
      <div
        className={cn(
          "summon-host-dot-field",
          fullPage && "summon-host-dot-field--page-pulse",
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative z-[1] grid w-full justify-items-center",
          compact ? "max-w-[320px] gap-2.5" : "max-w-[520px] gap-4",
        )}
      >
        <div
          className={cn(
            "summon-host-ripple-grid",
            compact && "summon-host-ripple-grid--compact",
          )}
          aria-hidden="true"
        >
          {rippleDots.map((dot) => (
            <span
              key={dot.id}
              className="summon-host-ripple-dot"
              style={dot.style}
            />
          ))}
        </div>
        <div className="grid max-w-[34ch] gap-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">
            {label}
          </span>
          <span
            className={cn(
              "font-medium leading-snug text-ink-soft",
              compact ? "text-[12px]" : "text-[13px]",
            )}
          >
            {preview?.phase ?? statusText}
          </span>
        </div>
        {sections.length > 0 ? (
          <div
            className={cn(
              "summon-host-preview-sketch grid w-full min-w-0 gap-3 text-left",
              compact ? "mt-1 gap-2" : "mt-2",
            )}
            data-summon-preview-sketch
            aria-hidden="true"
          >
            <div className="grid gap-2.5">
              {sections.map((section, index) => (
                <PreviewSection
                  key={section.id}
                  section={section}
                  index={index}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewSection({
  section,
  index,
  compact,
}: {
  section: GenerationPreviewSection;
  index: number;
  compact: boolean;
}) {
  const widths = compact ? ["74%", "62%", "68%"] : ["78%", "92%", "66%", "84%"];
  const width = widths[index % widths.length] ?? "72%";

  return (
    <div
      className="grid min-w-0 gap-1.5"
      data-summon-preview-section
      style={{ "--preview-bar-width": width } as CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "summon-host-preview-pin shrink-0",
            section.source === "stream" && "summon-host-preview-pin--live",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium leading-tight text-ink-soft",
            compact ? "text-[11px]" : "text-[12px]",
          )}
        >
          {section.label}
        </span>
        {!compact ? (
          <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-normal text-ink-muted">
            {section.role ?? section.source}
          </span>
        ) : null}
      </div>
      <span className="summon-host-preview-bar" />
      {!compact && section.summary ? (
        <span className="min-w-0 truncate text-[11px] leading-tight text-ink-muted">
          {section.summary}
        </span>
      ) : null}
    </div>
  );
}
