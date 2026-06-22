# Technical Contrast Dogfood Review Rubric

Use this rubric to score Technical Contrast generations from `examples/dogfood/prompts.md` or equivalent fingerprint-iteration runs. Evidence without review rows is inspection material only; do not claim lift until outputs are scored.

Score each criterion 0-2:

- **0:** missing or contrary to the fingerprint
- **1:** partially present, weak, or inconsistent
- **2:** clearly present and useful

## Criteria

1. **Source-agnostic boundary:** Output avoids Together AI names, logos, wordmarks, exact source copy, customer logos, conference marks, exact model names, exact pricing values, and copied product screenshots.
2. **Claim-first hierarchy:** The first major region states the technical claim, comparison frame, recommendation, or proof obligation before details.
3. **Contrast-plane rhythm:** Surface uses pale/white technical planes and midnight proof planes intentionally, not as arbitrary decoration.
4. **Structured technical data:** Costs, limits, latency, throughput, capacity, risks, or options remain aligned through tables, matrices, labeled rows, or preserved mobile criteria.
5. **Proof explains implication:** Metrics, cards, research snippets, or code/configuration panels explain why the claim matters operationally.
6. **Mono label discipline:** Uppercase mono labels orient tabs, badges, CTAs, table headers, and metadata; body copy stays in sans.
7. **Hairline depth:** Depth comes from 1px rules, flat surfaces, surface polarity, and dark-on-dark borders rather than soft card shadows, glow, or glassmorphism.
8. **Rectangular actions:** Primary/secondary actions use compact small-radius rectangles and do not become full-pill or decorative color CTAs.
9. **Signal artwork restraint:** Optional signal art appears as one large abstract support element or neutral graphic plane, not repeated icons, category swatches, CTA fills, or copied source art.
10. **Responsive preservation:** Mobile or narrow layouts keep the claim, actions, and comparison criteria visible through stacking, cropped art, row labels, horizontal scroll, or category accordions.

## Review notes

- A strong output should score at least 16/20 with no zero on source-agnostic boundary.
- Pricing/comparison outputs should be judged especially hard on criteria 4 and 10.
- Research/proof outputs should be judged especially hard on criteria 3 and 5.
- Workflow outputs should be judged especially hard on criteria 4, 7, and 8.
- Update-card outputs should be judged especially hard on criteria 1, 5, and 9.
- Subjective taste issues should be recorded as advisory review notes, not deterministic check failures.
