# Intelligence — Setup Checklist

Everything you need to configure before the platform runs end-to-end.

---

## 1. PostgreSQL

**Status:** Done.

- [x] PostgreSQL installed and running (Homebrew postgresql@17)
- [x] `intelligence_skeleton` database created
- [x] `intelligence_producers` database created

---

## 2. Google OAuth Credentials

**Status:** Done.

- [x] OAuth 2.0 Client ID created
- [x] Redirect URIs configured (`http://localhost:8005/api/auth/callback`)
- [x] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set in `.env`
- [x] `ALLOWED_DOMAIN` set to `husani.com` for dev

---

## 3. JWT Secret

**Status:** Done. Auto-generated during build.

---

## 4. Google Cloud Storage (GCS)

**Status:** Done.

- [x] Bucket `wn-intelligence-dev` created
- [x] Service account key in `.credentials/`
- [x] `GCS_PROJECT`, `GCS_BUCKET`, `GCS_CREDENTIALS_PATH` set in `.env`

---

## 5. Anthropic API Key

**Status:** Done.

- [x] `ANTHROPIC_API_KEY` set in `.env`

---

## 6. Google AI (Gemini) API Key

**Status:** Done.

- [x] `GOOGLE_AI_API_KEY` set in `.env`

---

## 7. Google Maps API Key (Places Autocomplete)

**Status:** Done.

- [x] API key created
- [x] `VITE_GOOGLE_MAPS_API_KEY` set in `.env`
- [ ] Enable the **Places API (New)** on the project if not already: [APIs & Services → Library](https://console.cloud.google.com/apis/library) → search "Places API (New)" → Enable
- [ ] Restrict the key to HTTP referrers: `http://localhost:8006/*` for dev, `https://intelligence.husani.dev/*` for prod

Without this key, location fields fall back to plain text inputs (City, State/Region, Country).

---

## 8. Database Password (Optional for Local Dev)

The current `.env` has an empty `DB_PASSWORD` which works with Homebrew's default trust auth. For production, set a real password.

---

## Database Setup

`setup_db.py` creates both the PostgreSQL databases and the tables inside them — no manual `createdb` commands needed. Just run the scripts:

```bash
cd ~/Projects/weird-noises/intelligence

# First time — create databases, tables, and seed reference data:
poetry run python scripts/setup_db.py     # create databases + tables
poetry run python scripts/seed_data.py    # seed Producers lookup values, social platforms
poetry run python scripts/seed_slate_data.py  # seed Slate lookup values

# After model changes — drop everything and rebuild:
poetry run python scripts/reset_db.py     # drop, create, seed (all-in-one)

# Optionally, load fake test data for development:
poetry run python scripts/seed_test_data.py
```

**Reference data** (lookup values, social platforms) lives in `scripts/seed_data.yml` and is inserted by `seed_data.py`. Edit the YAML when adding categories, lookup values, or platforms.

**Test data** (fake producers, shows, etc.) lives in `scripts/seed_test_data.py`. This is separate from reference data.

---

## Running the Platform

```bash
# Terminal 1 — Backend
cd ~/Projects/weird-noises/intelligence
poetry run uvicorn app:app --reload --port 8005

# Terminal 2 — Frontend
cd ~/Projects/weird-noises/intelligence
npm run dev
```

Or open `intelligence.code-workspace` in VS Code — it has auto-start tasks for both.

- Backend: http://localhost:8005
- Frontend: http://localhost:8006 (proxies /api to backend)
- MCP server: http://localhost:8005/mcp/mcp (accessible to LLM APIs when deployed)

---

## Remaining for Production

| Item | Notes |
|------|-------|
| Deploy to `intelligence.husani.dev` | Enables LLM-via-MCP testing (requires public HTTPS URL) |
| Create prod OAuth credentials | Redirect URI: `https://intelligence.husani.dev/api/auth/callback` |
| Set `ALLOWED_DOMAIN=wemakeweirdnoises.com` | For prod `.env` |
| Set `ENVIRONMENT=production` | Enables secure cookies |
| Set `APP_DOMAIN=https://intelligence.husani.dev` | For auth redirects and MCP URL |

---

## Summary of `.env` Variables

| Variable | Status | Required For |
|----------|--------|-------------|
| `DB_HOST` | Set (localhost) | Database |
| `DB_PORT` | Set (5432) | Database |
| `DB_USER` | Set (husani) | Database |
| `DB_PASSWORD` | Set (empty) | Database |
| `GOOGLE_CLIENT_ID` | Set | Auth |
| `GOOGLE_CLIENT_SECRET` | Set | Auth |
| `JWT_SECRET` | Set | Auth |
| `GCS_PROJECT` | Set (wn-intelligence-dev) | File storage |
| `GCS_BUCKET` | Set (wn-intelligence-dev) | File storage |
| `GCS_CREDENTIALS_PATH` | Set | File storage |
| `MCP_SECRET` | Set | MCP endpoint auth |
| `ANTHROPIC_API_KEY` | Set | Claude AI |
| `GOOGLE_AI_API_KEY` | Set | Gemini AI |
| `APP_DOMAIN` | Set (http://localhost:8005) | Auth redirects, MCP URL |
| `ENVIRONMENT` | Set (development) | Cookie security |
| `VITE_GOOGLE_MAPS_API_KEY` | Set | Location autocomplete (frontend) |
| `ALLOWED_DOMAIN` | Set (husani.com) | Auth domain restriction |
