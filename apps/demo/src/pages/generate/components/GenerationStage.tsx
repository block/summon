import type { ReactNode, RefObject } from "react";
import {
  SummonSurface,
  type SummonSurfaceHandle,
  type SummonSurfaceProps,
} from "@anarchitecture/summon-react";
import { Button } from "../../../components/ui.js";
import type { ChildSurfaceModel } from "../types.js";
import { ChildSurface } from "./ChildSurface.js";

export function GenerationStage({
  prompt,
  scenarioPicker,
  setPrompt,
  running,
  onGenerate,
  statusText,
  stageNotice,
  onOpenDiagnostics,
  surfaceRef,
  surfaceTokensSource,
  toolRegistry,
  componentRegistry,
  validationTools,
  grantedComponents,
  appendDevEvent,
  onSurfaceGoalRejected,
  onSurfaceHandlerError,
  onSurfaceComponentError,
  showWelcome,
  childSurfaces,
  onCloseChild,
}: {
  prompt: string;
  scenarioPicker: ReactNode;
  setPrompt: (value: string) => void;
  running: boolean;
  onGenerate: (prompt: string) => void | Promise<void>;
  statusText: string;
  stageNotice: { tone: "pending" | "error"; title: string; detail?: string } | null;
  onOpenDiagnostics: () => void;
  surfaceRef: RefObject<SummonSurfaceHandle>;
  surfaceTokensSource: string;
  toolRegistry: SummonSurfaceProps["toolRegistry"];
  componentRegistry: SummonSurfaceProps["componentRegistry"];
  validationTools: SummonSurfaceProps["validationTools"];
  grantedComponents: SummonSurfaceProps["artifactComponents"];
  appendDevEvent: SummonSurfaceProps["onEvent"];
  onSurfaceGoalRejected: SummonSurfaceProps["onToolRejected"];
  onSurfaceHandlerError: SummonSurfaceProps["onHandlerError"];
  onSurfaceComponentError: SummonSurfaceProps["onComponentError"];
  showWelcome: boolean;
  childSurfaces: ChildSurfaceModel[];
  onCloseChild: (id: number) => void;
}) {
  return (
    <main>
      <section
        className="absolute inset-x-6 bottom-32 top-20 overflow-hidden rounded-[28px] bg-surface-raised shadow-card max-[820px]:inset-x-4 max-[820px]:top-[72px] max-[700px]:bottom-44"
        aria-label="Generated surface"
      >
        <span id="iframe-status" className="sr-only">
          {statusText}
        </span>
        <SummonSurface
          ref={surfaceRef}
          id="sandbox"
          className="h-full min-h-0 w-full border-0 bg-surface-raised"
          title="Summon generate sandbox"
          tokensSource={surfaceTokensSource}
          toolRegistry={toolRegistry}
          componentRegistry={componentRegistry}
          validationTools={validationTools}
          artifactComponents={grantedComponents}
          onEvent={appendDevEvent}
          onToolRejected={onSurfaceGoalRejected}
          onHandlerError={onSurfaceHandlerError}
          onComponentError={onSurfaceComponentError}
        />
        {showWelcome ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-surface transition-opacity duration-300"
            id="welcome"
          >
            <div
              className="grid max-w-[min(460px,calc(100%-48px))] justify-items-center gap-4 text-center"
              id="welcome-text"
            >
              <div className="h-14 w-14 rounded-[18px] border border-line bg-surface-muted" />
              <p className="m-0 text-[15px] leading-normal tracking-normal text-ink-muted">
                Describe a surface to generate.
              </p>
            </div>
          </div>
        ) : null}
        {stageNotice ? (
          <div
            className="absolute inset-0 z-[2] flex items-center justify-center bg-surface/95 px-6 text-center"
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
      </section>

      <form
        id="form"
        className="fixed inset-x-0 bottom-6 z-40 px-6 max-[820px]:bottom-4 max-[820px]:px-4"
        onSubmit={(event) => {
          event.preventDefault();
          const value = prompt.trim();
          if (value) void onGenerate(value);
        }}
      >
        <div className="mx-auto flex w-[min(1060px,100%)] items-end gap-3 max-[700px]:grid max-[700px]:grid-cols-1">
          <div className="w-[min(240px,32vw)] shrink-0 max-[700px]:w-full">
            {scenarioPicker}
          </div>
          <div className="min-w-0 flex-1 rounded-[30px] bg-surface-raised p-2 shadow-card">
            <label className="sr-only" htmlFor="prompt">
              Prompt
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="prompt"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-[1.35] text-ink placeholder:text-ink-muted focus:outline-none"
                placeholder="describe a surface..."
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
              <Button
                id="go"
                type="submit"
                className="h-11 rounded-full px-5"
                disabled={running || !prompt.trim()}
              >
                {running ? "Generating" : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <div
        id="children"
        className="fixed right-6 top-20 z-30 flex max-h-[calc(100vh-180px)] w-[min(520px,calc(100vw-48px))] flex-col gap-2.5 overflow-auto max-[820px]:left-4 max-[820px]:right-4 max-[820px]:top-[72px] max-[820px]:w-auto"
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
