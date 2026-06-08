import type { GenerateEditInput } from './types.js';

export function buildEditBlock(edit: GenerateEditInput): string {
  const target = edit.targetSections?.length
    ? edit.targetSections.map((id) => `\`${id}\``).join(', ')
    : 'any existing section, or emit `set /screen` first when adding/removing/reordering sections';
  const sectionsJson = JSON.stringify(edit.sections);
  const issues = edit.issues?.length
    ? `\n\nKnown issues from the client:\n\`\`\`json\n${JSON.stringify(edit.issues)}\n\`\`\``
    : '';

  return `## Edit mode — patch an existing artifact

The client is asking you to edit an already-rendered artifact. The server is stateless; the current artifact snapshot is included below.

Rules:

- Emit patch protocol lines only.
- To replace a section, emit exactly one complete replacement \`add /section/<id>\` line for that section.
- Do NOT re-emit unchanged sections.
- Emit \`set /screen\` only when you intentionally reorder, add, or remove sections.
- Target sections: ${target}.
- Base revision: ${edit.baseRevision ?? 'unknown'}.

Current section snapshot:

\`\`\`json
${sectionsJson}
\`\`\`${issues}`;
}
