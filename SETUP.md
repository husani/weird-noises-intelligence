# Intelligence — Setup Checklist

Everything you need to configure before the platform runs end-to-end.

---

## 1. PostgreSQL

**Status:** Done.

- [x] PostgreSQL installed and running (Homebrew postgresql@17)
- [x] `intelligence_skeleton` database created

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

## 7. Database Password (Optional for Local Dev)

The current `.env` has an empty `DB_PASSWORD` which works with Homebrew's default trust auth. For production, set a real password.

---

## Running the Platform

```bash
# Terminal 1 — Backend
cd ~/Projects/weird-noises/intelligence
poetry run uvicorn app:app --reload --port 8005

# Terminal 2 — Frontend
cd ~/Projects/weird-noises/intelligence/frontend
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
| `ALLOWED_DOMAIN` | Set (husani.com) | Auth domain restriction |
