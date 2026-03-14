# Producers — Remaining Gaps from Audit

Tracking file. Check off as completed.

## CRITICAL
- [x] 1. URL submission extraction — AI extracts producer identity from pasted URL (backend `extract_from_url()` in ai.py, route `POST /extract-url`, frontend `extractUrl` API call)
- [x] 2. Quick-add modal — `QuickAddModal` in ProducersPage.jsx with name/email/org autocomplete + duplicate detection

## HIGH
- [x] 3. Producer List sort — sortable columns (name, last updated, last contact) with backend `sort`/`sort_dir` params + nullslast/nullsfirst
- [x] 4. Producer List freshness indicators — `updated_at` column with relative time display
- [x] 5. Standalone entity management UI — `EntityManager` reusable component in Settings.jsx, tabs for Organizations/Productions/Venues

## MEDIUM
- [x] 6. Dashboard significant change signaling — `significant_fields` set in interface.py, warm border + "notable" badge on dashboard feed
- [x] 7. Show matching "slate has changed" flag — badge on detail page when slate changed since last match
- [x] 8. Placeholder sections for future tools — Context, Audience, Radar sections on detail page with "available when X is built" messages
- [x] 9. Import column mapping UI — `HEADER_MAP` auto-mapping + dropdown grid for manual column mapping
- [x] 10. Import per-row progress tracking — polls `getProducer` after import, shows research status badges per row
- [x] 11. Settings source list reordering — up/down arrows per source, `reorderResearchSources` API + backend route
- [x] 12. Audio interactions — MediaRecorder API for browser recording, `transcribeAudio` upload to Gemini transcription endpoint

## Build Verification
- Frontend: ✅ vite build clean (59 modules, 0 errors)
- Backend: ✅ `import producers.backend.routes` clean
