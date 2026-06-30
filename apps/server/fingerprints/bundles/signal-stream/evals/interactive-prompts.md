# Signal Stream — interactive bakeoff prompts

Interactive surfaces chosen to stress dynamic lists, local state, and event
handling — exactly where the arrow dialect's `.map`/IDL-binding quirks tend to
bite and where the domjs fluency hypothesis is strongest.

## ss-todo

**Prompt:** Build an interactive todo list. The user can type a task into an input, press a button to add it to the list, and click each item to mark it done (strike-through). Show a live count of remaining tasks. Start with two example tasks.

## ss-filter-feed

**Prompt:** Build a live feed of 8 technology updates with three filter buttons (All, Releases, Incidents). Clicking a filter re-renders the list to show only matching items, and highlights the active filter. Show how many items match.

## ss-counter-tabs

**Prompt:** Build a panel with three tabs (Overview, Activity, Settings). Clicking a tab switches the visible content. On the Activity tab, include a counter with increment and reset buttons that updates a displayed total.

## ss-cart

**Prompt:** Build a small shopping cart. Show four products, each with an "Add" button. Adding a product appends it to a cart list with a running subtotal. Each cart line has a remove button that updates the subtotal live.
