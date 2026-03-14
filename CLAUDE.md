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

## Specs

- `specs/weird-noises-intelligence-MAIN.md` — main project spec
- `specs/2-producers.md` — producers tool spec
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
