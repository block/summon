import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  SummonSurface,
  type SummonSurfaceHandle,
  type SummonSurfaceProps,
} from "@anarchitecture/summon-react";
import {
  SUMMON_OUTPUT_RUNTIME_VALUES,
  runtimeProfile,
  type RuntimeProfile,
  type SummonOutputRuntime,
} from "@anarchitecture/summon/engine";
import {
  Button,
  DropdownSelect,
  type DropdownSelectGroup,
} from "../../../components/ui.js";
import { cn } from "../../../lib/cn.js";
import { fingerprintOptionFor } from "../fingerprintDisplay.js";
import type { GenerationPreviewModel } from "../generationPreview.js";
import type { ChildSurfaceModel, GhostRootInfo } from "../types.js";
import { ChildSurface } from "./ChildSurface.js";
import { SurfaceLoadingOverlay } from "./SurfaceLoadingOverlay.js";

const promptActionRadiusClass = "!rounded-[22px]";

const runtimeCopy: Record<
  SummonOutputRuntime,
  { label: string; description: string }
> = {
  "arrow-control": {
    label: "Arrow control",
    description:
      "Structured Arrow bundle with host-owned tools and state bridge.",
  },
  "html-static": {
    label: "HTML static",
    description:
      "Structured inert HTML/CSS bundle optimized for rich visual composition.",
  },
  "html-stream": {
    label: "HTML stream",
    description:
      "Raw model stream framed as scaffold plus validated patch commits.",
  },
  "domjs-control": {
    label: "domjs control",
    description:
      "Imperative HTML/JS authored by the model, executed in the surface-vm capability sandbox.",
  },
};

const runtimeGroupDefinitions: Array<{
  label: string;
  includes: (profile: RuntimeProfile) => boolean;
}> = [
  {
    label: "Arrow bundle",
    includes: (profile) =>
      profile.format === "arrow" && profile.delivery === "bundle",
  },
  {
    label: "HTML bundle",
    includes: (profile) =>
      profile.format === "html" && profile.delivery === "bundle",
  },
  {
    label: "HTML stream",
    includes: (profile) =>
      profile.format === "html" && profile.delivery === "stream",
  },
  {
    label: "domjs (sandboxed HTML/JS)",
    includes: (profile) => profile.format === "domjs",
  },
];

function runtimeGroups(): DropdownSelectGroup[] {
  return runtimeGroupDefinitions
    .map((group) => ({
      label: group.label,
      options: SUMMON_OUTPUT_RUNTIME_VALUES
        .filter((runtime) => group.includes(runtimeProfile(runtime)))
        .map((runtime) => ({
          value: runtime,
          label: runtimeCopy[runtime].label,
          description: runtimeCopy[runtime].description,
        })),
    }))
    .filter((group) => group.options.length > 0);
}

export function GenerationStage({
  prompt,
  scenarioPicker,
  setPrompt,
  selectedFingerprintId,
  fingerprints,
  onSelectFingerprint,
  experimentalRuntime,
  onSelectExperimentalRuntime,
  running,
  onGenerate,
  statusText,
  generationDisabledReason,
  generationPreview,
  stageNotice,
  onOpenDiagnostics,
  surfaceRef,
  surfaceTokensSource,
  toolRegistry,
  validationTools,
  appendDevEvent,
  onSurfaceGoalRejected,
  onSurfaceHandlerError,
  onSurfaceRuntimeError,
  showWelcome,
  hasRenderedArtifact,
  surfaceReady,
  playgroundMode,
  surfaceInstanceKey,
  childSurfaces,
  onCloseChild,
}: {
  prompt: string;
  scenarioPicker: ReactNode;
  setPrompt: (value: string) => void;
  selectedFingerprintId: string | null;
  fingerprints: GhostRootInfo[];
  onSelectFingerprint: (id: string | null) => void;
  experimentalRuntime: SummonOutputRuntime;
  onSelectExperimentalRuntime: (runtime: SummonOutputRuntime) => void;
  running: boolean;
  onGenerate: (prompt: string) => void | Promise<void>;
  statusText: string;
  generationDisabledReason?: string | null;
  generationPreview: GenerationPreviewModel;
  stageNotice: {
    tone: "pending" | "error";
    title: string;
    detail?: string;
  } | null;
  onOpenDiagnostics: () => void;
  surfaceRef: RefObject<SummonSurfaceHandle>;
  surfaceTokensSource: string;
  toolRegistry: SummonSurfaceProps["toolRegistry"];
  validationTools: SummonSurfaceProps["validationTools"];
  appendDevEvent: SummonSurfaceProps["onEvent"];
  onSurfaceGoalRejected: SummonSurfaceProps["onToolRejected"];
  onSurfaceHandlerError: SummonSurfaceProps["onHandlerError"];
  onSurfaceRuntimeError: SummonSurfaceProps["onRuntimeError"];
  showWelcome: boolean;
  hasRenderedArtifact: boolean;
  surfaceReady: boolean;
  playgroundMode: boolean;
  surfaceInstanceKey: number;
  childSurfaces: ChildSurfaceModel[];
  onCloseChild: (id: number) => void;
}) {
  const selectedRuntimeProfile = runtimeProfile(experimentalRuntime);
  const isStreamDelivery = selectedRuntimeProfile.delivery === "stream";
  const runtimeGroupOptions = useMemo(() => runtimeGroups(), []);
  const showSamplePills = showWelcome && !running;
  const showHostLoader =
    !isStreamDelivery &&
    !showWelcome &&
    !stageNotice &&
    !surfaceReady &&
    (running || hasRenderedArtifact);
  const showSandboxFrame =
    !showWelcome &&
    (surfaceReady || stageNotice !== null || isStreamDelivery);
  const selectedFingerprint =
    fingerprints.find(
      (fingerprint) => fingerprint.id === selectedFingerprintId,
    ) ?? null;
  const fingerprintLabel =
    selectedFingerprint?.name ?? selectedFingerprintId ?? "Fingerprint";
  const selectedRuntimeOption =
    runtimeGroupOptions
      .flatMap((group) => group.options)
      .find((option) => option.value === experimentalRuntime) ??
    runtimeGroupOptions[0]?.options[0];
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
        {showHostLoader ? (
          <SurfaceLoadingOverlay
            statusText={statusText}
            preview={generationPreview}
            fullPage
          />
        ) : null}
        <div
          className={cn(
            "relative z-[2] mx-auto h-[calc(100vh-260px)] min-h-0 w-[min(1120px,calc(100%-24px))] transition-[opacity,filter,transform] duration-700 ease-out max-[760px]:h-[calc(100vh-320px)]",
            showSandboxFrame
              ? "translate-y-0 scale-100 opacity-100 blur-0"
              : "pointer-events-none translate-y-6 scale-[0.96] opacity-0 blur-lg",
          )}
        >
          <div
            id="sandbox-frame"
            className="relative z-0 h-full min-h-0 overflow-hidden rounded-[32px] border border-line bg-surface-raised shadow-elevated transition-[opacity,filter,transform] duration-700 ease-out motion-safe:animate-[summon-sandbox-rise_960ms_cubic-bezier(0.16,1,0.3,1)_both]"
          >
            <span id="surface-status" className="sr-only">
              {statusText}
            </span>
            <SummonSurface
              key={surfaceInstanceKey}
              ref={surfaceRef}
              id="sandbox"
              className="block h-full min-h-0 w-full overflow-auto border-0 bg-surface"
              title="Summon generate sandbox"
              tokensSource={surfaceTokensSource}
              toolRegistry={toolRegistry}
              validationTools={validationTools}
              onEvent={appendDevEvent}
              onToolRejected={onSurfaceGoalRejected}
              onHandlerError={onSurfaceHandlerError}
              onRuntimeError={onSurfaceRuntimeError}
            />
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
                  id="stream-type-picker"
                  value={experimentalRuntime}
                  groups={runtimeGroupOptions}
                  overline="Runtime"
                  placeholder="Arrow control"
                  title={
                    selectedRuntimeOption?.description ??
                    "Choose output runtime"
                  }
                  side="top"
                  align="end"
                  disabled={running}
                  className="w-[168px] max-w-[38vw]"
                  triggerClassName={cn(
                    "h-20 !border-0 !bg-ink px-3 py-0 text-xs font-semibold !text-ink-inverse shadow-none hover:opacity-85 focus:border-transparent",
                    promptActionRadiusClass,
                  )}
                  contentClassName="w-[min(300px,calc(100vw-32px))] !rounded-[32px] max-[760px]:left-auto max-[760px]:right-0"
                  onValueChange={(nextValue) =>
                    onSelectExperimentalRuntime(
                      nextValue as SummonOutputRuntime,
                    )
                  }
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
