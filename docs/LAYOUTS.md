# Layout Standards

We standardize on two primary page layouts. Use these names when describing or implementing UI work.

## Layout: Split Panel (Left Primary / Right Secondary)

**Name:** `split-panel`

**Description:** Two-column layout with a primary, wide left panel and a narrower right panel. The right panel is resizable and intended for secondary content (stats, chat, summaries). The left panel owns the main workflow.

**Used by:**
- Calendar (left: calendar, right: chat)
- Transactions (left: transactions, right: stats)

**Behavior notes:**
- Right panel is scrollable and height-constrained to the viewport.
- Left panel can scroll independently when needed.

## Layout: Full Width (Single Panel)

**Name:** `full-width`

**Description:** Single-column layout spanning the full available width, no split panel. Used for charts or dense table pages that need the entire viewport.

**Used by:**
- Trends
- Yearly Budget
