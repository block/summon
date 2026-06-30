import type { CSSProperties } from "react";
import { cn } from "../../../lib/cn.js";
import type {
  GenerationPreviewModel,
  GenerationPreviewSection,
} from "../generationPreview.js";

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
      {fullPage ? (
        <div className="summon-host-ripple-waves" aria-hidden="true">
          <span className="summon-host-ripple-wave" />
          <span className="summon-host-ripple-wave" />
          <span className="summon-host-ripple-wave" />
          <span className="summon-host-ripple-wave" />
        </div>
      ) : null}
      <div
        className={cn(
          "relative z-[1] grid w-full justify-items-center",
          compact ? "max-w-[320px] gap-2.5" : "max-w-[520px] gap-4",
        )}
      >
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
