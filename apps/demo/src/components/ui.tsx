import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn.js";

export const pageWidthClass = "mx-auto w-[min(100%,var(--dev-page-width))]";

export const fieldLabelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-normal text-ink-muted";

export const eyebrowClass =
  "font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted";

export const panelClass =
  "overflow-hidden rounded-card border border-line bg-surface shadow-none";

export const elevatedPanelClass = cn(panelClass, "shadow-card");

export const panelHeaderClass =
  "flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-3.5 py-3 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted";

const controlBaseClass =
  "min-w-0 rounded-control border border-line-input bg-surface-raised text-sm text-ink transition-[border-color,box-shadow,background-color,color] duration-150 focus:border-line-strong focus:outline-none focus:ring-3 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45";

export const inputClass = cn(controlBaseClass, "px-3.5 py-3");
export const compactInputClass = cn(
  controlBaseClass,
  "h-[30px] px-3.5 py-0 text-xs font-medium",
);
export const textareaClass = cn(
  controlBaseClass,
  "min-h-[88px] resize-y px-3.5 py-3",
);
export const selectClass = cn(
  controlBaseClass,
  "cursor-pointer appearance-none px-3.5 py-3 pr-8",
);
export const compactSelectClass = cn(
  selectClass,
  "h-[30px] py-0 text-xs font-medium",
);

export type ButtonVariant = "primary" | "secondary" | "chip" | "ghost";
export type ButtonSize = "default" | "sm" | "xs" | "icon-xs";

const buttonBaseClass =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-normal transition-[background-color,border-color,color,opacity,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-40";

export function buttonClass({
  variant = "primary",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    buttonBaseClass,
    variant === "primary" &&
      "border border-transparent bg-ink text-ink-inverse hover:opacity-85",
    variant === "secondary" &&
      "border border-line-input bg-surface text-ink-soft hover:border-line-hover hover:bg-surface-muted hover:text-ink",
    variant === "chip" &&
      "border border-transparent bg-surface-muted text-ink hover:border-line-hover hover:bg-surface",
    variant === "ghost" &&
      "border border-line-input bg-transparent text-ink-soft hover:border-line-hover hover:bg-surface-muted hover:text-ink",
    size === "default" && "h-11 px-6 text-sm",
    size === "sm" && "h-9 px-4 text-[13px]",
    size === "xs" && "h-7 px-3 text-xs",
    size === "icon-xs" && "h-7 w-7 px-0 text-xs",
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClass({ variant, size, className })} {...props} />
  );
}

export function FieldLabel({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn(fieldLabelClass, className)} {...props} />;
}

export function StatusText({
  className,
  children,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-medium normal-case tracking-normal text-ink-muted",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function modeOptionClass(active: boolean): string {
  return cn(
    "rounded-full px-3 py-1 text-xs font-medium text-ink-soft transition-colors duration-150 hover:text-ink",
    active && "bg-ink font-semibold text-ink-inverse hover:text-ink-inverse",
  );
}

export function logToneClass(tone?: string): string {
  const tones = new Set((tone ?? "").split(/\s+/).filter(Boolean));
  return cn(
    tones.has("pass") || tones.has("op-add") ? "font-semibold text-good" : null,
    tones.has("fail") || tones.has("op-error")
      ? "font-semibold text-danger"
      : null,
    tones.has("op-set") ? "text-info" : null,
    tones.has("op-meta") ? "text-ink-muted" : null,
    tones.has("raw") ? "text-line-hover" : null,
    tones.has("info") || tones.size === 0 ? "text-ink-soft" : null,
  );
}

export function statusToneClass(status?: string): string {
  if (!status) return "text-ink-muted";
  if (status === "streaming") return "font-semibold text-info";
  if (status === "done" || status.startsWith("done"))
    return "font-semibold text-good";
  if (status === "error" || status.startsWith("error") || status === "aborted")
    return "font-semibold text-danger";
  return "text-ink-muted";
}

export function devtoolsEventKindClass(kind: string): string {
  if (
    kind === "surface-mounted" ||
    kind === "surface-preview-event" ||
    kind === "rendered"
  )
    return "text-good";
  if (
    kind === "surface-runtime-error" ||
    kind === "surface-disposed" ||
    kind === "tool-rejected" ||
    kind === "transport-parse-error"
  ) {
    return "text-danger";
  }
  if (
    kind === "tool-called" ||
    kind === "tool-dispatched" ||
    kind === "state-pushed"
  )
    return "text-info";
  if (kind === "tool-settled") return "text-ink-soft";
  return "text-ink-muted";
}

export function DetailsShell({
  className,
  children,
  ...props
}: ComponentProps<"div"> & { children: ReactNode }) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DropdownSelectOption {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  swatches?: string[];
  title?: string;
  disabled?: boolean;
}

export interface DropdownSelectGroup {
  label?: string;
  options: DropdownSelectOption[];
}

export function DropdownSelect({
  id,
  value,
  groups,
  onValueChange,
  placeholder = "Select",
  overline,
  disabled,
  title,
  ariaLabel,
  side = "bottom",
  align = "start",
  className,
  triggerClassName,
  contentClassName,
}: {
  id?: string;
  value: string;
  groups: DropdownSelectGroup[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  overline?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  side?: "top" | "bottom";
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  const generatedId = useId();
  const triggerId = id ?? `dropdown-select-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  );
  const selectedOption = options.find((option) => option.value === value);
  const selectedHasSwatches = Boolean(selectedOption?.swatches?.length);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const initialActiveIndex =
    selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);

  useEffect(() => {
    if (open) setActiveIndex(initialActiveIndex);
  }, [initialActiveIndex, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const frame = window.requestAnimationFrame(() => {
      itemRefs.current[activeIndex]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, open]);

  const selectOption = (option: DropdownSelectOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveActiveIndex = (direction: 1 | -1) => {
    const nextIndex = nextEnabledIndex(options, activeIndex, direction);
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  };

  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(
        event.key === "ArrowUp"
          ? lastEnabledIndex(options)
          : initialActiveIndex,
      );
    }
  };

  const handleItemKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    option: DropdownSelectOption,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(options));
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex(options));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(option);
      return;
    }
    if (event.key === "Tab") setOpen(false);
  };

  let optionIndex = 0;

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-block min-w-0", className)}
    >
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        className={cn(
          controlBaseClass,
          "flex min-h-[30px] w-full min-w-0 items-center justify-between gap-2 px-3 text-left text-xs font-medium",
          triggerClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        title={title ?? selectedOption?.title ?? selectedOption?.description}
        data-state={open ? "open" : "closed"}
        onClick={() => {
          setOpen((current) => !current);
          setActiveIndex(initialActiveIndex);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={cn(
            "min-w-0 flex-1 leading-none",
            selectedHasSwatches ? "grid gap-1 py-1" : "flex items-center gap-2",
          )}
        >
          {selectedHasSwatches ? (
            <>
              <span className="min-w-0 truncate leading-tight text-inherit">
                {selectedOption?.label ?? placeholder}
              </span>
              <PreviewSwatches colors={selectedOption?.swatches} />
              {selectedOption?.meta ? (
                <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-normal text-current opacity-55">
                  {selectedOption.meta}
                </span>
              ) : null}
            </>
          ) : (
            <span className="grid min-w-0 gap-0.5">
              {overline ? (
                <span className="font-mono text-[10px] font-semibold uppercase tracking-normal text-current opacity-55">
                  {overline}
                </span>
              ) : null}
              <span className="min-w-0 truncate leading-tight text-inherit">
                {selectedOption?.label ?? placeholder}
              </span>
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-current opacity-55 transition-transform duration-150",
            open && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className={cn(
            "absolute z-[70] max-h-[min(360px,calc(100vh-220px))] min-w-full overflow-y-auto rounded-card border border-line bg-surface-raised p-2 text-ink shadow-elevated outline-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "end" ? "right-0" : "left-0",
            contentClassName,
          )}
        >
          {groups.map((group, groupIndex) => (
            <div
              key={group.label ?? groupIndex}
              role="group"
              aria-label={group.label}
            >
              {/* {group.label ? (
                <div className="px-2.5 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted first:pt-1">
                  {group.label}
                </div>
              ) : null} */}
              {group.options.map((option) => {
                const currentIndex = optionIndex++;
                const selected = option.value === value;
                return (
                  <button
                    key={`${option.value}-${currentIndex}`}
                    ref={(element) => {
                      itemRefs.current[currentIndex] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    title={option.title ?? option.description}
                    className={cn(
                      "relative flex w-full min-w-0 items-start gap-2 rounded-[22px] px-2.5 py-2 mb-2 text-left text-xs outline-none transition-colors duration-150 hover:bg-surface-muted focus:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45",
                      selected && "bg-surface-muted text-ink",
                    )}
                    onClick={() => selectOption(option)}
                    onFocus={() => setActiveIndex(currentIndex)}
                    onMouseEnter={() => setActiveIndex(currentIndex)}
                    onKeyDown={(event) => handleItemKeyDown(event, option)}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-ink">
                      {selected ? (
                        <svg
                          viewBox="0 0 16 16"
                          aria-hidden="true"
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m3.5 8 3 3 6-6" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="truncate font-semibold leading-snug text-ink">
                        {option.label}
                      </span>
                      <PreviewSwatches colors={option.swatches} />
                      {option.meta || option.description ? (
                        <span
                          className={cn(
                            "overflow-hidden text-[11px] leading-snug text-ink-muted",
                            option.meta
                              ? "truncate font-mono text-[10px] uppercase tracking-normal"
                              : "max-h-[2.5rem]",
                          )}
                        >
                          {option.meta ?? option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PreviewSwatches({
  colors,
  className,
}: {
  colors?: string[];
  className?: string;
}) {
  const safeColors = (colors ?? []).filter(isPreviewColor).slice(0, 5);
  if (safeColors.length === 0) return null;
  return (
    <span
      className={cn(
        "flex max-w-[88px] items-center gap-1 overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      {safeColors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="size-3 rounded-full border border-black/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

function isPreviewColor(value: string): boolean {
  return (
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(
      value,
    )
  );
}

function firstEnabledIndex(options: DropdownSelectOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

function lastEnabledIndex(options: DropdownSelectOption[]): number {
  for (let index = options.length - 1; index >= 0; index--) {
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function nextEnabledIndex(
  options: DropdownSelectOption[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) return -1;
  const startIndex =
    currentIndex >= 0 ? currentIndex : direction === 1 ? -1 : options.length;
  for (let step = 1; step <= options.length; step++) {
    const index =
      (startIndex + direction * step + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}
