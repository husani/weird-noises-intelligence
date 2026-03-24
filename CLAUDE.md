# Intelligence — Project Instructions

## Frontend Design Process (mandatory)

When building or modifying a frontend page, STOP before writing any code.

1. **Identify every visual element the page needs** — tables, forms, cards, status indicators, navigation, empty states, alerts, modals, buttons, layout containers, etc.

2. **For EACH element, read the corresponding section of the design system spec** (`specs/mockups/design-system.html`). Do not grep for a class name. Read the full HTML example to understand the component's structure, contents, and intended use. The spec is a design system — a vocabulary of pre-designed pieces you compose into pages.

3. **Write a message to the user listing:**
   - Which spec components you will use and what they contain (e.g. "alert: alert-icon SVG + alert-content wrapper with alert-title and description text")
   - How they compose into the page layout
   - Anything NOT covered by the spec that needs new CSS
   - Do not write code until this message is sent.

4. **Only after the design plan is communicated**, write the code — using the spec's component structures exactly as designed.

This is not optional. Skipping this step has been a persistent failure across every Claude session on this project. The design system spec exists so that Claude can choose the right pre-designed pieces. Ignoring it and freewheeling CSS wastes the work that went into designing those components.

### Hard rules

- **NEVER use inline styles.** Write CSS classes in stylesheets.
- **NEVER import the spec file as production CSS.** It is a reference document. Build application CSS FROM it.
- **NEVER hardcode custom CSS on elements** when a design system class exists for that purpose.
- **NEVER treat existing implementation as the source of truth.** Always check the spec first. Previous code may be wrong.
- **NEVER skip the design plan step.** The bias toward generating code fast is exactly what causes spec violations. Slow down.
- **NEVER create spacing utility classes** (e.g. `mb-16`, `mt-8`, `tool-mb-24`). Spacing comes from structural containers with gap, component padding, or layout classes — not per-element margin utilities. If you need spacing between form fields, use a flex column container with gap. If you need spacing between page sections, use a flex column container with gap. One container class, not a class per element.
- **NEVER invent CSS classes without checking the design system first.** If you need a pattern (button variant, card layout, form structure, spacing), check `specs/mockups/design-system.html` for an existing solution. If nothing exists, flag it as "needs new CSS" in your design plan — do not silently create classes. If a pattern is genuinely missing from the design system and is reusable across tools, add it to `shared/frontend/styles/components.css`, not to the tool's CSS.
- **NEVER copy-paste components across files.** If two pages need the same component (a select arrow SVG, a stage progression indicator, a form field), make it a shared component or a tool-level component — not duplicated code in multiple page files.

## Platform Philosophy

- **AI is infrastructure, not a feature.** Like the database or GCS — it's how the system works, not what the user interacts with. Uploading a script populates the show. Uploading an image populates the visual understanding. Don't frame anything as "AI analysis," "AI-extracted data," or "AI-generated content" in specs, UI, or code. The data is just the data. "Edit" and "Regenerate from script" are both just actions on data — neither is special because of its source.
- **WN is a media company** (Weird Noises Media Group LLC) creating original IP across theatre, film, and TV. Only Producers and Theatre Ops are theatre-specific. Every other tool must work equally well for a musical, a play, a TV show, or a film.
- **Don't build FPO.** Nothing goes live until there's a critical mass of tools completed. Don't build placeholder versions of features that depend on tools that don't exist yet. Build each tool's own stuff fully. Cross-tool features come when the dependencies are real.
- **This project is mid-development. Build everything fully.** There are no users waiting, no production system to maintain, no reason to cut corners or defer work. When something needs to exist, build it properly now. Never suggest doing something "later" or offer a shortcut alongside the right approach. If it's important enough to discuss, it's important enough to build.

## Specs

- `specs/weird-noises-intelligence-MAIN.md` — main project spec
- `specs/2-producers.md` — producers tool spec
- `specs/3-slate.md` — slate tool spec
- `specs/mockups/design-system.html` — design system reference (source of truth for all visual decisions)

## Design System

- Dark warm palette, Cormorant (display font), Outfit (body font), no Tailwind
- Application CSS: `shared/frontend/styles/` — base.css, components.css, layouts.css
- Tool-specific styles: e.g. `producers/frontend/styles/producers.css`
- Accent colors: warm (#c4915a), sage (#7d9e87), rose (#b07a7a), blue (#7a8fa0), lavender (#9088a8)

## Project Structure

- Backend: FastAPI on port 8005 (Python/Poetry)
- Frontend: React/Vite on port 8006
- NO `frontend/` or `backend/` directory at project root — each tool has its own
- `shared/frontend/` and `shared/backend/` for cross-tool code
- The spec is always the source of truth. Read and follow the spec.
