import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  SummonSurface,
  type SummonSurfaceHandle,
  type SummonSurfaceProps,
} from "@decentralized-design/summon-react";
import { type SurfaceSize } from "@decentralized-design/summon/engine";
import {
  Button,
  DropdownSelect,
  type DropdownSelectGroup,
} from "../../../components/ui.js";
import { cn } from "../../../lib/cn.js";
import { fingerprintOptionFor } from "../fingerprintDisplay.js";
import type { ChildSurfaceModel, GhostRootInfo } from "../types.js";
import type { GenerationTrace } from "../generationTrace.js";
import { ChildSurface } from "./ChildSurface.js";
import { ConformanceGlyphs } from "./ConformanceGlyphs.js";
import { FrameSeam } from "./FrameSeam.js";
import { ReceiptTab } from "./ReceiptTab.js";
import { TraceChoreography } from "./TraceChoreography.js";

const promptActionRadiusClass = "!rounded-[22px]";

// The frame IS the medium: one selected value drives both this container width
// and scale.size, so the prompt-derived size and visible room cannot drift.
// Full literal class strings so Tailwind's JIT keeps them.
const sandboxWidthClass: Record<SurfaceSize | "", string> = {
  "": "w-[min(1120px,calc(100%-24px))]",
  small: "w-[min(480px,calc(100%-24px))]",
  medium: "w-[min(760px,calc(100%-24px))]",
  large: "w-[min(1120px,calc(100%-24px))]",
};

interface MediumPreset {
  value: string;
  label: string;
  description: string;
  size: SurfaceSize | "";
}

const mediumPresets: MediumPreset[] = [
  { value: "auto", label: "Auto", description: "No scale block; full stage width", size: "" },
  { value: "small", label: "Card", description: "≈480px card-sized frame", size: "small" },
  { value: "medium", label: "Panel", description: "≈760px panel-sized frame", size: "medium" },
  { value: "large", label: "Page", description: "≈1120px page-sized frame", size: "large" },
];

const mediumPresetByValue = (value: string): MediumPreset =>
  mediumPresets.find((preset) => preset.value === value) ?? mediumPresets[0]!;

const mediumGroups: DropdownSelectGroup[] = [
  {
    options: mediumPresets.map(({ value, label, description }) => ({
      value,
      label,
      description,
    })),
  },
];

function mediumPresetValue(size: SurfaceSize | ""): string {
  return mediumPresets.find((preset) => preset.size === size)?.value ?? "auto";
}

export function GenerationStage({
  prompt,
  trace,
  scenarioPicker,
  setPrompt,
  selectedFingerprintId,
  fingerprints,
  onSelectFingerprint,
  scaleSize,
  onSelectScaleSize,
  running,
  onGenerate,
  statusText,
  generationDisabledReason,
  stageNotice,
  onOpenDiagnostics,
  surfaceRef,
  surfaceTokensSource,
  surfaceFontFacesSource,
  toolRegistry,
  validationTools,
  appendDevEvent,
  onSurfaceGoalRejected,
  onSurfaceHandlerError,
  onSurfaceRuntimeError,
  showWelcome,
  playgroundMode,
  surfaceInstanceKey,
  childSurfaces,
  onCloseChild,
}: {
  prompt: string;
  trace: GenerationTrace;
  scenarioPicker: ReactNode;
  setPrompt: (value: string) => void;
  selectedFingerprintId: string | null;
  fingerprints: GhostRootInfo[];
  onSelectFingerprint: (id: string | null) => void;
  scaleSize: SurfaceSize | "";
  onSelectScaleSize: (value: SurfaceSize | "") => void;
  running: boolean;
  onGenerate: (prompt: string) => void | Promise<void>;
  statusText: string;
  generationDisabledReason?: string | null;
  stageNotice: {
    tone: "pending" | "error";
    title: string;
    detail?: string;
  } | null;
  onOpenDiagnostics: () => void;
  surfaceRef: RefObject<SummonSurfaceHandle>;
  surfaceTokensSource: string;
  surfaceFontFacesSource?: string;
  toolRegistry: SummonSurfaceProps["toolRegistry"];
  validationTools: SummonSurfaceProps["validationTools"];
  appendDevEvent: SummonSurfaceProps["onEvent"];
  onSurfaceGoalRejected: SummonSurfaceProps["onToolRejected"];
  onSurfaceHandlerError: SummonSurfaceProps["onHandlerError"];
  onSurfaceRuntimeError: SummonSurfaceProps["onRuntimeError"];
  showWelcome: boolean;
  playgroundMode: boolean;
  surfaceInstanceKey: number;
  childSurfaces: ChildSurfaceModel[];
  onCloseChild: (id: number) => void;
}) {
  const showSamplePills = showWelcome && !running;
  // The sandbox frame is visible for the whole generation lifecycle: the
  // host-owned, fingerprint-derived drafting surface inside SummonSurface is
  // the loading state. No app-level loading overlay competes with it.
  const showSandboxFrame = !showWelcome;
  const selectedFingerprint =
    fingerprints.find(
      (fingerprint) => fingerprint.id === selectedFingerprintId,
    ) ?? null;
  const fingerprintLabel =
    selectedFingerprint?.name ?? selectedFingerprintId ?? "Fingerprint";
  const fingerprintGroups = useMemo<DropdownSelectGroup[]>(() => {
    const options: DropdownSelectGroup["options"] = [];

    if (selectedFingerprintId && !selectedFingerprint) {
      options.push({
        value: selectedFingerprintId,
        label: fingerprintLabel,
        meta: "Missing from catalog",
        title: "Selected fingerprint is not in the current catalog.",
      });
    }

    options.push(...fingerprints.map(fingerprintOptionFor));

    return [{ options }];
  }, [
    fingerprintLabel,
    fingerprints,
    selectedFingerprint,
    selectedFingerprintId,
  ]);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);
  const [showWelcomeLayer, setShowWelcomeLayer] = useState(showWelcome);
  const generateDisabled = Boolean(
    running || !prompt.trim() || generationDisabledReason,
  );
  const [surfaceOverflowing, setSurfaceOverflowing] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [framePulse, setFramePulse] = useState(false);
  const pulseTimerRef = useRef<number | null>(null);
  const handleGatherAbsorbed = useCallback(() => {
    setFramePulse(true);
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setFramePulse(false), 420);
  }, []);
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showSandboxFrame) {
      setSurfaceOverflowing(false);
      return;
    }

    const root = surfaceRef.current?.root;
    if (!root) return;

    const updateOverflow = () => {
      setSurfaceOverflowing(root.scrollHeight > root.clientHeight + 1);
    };
    updateOverflow();
    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(root);
    Array.from(root.children).forEach((child) => resizeObserver.observe(child));
    return () => resizeObserver.disconnect();
  }, [showSandboxFrame, surfaceInstanceKey, surfaceRef]);

  useEffect(() => {
    if (showWelcome) {
      setWelcomeLeaving(false);
      setShowWelcomeLayer(true);
      return;
    }

    setWelcomeLeaving(true);
    const timer = window.setTimeout(() => {
      setShowWelcomeLayer(false);
      setWelcomeLeaving(false);
    }, 360);

    return () => window.clearTimeout(timer);
  }, [showWelcome]);

  return (
    <main className="absolute inset-0 min-h-0">
      <section
        className="absolute inset-0 overflow-hidden bg-surface px-4 pb-[184px] pt-[76px] max-[760px]:pb-[244px]"
        aria-label="Generated surface"
      >
        <div
          className={cn(
            "relative z-[2] mx-auto min-h-[280px] max-h-[calc(100vh-260px)] transition-[opacity,filter,transform,width] duration-700 ease-out max-[760px]:max-h-[calc(100vh-320px)]",
            sandboxWidthClass[scaleSize],
            showSandboxFrame
              ? "translate-y-0 scale-100 opacity-100 blur-0"
              : "pointer-events-none translate-y-6 scale-[0.96] opacity-0 blur-lg",
          )}
        >
          <div
            id="sandbox-frame"
            ref={frameRef}
            className={cn(
              "relative z-0 h-auto min-h-[280px] max-h-full overflow-hidden rounded-[32px] border border-line bg-surface-raised shadow-elevated transition-[opacity,filter,transform] duration-700 ease-out motion-safe:animate-[summon-sandbox-rise_960ms_cubic-bezier(0.16,1,0.3,1)_both]",
              framePulse && "ring-2 ring-accent/35",
            )}
          >
            <span id="surface-status" className="sr-only">
              {statusText}
            </span>
            <SummonSurface
              key={surfaceInstanceKey}
              ref={surfaceRef}
              id="sandbox"
              className="block max-h-full w-full overflow-auto border-0 bg-surface"
              title="Summon generate sandbox"
              tokensSource={surfaceTokensSource}
              fontFacesSource={surfaceFontFacesSource}
              toolRegistry={toolRegistry}
              validationTools={validationTools}
              onEvent={appendDevEvent}
              onToolRejected={onSurfaceGoalRejected}
              onHandlerError={onSurfaceHandlerError}
              onRuntimeError={onSurfaceRuntimeError}
            />
            <ConformanceGlyphs trace={trace} />
            <ReceiptTab trace={trace} />
            {surfaceOverflowing ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] flex justify-center rounded-b-[32px] bg-gradient-to-t from-surface-raised via-surface-raised/72 to-transparent pb-3 pt-10" aria-hidden="true">
                <span className="rounded-full border border-line bg-surface-raised/95 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-ink-muted shadow-card">
                  scrolls ↓
                </span>
              </div>
            ) : null}
            {stageNotice ? (
              <div
                className="absolute inset-0 z-[2] flex items-center justify-center bg-surface/95 px-6 text-center transition-[opacity,filter,transform] duration-500 ease-out motion-safe:animate-[summon-blur-fade-up_500ms_cubic-bezier(0.22,1,0.36,1)_both]"
                id="stage-notice"
                role={stageNotice.tone === "error" ? "alert" : "status"}
              >
                <div className="grid max-w-[min(520px,100%)] justify-items-center gap-3">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">
                    {statusText}
                  </div>
                  <div
                    className={
                      stageNotice.tone === "error"
                        ? "text-[18px] font-semibold leading-tight text-danger"
                        : "text-[18px] font-semibold leading-tight text-ink"
                    }
                  >
                    {stageNotice.title}
                  </div>
                  {stageNotice.detail ? (
                    <p className="m-0 max-w-[48ch] text-[13px] leading-normal tracking-normal text-ink-muted">
                      {stageNotice.detail}
                    </p>
                  ) : null}
                  {stageNotice.tone === "error" ? (
                    <Button
                      id="open-diagnostics"
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-1"
                      onClick={onOpenDiagnostics}
                    >
                      Diagnostics
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <FrameSeam trace={trace} running={running} />
          <TraceChoreography
            trace={trace}
            frameRef={frameRef}
            onAbsorb={handleGatherAbsorbed}
          />
        </div>
      </section>

      {showWelcomeLayer ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-0 z-30 overflow-hidden bg-surface",
            welcomeLeaving
              ? "motion-safe:animate-[summon-title-fade-back_360ms_cubic-bezier(0.32,0,0.67,0)_both]"
              : "motion-safe:animate-[summon-title-rise_680ms_cubic-bezier(0.22,1,0.36,1)_both]",
          )}
          id="welcome"
        >
          <div className="summon-page-dot-field" aria-hidden="true" />
          <div
            className="relative z-[1] flex h-full items-center px-[clamp(24px,7vw,96px)]"
            id="welcome-text"
          >
            <div className="grid w-full justify-center gap-5">
              <h2 className="m-0 mb-[100px] max-w-[10ch] text-[clamp(56px,10vw,128px)] font-medium leading-[0.86] tracking-[-0.055em] text-ink">
                just summon it.
              </h2>
            </div>
          </div>
        </div>
      ) : null}

      <form
        id="form"
        className="fixed inset-x-0 bottom-0 z-40 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          const value = prompt.trim();
          if (value && !generationDisabledReason) void onGenerate(value);
        }}
      >
        <div className="mx-auto grid w-[min(1120px,calc(100%-24px))] gap-2.5 transition-[opacity,transform] duration-700 ease-out motion-safe:animate-[summon-title-rise_720ms_cubic-bezier(0.22,1,0.36,1)_140ms_both]">
          <div
            className={cn(
              "min-w-0 px-1 pb-1 transition-[opacity,filter,transform] duration-300 ease-out",
              showSamplePills
                ? "translate-y-0 scale-100 opacity-100 blur-0"
                : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0 blur-sm",
            )}
            aria-hidden={!showSamplePills}
          >
            {scenarioPicker}
          </div>
          <div className="rounded-t-[32px] bg-surface-raised/92 p-2 shadow-elevated backdrop-blur-xl">
            <div className="flex items-start gap-2 max-[760px]:grid">
              <label className="min-w-0 flex-1" htmlFor="prompt">
                <span className="sr-only">Prompt</span>
                <textarea
                  id="prompt"
                  rows={1}
                  className="max-h-32 min-h-18 w-full resize-none border-0 bg-transparent px-4 py-3 text-[15px] leading-[1.4] text-ink placeholder:text-ink-muted focus:outline-none"
                  placeholder="Describe the surface you need..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              </label>
              <div className="flex items-center gap-1 pl-1 max-[760px]:justify-between max-[760px]:px-3 max-[760px]:pb-1">
                <DropdownSelect
                  id="fingerprint-picker"
                  value={selectedFingerprintId ?? ""}
                  groups={fingerprintGroups}
                  overline="Fingerprint"
                  placeholder="Fingerprint"
                  title={
                    selectedFingerprint?.summary ??
                    generationDisabledReason ??
                    "Choose a fingerprint"
                  }
                  side="top"
                  align="end"
                  disabled={running || fingerprints.length === 0}
                  className="w-[180px] max-w-[46vw]"
                  triggerClassName={cn(
                    "h-20 !border-0 !bg-ink px-3 py-0 text-xs font-semibold !text-ink-inverse shadow-none hover:opacity-85 focus:border-transparent",
                    promptActionRadiusClass,
                  )}
                  contentClassName="w-[min(320px,calc(100vw-32px))] !rounded-[32px] max-[760px]:left-0 max-[760px]:right-auto"
                  onValueChange={(nextValue) =>
                    nextValue ? onSelectFingerprint(nextValue) : undefined
                  }
                />
                <DropdownSelect
                  id="scale-picker"
                  value={mediumPresetValue(scaleSize)}
                  groups={mediumGroups}
                  overline="Medium"
                  placeholder="Auto"
                  title="Physical medium for the surface"
                  side="top"
                  align="end"
                  disabled={running}
                  className="w-[150px] max-w-[34vw]"
                  triggerClassName={cn(
                    "h-20 !border-0 !bg-ink px-3 py-0 text-xs font-semibold !text-ink-inverse shadow-none hover:opacity-85 focus:border-transparent",
                    promptActionRadiusClass,
                  )}
                  contentClassName="w-[min(300px,calc(100vw-32px))] !rounded-[32px] max-[760px]:left-auto max-[760px]:right-0"
                  onValueChange={(nextValue) => {
                    const preset = mediumPresetByValue(nextValue);
                    onSelectScaleSize(preset.size);
                  }}
                />
                <Button
                  id="go"
                  type="submit"
                  className={cn("h-20 w-24 px-5", promptActionRadiusClass)}
                  title={generationDisabledReason ?? undefined}
                  disabled={generateDisabled}
                >
                  {running ? "summoning" : "summon"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div
        id="children"
        className="fixed right-6 top-20 z-30 flex max-h-[calc(100vh-180px)] w-[min(520px,calc(100vw-48px))] flex-col gap-2.5 overflow-auto max-[820px]:left-4 max-[820px]:right-4 max-[820px]:top-[72px] max-[820px]:w-auto [&>*]:transition-[opacity,filter,transform] [&>*]:duration-500 [&>*]:ease-out [&>*]:motion-safe:animate-[summon-blur-fade-up_520ms_cubic-bezier(0.22,1,0.36,1)_both]"
        aria-label="Summoned sibling sandboxes"
      >
        {childSurfaces.map((child) => (
          <ChildSurface
            key={child.id}
            child={child}
            onClose={() => onCloseChild(child.id)}
          />
        ))}
      </div>
    </main>
  );
}
