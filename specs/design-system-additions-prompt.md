# Design System Additions — Prompt for Claude Code

**Use the frontend-design skill for this work.**

## Context

You're working on the Intelligence platform — Weird Noises' internal AI-powered tools for the theatre/film/TV industry. The platform has a comprehensive design system spec at `specs/mockups/design-system.html` (~4,000 lines) that defines every visual component used across the platform. Multiple tools share this design system.

A design audit identified 6 new component patterns that are needed across the platform and don't exist in the current design system. Your job is to **add these components to the design system spec file**, following the exact same aesthetic language, CSS variable usage, naming conventions, and documentation style as the existing components.

These are **generic, reusable design system components** — not tied to any specific tool. The sample content in the examples is illustrative. Each component should be designed to work across multiple tools and contexts.

## Instructions

1. **Read the entire design system spec file** at `specs/mockups/design-system.html`. Understand the aesthetic: dark warm palette, Cormorant (display font), Outfit (body font), CSS custom properties for all values, five semantic accent colors (warm, sage, rose, blue, lavender), `--bg-deep` through `--bg-hover` background scale, `--border` and `--border-strong`, transition variables, radius variables.

2. **Add the 6 new component sections** described below to the spec file. Each should follow the same documentation structure as existing components:
   - A CSS block with the component's styles
   - An HTML showcase section with working examples showing all states/variants
   - The `ref-section` / `ref-section-title` / `ref-section-desc` documentation wrapper
   - Multiple `ref-group` blocks if the component has variants or states

3. **Use only CSS variables** defined in the `:root` block. Never hardcode colors, fonts, radii, or borders. If a new variable is needed, add it to `:root` following the naming conventions.

4. **Follow the naming conventions**: lowercase-hyphenated class names, descriptive but concise. Look at how existing components name their parts (e.g., `.section-card-header`, `.section-card-title`, `.section-card-meta`).

5. **No JavaScript.** All components are pure CSS + HTML structure. Interactive states (hover, active, focus) use CSS. State variants (`.active`, `.current`, `.processing`) are shown as separate HTML examples.

6. **Every component must work on desktop, tablet, and phone.** Add responsive rules to the existing `@media (max-width: 768px)` block at the bottom.

7. **Sample content should be illustrative.** Use realistic content from WN's domain (theatre, film, TV production), matching the tone of existing examples in the spec. Show names like Moonshot, Stable Geniuses are fine to use.

---

## New Components to Add

### 1. Entity Navigation Bar

**What it is:** A secondary horizontal navigation bar that appears within the content area when the user is working inside a specific entity. It sits below the page header and above the page content. This is NOT tabs — it's actual navigation with real routes. It's a scoped nav bar for an entity context.

**Why it exists as a design system component:** Any tool where an entity has enough depth to warrant its own sections needs this. A show has Scripts, Creative Team, Milestones. A performer might have Credits, Media, Availability. A casting project has Breakdown, Candidates, Auditions, Offers. The tool-level sidebar stays in place — this provides the second level of navigation within a specific entity.

**Structure:**
- A container bar with the entity name and identity on the left (entity title + one or two badges for type/status)
- Navigation links horizontally laid out
- Active state for the current section
- A "back to list" link or breadcrumb-style escape hatch on the left edge
- Should feel like a nav bar, not like tabs — no underline-on-active. More like the top-level `.nav-demo` component's link style, but adapted for entity context and sitting inside the content area rather than at the top of the page.

**States to show:**
- Default with 6-7 nav links, one active
- With varying numbers of links (3 links vs 7 links) to show flexibility
- Responsive: horizontal scroll on mobile, same pattern as the top nav

**Sample content:** Two examples with different entity types. Example 1: show entity ("Moonshot" + Musical badge + Workshop badge, links: Overview, Scripts, Team, Milestones, Media, Pitches, Budget). Example 2: generic entity with fewer links to show the component scales down.

---

### 2. Asset Gallery

**What it is:** A grid of visual thumbnails for image/media assets. This is fundamentally visual — images displayed as a grid, not a list of file names.

**Why it exists as a design system component:** Multiple tools need to display visual assets: show branding (logos, key art, mood boards), performer headshots and reels, production photos, reference imagery, portfolio pieces. The existing `file-item` component is text-based (icon + name + meta). This is for when the visual content IS the content.

**Structure:**
- Grid of thumbnail cards, responsive column count (4-5 on desktop, 2-3 on tablet, 1-2 on mobile)
- Each thumbnail card: image preview area (aspect ratio container with `object-fit: cover`), label below, optional overlay badge (e.g., "Current", "Primary"), type indicator (small text or badge)
- Hover state: subtle border highlight + action icons appear (download, delete, set as primary)
- Upload card: an "add" card in the grid that doubles as a drop zone (dashed border, plus icon), consistent with the existing `.file-upload` aesthetic but card-sized to fit the grid
- Empty state: when no assets exist

**States to show:**
- Grid with 5-6 thumbnails (use colored placeholder rectangles — same approach the design system uses for avatars)
- One thumbnail with overlay badge ("Current" or "Primary")
- One thumbnail in hover state with action icons visible
- The upload card sitting in the grid alongside thumbnails
- Empty state

**Sample content:** Labels like "Logo v2", "Key Art — Final", "Headshot — Primary", "Mood Board". Type labels like "Logo", "Key Art", "Headshot", "Reference".

---

### 3. Version Stack

**What it is:** A vertically ordered list of versions where the most recent is at the top, each entry is expandable, and the current/latest version is visually distinguished from historical versions.

**Why it exists as a design system component:** Versioned content appears across many tools: script drafts, document revisions, analysis snapshots, profile refreshes, research updates. The user needs to see the history, expand any version to see its contents, and quickly identify which is current.

**Structure:**
- Vertical list, most recent first
- Each entry: version label (prominent), date, summary text (truncated, expandable), status badge, action button (download, view, etc.)
- The latest/current version has a visual distinction — subtle highlight border or "Latest" badge
- Expanded state: the entry opens to show additional content below (nested file lists, detail fields, sub-items)
- Collapsed state: compact single-line summary
- Uses the accordion chevron pattern from the existing design system for expand/collapse

**States to show:**
- 3-4 versions, the top one expanded, others collapsed
- Top version with "Latest" or "Current" indicator
- One version showing a processing/active status with pulsing dot
- One version showing a completed status
- Expanded content area showing nested content (e.g., a small file list or detail fields)

**Sample content:** Version labels like "Post-Workshop Draft" (Feb 2026), "Pre-Workshop Draft" (Dec 2025), "First Draft" (Sep 2025). Status badges: Complete, Processing.

---

### 4. Processing State Panel

**What it is:** A multi-step processing indicator that shows the progress of an async operation with multiple discrete steps. Each step has its own status (pending, processing, complete, failed).

**Why it exists as a design system component:** Multiple tools run async AI operations with multiple parallel/sequential steps: script analysis (10+ extraction types), dossier research (multiple sources checked), bulk import processing, discovery scans. The user needs to see which steps are done, which are running, and which failed — not just a single spinner.

**Structure:**
- A container (section-card style) with a header showing overall status ("Processing — 7 of 11 complete")
- A grid or list of individual step items
- Each item: step name, status icon (checkmark for complete, spinner for processing, dash for pending, X for failed), optional action on completed items ("Regenerate", "Retry")
- Overall progress bar at the top (using existing `.progress-bar-track` / `.progress-bar-fill`)
- Completed state: all items checked, overall status shows "Complete", panel in subdued/collapsible state
- Failed state: error indicator on failed items with detail text

**States to show:**
- In-progress: 7 of 11 steps complete, some processing (spinning), some pending
- Complete: all steps done, panel in subdued/complete state
- Partial failure: most complete, 1 failed with error indicator and retry action

**Sample content:** Use generic step names that could apply to multiple tools. E.g.: "Character Analysis", "Scene Breakdown", "Budget Estimate", "Summary Generation", "Comparable Identification" — but the component should clearly work for any set of named steps.

---

### 5. Stage Progression Indicator

**What it is:** A horizontal indicator showing discrete ordered stages, with the current stage highlighted. NOT a progress bar (which is continuous/percentage-based). NOT a timeline (which is chronological with dates). This is a state indicator for where something is in a defined lifecycle.

**Why it exists as a design system component:** Many entities in Intelligence move through ordered stages: shows through development stages, casting through hiring stages, projects through production phases, documents through review stages. The user needs to see at a glance where something is in its lifecycle.

**Structure:**
- Horizontal chain of stage indicators (pills, dots, or connected segments)
- Current stage is highlighted (warm accent)
- Past stages are subtly marked as completed (muted, filled)
- Future stages are dimmed/unfilled
- Full variant: labels visible on all stages, suitable for dashboards and detail headers
- Compact variant: dots/segments only without labels, suitable for list rows, table cells, and tight spaces
- Should handle varying numbers of stages (4 stages through 10 stages)

**States to show:**
- Full variant with 8 stages, current at stage 3
- Full variant with current at stage 5 (to show different positions)
- Compact variant (no labels) at stage 3
- A variant with fewer stages (4-5) to show it scales down

**Sample content for full variant:** Stages like: Early Dev, Internal Read, Workshop, Staged Reading, Seeking Production, In Production, Running, Closed. But the design should clearly work for any ordered label set.

---

### 6. Content Card with Actions

**What it is:** A card pattern for displaying a piece of generated or authored content — a document, a pitch, a report, an analysis — with its type/audience prominently shown, a content preview or full editable area, attached materials, and metadata about authorship/generation.

**Why it exists as a design system component:** Multiple tools produce documents with specific audiences or purposes: pitch documents (tailored to producers, investors, festivals), reports, generated analyses, briefings. Each document has a type, content, metadata about how it was created (AI-generated, human-written, last edited by), and may have attached files. This pattern covers both the compact list view and the full workspace view.

**Structure:**
- **Card (list/compact view):** Type/audience badge prominently displayed, title, status badge (draft/final/etc.), creation date, preview of first line of content. Clickable.
- **Workspace (full view):** Type badge + label at top. Title (editable). Content area — prose block that's editable, with a "Regenerate" action and an attribution line ("Generated by AI · Mar 15" or "Edited by Husani · Mar 18"). Below: attached materials list (using existing `.file-item` pattern). Actions in header: Save, Regenerate, Export.
- **Type selector:** A row of selectable option cards (not a dropdown) for choosing the content type/audience when generating. Each card: type name, brief description. Selected state highlighted with warm accent border.

**States to show:**
- Row of 3 compact cards (different types, one final, two drafts)
- Full workspace view with content and 2 attached materials
- Type selector with one option selected
- Empty state with CTA

**Sample content:** Type labels like "Producer", "Investor", "Festival", "Grant-maker". Status: Draft, Final. Attribution: "Generated by AI · Feb 12, 2026". Content: a paragraph of realistic pitch prose about a show.

---

## Important Notes

- **Do NOT modify existing components.** Only add new ones.
- **Add new CSS above the `/* ============ RESPONSIVE ============ */` section** so responsive rules stay at the bottom.
- **Add responsive rules** for new components inside the existing `@media (max-width: 768px)` block.
- **Add new HTML showcase sections** at the end of the `<body>`, before `</body>`, following the same `ref-section` documentation pattern.
- **The file is a reference document**, not production CSS. It's read by developers who build application CSS FROM these patterns. The HTML examples show the intended structure and visual treatment. Make them complete and self-explanatory.
- **Test visual consistency** by imagining these new components placed alongside the existing ones. They should feel like they've always been part of the same design system — same spacing rhythm, same border treatments, same hover behaviors, same typography scale.
