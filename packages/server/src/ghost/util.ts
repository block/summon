export function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function recordArrayValue(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.flatMap((entry) => recordValue(entry) ? [recordValue(entry)!] : []) : [];
}

export function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function normalizeFidelityText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ');
}

export function stableSignalId(prefix: string, value: string): string {
  return `${prefix}:${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'signal'}`;
}
