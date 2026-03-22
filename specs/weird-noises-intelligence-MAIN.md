# WN intelligence

# Intelligence
Weird Noises' internal platform for AI-powered tools and automation. The theatre industry is easily 15 years behind other industries from a tech perspective. Intelligence is how WN operates like no other theatre company — retaining creative control, owning every operational function internally, and building compounding institutional knowledge across every show.
WN's goal is to be the A24 of theatre. A24's advantage wasn't better spreadsheets — it was a fundamentally different understanding of culture and audience, built into how they operated. Intelligence is that operating layer for WN.
# Design Principles
**Output over structure.** The system is designed around what it answers, not how data is stored. Standalone tools that query each other produce the same output as a unified database without the coupling. When evaluating any design choice, ask what the system needs to answer and work backward from there.
**People exist independently across tools.** The same human can exist as separate records in multiple tools, and that's by design. A producer in the Producers CRM is a separate record from that same person in Audience, in Talent, or in Funding. Each tool tracks its own relationship with that person. This is not a data integrity problem to solve — it reflects the reality that WN has different relationships with the same human in different contexts. When one tool needs information about a person from another tool, it calls that tool's MCP tools.
**The moat.** Intelligence exists to give Weird Noises capabilities that no theatre company would even conceive of. Every person in Audience gets fully researched. Radar monitors cultural signals no one in the industry is watching. Dramaturg gives honest structural analysis without sycophancy. The value compounds over time — the more data flows through these tools, the smarter they get. Design decisions should be evaluated against this: does this create something unprecedented, or is it a better version of what already exists?
**No constraints on complexity.** Don't scale back features because they seem hard or expensive to build. The full vision is the spec.
**Built by Husani and Claude Code.** This spec is for two readers: Husani, who designed the system, and Claude Code, which builds it. There is no third-party team, no handoff, no need to defend decisions or explain rationale. The spec says what the system does. 

# Architecture Philosophy
Each tool is a standalone system, purpose-built and excellent at its specific job. There is no central database or grand unified schema. Each tool owns its own data, its own data model, and its own database.
Tools connect to each other only when a real use case demands it. Integration is driven by actual need, not speculative "everything should talk to everything." When Tool A needs something from Tool B, that connection is built at that point.
Each tool exposes its capabilities — what data it has, what queries it can answer, what actions it can perform — through a shared MCP (Model Context Protocol) server. When one tool needs something from another, it calls that tool's MCP tools. No tool ever touches another tool's database directly. The capabilities are the contract. Internally a tool can change however it wants as long as its capabilities still return what they promise.
MCP is the single interface for all cross-tool access. Every call goes through MCP — there is one path, not two. The only difference is transport: LLMs reach MCP tools via the server's HTTP URL (passed as `mcp_servers` in the LLM API call), while code in the same process calls them directly on the server object. Same tools, same behavior, same contract regardless of caller. This is critical because every tool has AI features that need to reason across data from multiple tools, and pre-building bespoke data-gathering code for every possible AI query doesn't scale.
A separate shared registry knows what tools exist — their names, descriptions, and URL paths. The registry serves the home page and nav bar. It does not handle capabilities — that's the MCP server's job.
Example: Casting needs candidates for a role. It calls Talent's MCP tools to search with the role criteria and gets back matched dossiers. Casting never knows or cares how Talent stores its data. When Producers' LLM needs to reason about which shows fit a producer, it calls Slate's MCP tools to get slate data — the LLM discovers what it needs as it reasons, rather than a developer pre-building the data gathering.
Some capabilities that seem like standalone tools are actually integration patterns. The Relationship Graph — "find me a path to Producer X through people we know" — isn't a tool with its own data. It's a cross-system query that fans out to Producers, Talent, Collaborators, and Slate. The intelligence lives in the query, not in a dedicated system.
The test for whether something is a tool: does it own its own data and have its own purpose independent of everything else? If yes, it's a tool. If it only exists as a query across other tools, it's an integration pattern.
Context has a unique role in this architecture. Every other tool generates conversations — meetings about producers, casting discussions, creative debates, budget reviews. Context captures all of it and makes it queryable. Any tool can ask Context for the conversational history around a topic, a person, or a project. Context doesn't push information to tools — they pull from it when they need it.
**Medium-agnostic by default.** Although Intelligence was designed with theatre as the focus, most tools work across WN's full business — film, TV, and theatre — without changes. Radar watches cultural signals regardless of medium. Talent tracks performers who work across mediums. Slate already includes TV projects. Casting's workflow is the same across mediums, with union differences (AEA vs SAG-AFTRA) as configuration. Dramaturg analyzes scripts regardless of format — the team selects the medium before uploading, and the tool applies the right analytical framework. Audience and Collaborators are inherently medium-agnostic.
The exception is Theatre Ops, which is theatre-specific — GM automation, AEA compliance, house seats, weekly operating budgets. TV/film production operations are a fundamentally different domain.
# Technical Architecture

**Application structure.** Intelligence is a single application serving all tools. One codebase, one process, one domain: `intelligence.wemakeweirdnoises.com`. Auth happens once at the front door. Each tool is a module within the application, fully self-contained with its own frontend and backend, sharing a runtime.

**URL structure.** Each tool has its own route under the Intelligence domain. `intelligence.wemakeweirdnoises.com/producers` loads the Producers UI. `intelligence.wemakeweirdnoises.com/casting` loads Casting. Backend API routes follow the same namespacing — `/api/producers/...`, `/api/talent/...`, `/api/casting/...`. The root URL loads the home page, a directory of all registered tools with their descriptions.

**Codebase.** Organized by tool. Everything about a tool — its frontend and its backend — lives together in one directory. The shared directory contains infrastructure that all tools use: layout and navigation, auth, the MCP server, the registry, database, AI, and file storage plumbing.

```
/intelligence/
    shared/
        frontend/
            layout/          # nav bar, tool switcher, page wrapper
            auth/            # login page, OAuth flow, auth guards
            components/      # shared UI components
            styles/          # design tokens, colors, typography, spacing
            router.jsx       # route definitions mapping URLs to tools
        backend/
            mcp.py           # shared MCP server for cross-tool capabilities
            registry.py      # tool metadata registry (name, description, path)
            auth/            # OAuth, session management, middleware
            config.py        # environment config, database connections
            ai/              # shared AI client instantiation, API keys
            storage/         # GCS client, upload/download utilities
    producers/
        frontend/
            pages/
            components/
        backend/
            routes.py
            services.py
            models.py
            interface.py     # business logic + MCP tool definitions
    talent/
        frontend/
            pages/
            components/
        backend/
            routes.py
            services.py
            models.py
            interface.py
    slate/
        ...
    casting/
        ...
    radar/
        ...
    dramaturg/
        ...
    audience/
        ...
    collaborators/
        ...
    theatre_ops/
        ...
    funding/
        ...
    context/
        ...
    app.py                   # backend entry point, registers all tools
```

Each tool follows the same internal structure. `interface.py` in each tool contains the business logic and registers its capabilities as MCP tools with the shared MCP server.

**Backend.** The backend is built with FastAPI. Each tool defines its own routes, services, models, and data layer. On startup, `app.py` creates each tool's interface with its own database connection, registers its metadata with the registry, registers its MCP tools with the shared MCP server, and mounts each tool's routes under the appropriate namespace.

**Databases.** PostgreSQL, running as a single instance with a separate database per tool. Each tool has complete data isolation — its own tables, its own schema. When one tool needs data from another, it calls that tool's MCP tools.

**Data layer.** SQLAlchemy, provided through `shared/backend/`. The shared layer handles engine creation, session management, and provides a base model class. Each tool uses SQLAlchemy at whatever level of abstraction fits its data — full ORM for structured relational data, SQLAlchemy Core or raw SQL for JSONB queries, full-text search, or vector operations. Each tool manages its own models.

**Cross-tool communication.** Each tool exposes its capabilities as MCP tools registered with a shared FastMCP server. MCP is the single interface — every cross-tool call goes through it. The FastMCP server runs on HTTP transport, mounted as an ASGI sub-app inside the FastAPI process at `/mcp`. The endpoint is protected by a bearer token (`MCP_SECRET`) — LLM API calls pass it via `authorization_token` in the `mcp_servers` config, and Claude Code passes it via `--header` in `.mcp.json`. LLMs access it by URL (passed via the `mcp_servers` parameter in LLM API calls — Claude discovers tools, calls them, and reasons with results autonomously). Code in the same process calls tools directly on the server object (`mcp_server.call_tool()`). One path, one contract. A tool's internal implementation can change however it wants as long as its MCP tools still return what they promise.

**Tool registration.** Each tool registers its metadata — name and description — with the registry on startup. The home page and the nav bar read from the registry. When a new tool is built and registered, it appears automatically. Separately, each tool registers its capabilities as MCP tools with the shared MCP server.

**Frontend.** The frontend is built with React. Each tool has its own pages and components inside its own directory. The shared frontend directory contains the layout wrapper, auth UI, design system, and the router. The design system reference file (`specs/mockups/design-system.html`) defines the complete visual language — every color, font, component pattern, and interaction state. Shared components are built from that reference. The router maps URL paths to tool frontends, each lazy-loaded. Every route is wrapped in the shared layout.

**Auth.** Google OAuth, restricted to WN Google Workspace accounts. When an unauthenticated user hits any route, FastAPI middleware detects the missing session, captures the intended destination, and redirects to the login page. After authenticating through Google, the application creates a JWT stored as an httpOnly cookie and redirects the user to their intended destination. The JWT contains user identity. FastAPI middleware checks this cookie on every subsequent request. One login covers all tools.

**AI integration.** API keys and client instantiation for AI services (Anthropic, Google, etc.) are managed in `shared/backend/ai/`. Each tool imports the client it needs. Which model to use, how to prompt it, how to structure calls, what to do with the response — entirely tool-specific. When a tool's AI feature makes an LLM API call, it passes the MCP server URL in `mcp_servers` — the LLM autonomously discovers and calls whatever MCP tools it needs during reasoning. No bespoke data-gathering code per AI feature.

**Background processing.** Several tools do work independent of user interaction. Three patterns, all running in-process.

Event-triggered work uses FastAPI background tasks. A person is added to Talent — dossier building kicks off. A transcript appears — Context processes it. The work happens asynchronously and the result is available when it's done.

Schedule-triggered work uses APScheduler. Radar's cultural monitoring runs on cadences that vary by source. Talent dossier refreshes run periodically. Audience engagement health checks run on intervals. Different jobs run on different schedules.

Source monitoring watches external sources for new data. When new data appears, processing kicks off. The specifics of what each tool monitors and how are defined in each tool's spec.

All three patterns work identically in development and production.

**File storage.** Google Cloud Storage. One shared bucket, with each tool using path prefixes for separation (e.g. `slate/scripts/...`, `talent/headshots/...`). Each tool owns its own files the same way it owns its own database — the prefix is the boundary. Slate stores scripts, music, and visual identity assets. Talent stores headshots, reels, and resumes. Casting stores audition recordings and submission materials. Context stores raw transcript files. Collaborators stores portfolio materials. Funding stores offering documents and signed agreements. Theatre Ops stores venue contracts, insurance documents, and union agreements. Producers and Audience have minimal file storage needs. Dramaturg and Radar store no files — Dramaturg analyzes scripts that live in Slate, accessed through Slate's MCP tools.

Within its prefix, each tool organizes however makes sense for its domain — Slate by show, then type, then version. Talent by person. Context by date. Each tool decides its own structure.

The shared infrastructure in `shared/backend/` provides GCS client initialization and common utilities — upload, download, generate signed URLs for frontend access. The bucket is configured once via `GCS_BUCKET` in `.env`. Tools pass full paths including their prefix to the storage utilities.

Cross-tool file access follows the same pattern as cross-tool data access. Dramaturg doesn't reach into Slate's paths. It calls Slate's MCP tools and gets back what it needs. The boundary is always the MCP tool.

**Hosting.** Intelligence runs on a GCP Compute Engine VM. A long-running process that keeps the scheduler alive, maintains source monitors, and serves web requests.

**Dev environment.** Vite dev server running locally with a proxy to the FastAPI backend. Same URL structure and routing as production.

**Production.** FastAPI serves everything. Built frontend files are static assets served by the backend alongside the API routes. Same URLs, same routing, same behavior as development.
# Build Sequence
**Phase 1: Shared infrastructure.**
Auth (Google OAuth, JWT sessions, middleware), layout (nav bar, tool switcher, page wrapper), design system (implemented from the design system reference file at `specs/mockups/design-system.html` — that file is the visual source of truth for all colors, typography, spacing, and component patterns), router, tool registry (metadata only — name, description, path), shared MCP server (cross-tool capability exposure for both code and LLMs), database plumbing (SQLAlchemy engine creation, session management, base model class), AI client setup, GCS file storage utilities, APScheduler setup.
Shared infrastructure is complete when a tool can register itself, serve a frontend behind auth, connect to its own Postgres database, expose its capabilities as MCP tools callable by other tools and LLMs, call AI services, store files, and run background jobs — all within the architecture defined in the Technical Architecture section of this spec.
**Phase 2: Remaining tools, in order.**
2 Producers
3 Slate
4 Talent
5 Casting
6 Radar
7 Dramaturg
8 Audience
9 Collaborators
10 Theatre Ops
11 Funding
12 Context

Each tool plugs into the shared infrastructure and extends it if needed. The Producers spec was written separately and in more detail. All other tools are specced in this document at planning level and will need detailed design as they come up in the build order.
A concept for a future tool — action items / reminders, surfaced during the Context spec process — exists but is not yet specced or prioritized.

# Home
The landing page at intelligence.wemakeweirdnoises.com. A directory of everything in Intelligence — each tool with its name, description, and link. Each tool registers its own name and description with the registry on startup. The home page and the nav bar both read from the registry to render the list of available tools. No hardcoded list anywhere.
As tools are built and registered, they appear on the home page and in the nav automatically. Build one tool, the home page shows one tool. Build ten, it shows ten. Neither the home page nor the nav ever need to be updated directly.
May evolve over time to surface useful information from across tools, but starts as a directory.

# Tools
### Producers
WN's knowledge base of theatre producers — the people who produce shows on and off Broadway. Some of these people WN has deep relationships with. Some WN is aware of and tracking. Some the system discovered on its own. All of them get researched, all of them are queryable.
**Intake.**
Three paths, all leading to the same place — a researched producer in the system.
**1. Manual add.** The team encounters a producer and wants to track them. Met at an event, got a referral, read about their work, saw their name on a show. Added directly in the tool with whatever starting information the team has.
**2. Bookmarklet.** Reading a Playbill article, a BroadwayWorld announcement, a producer's company website — click, and the URL gets sent to Producers. Same bookmarklet as Talent. The bookmarklet talks to Producers, not to other tools. Duplicate check before creating a new entry.
**3. AI discovery.** The system proactively monitors the industry for producers WN should know about. New productions opening, development announcements, festival programs, co-producing credits on shows that share DNA with WN's slate. "This person just produced an Off-Broadway musical with themes that overlap with Moonshot — they're not in the database yet." The system proposes additions with reasoning. The team reviews and confirms. Over time, the system learns which kinds of producers WN cares about and refines what it surfaces.
**AI research on every producer.**
Every producer who enters the system gets a full dossier built by the AI. This is the same depth of research as Talent applies to performers — the AI goes out and builds genuine understanding of each person.
**Production history.** Everything they've produced, where, and at what scale. Broadway, Off-Broadway, regional, touring, international. The shows themselves — titles, venues, years, whether they were lead producer or co-producer. Run lengths and outcomes where available. The trajectory of their career — are they scaling up, moving between commercial and non-profit, shifting genres?
**Organizational history.** Current and past affiliations with dates. Every organization they've been associated with — producing offices, non-profit theatres, commercial production companies, development programs. This is additive, not corrective. When someone moves from The Public Theater to Level Forward, both affiliations stay in the record. The full career path through the industry matters — where someone has been tells you as much as where they are.
**Creative taste and patterns.** What kinds of work do they gravitate toward? Genres, themes, scale, aesthetic sensibility. Inferred from their production history — someone who's produced four intimate two-handers has different taste than someone who's produced three large-scale spectacles. The AI identifies patterns the team might not see from a quick glance at credits.
**Financial profile.** How they capitalize shows — do they lead-produce or co-produce? What's the typical capitalization range of their productions? Do they raise from individual investors, institutional sources, or a mix? This is inferred from production scale, co-producing patterns, and publicly available information. Not precise numbers — a profile of how they operate financially.
**Network.** Who they co-produce with. What directors, writers, and composers they champion repeatedly. Which casting directors, general managers, and press agents they work with. Overlap with people WN knows across Talent, Collaborators, and other producers. The network map is strategic intelligence — it shows paths to connection and reveals relationships the team might not know exist.
**Awards and recognition.** Tony nominations and wins, Drama Desk, Outer Critics, Obie, Pulitzer involvement. Not as a prestige ranking — as signal about what the industry recognizes them for.
**Press and public presence.** Interviews, profiles, industry coverage. What they say publicly about what they're looking for, what they believe about the industry, what their stated mission is.
**Current activity.** What they're producing right now, what they've announced, what's in development. The dossier stays current — refreshing as circumstances change, new shows open, affiliations shift.
**What WN adds over time.**
This is the layer no external research can provide — WN's own experience with each producer.
**Interaction history.** Every touchpoint logged with date, context, and notes. Meetings, emails, encounters at events, pitches made, conversations had. "Met at NAMT, talked about Moonshot, she was interested in the concept but wants to see a draft." "Ran into him at the opening of X, he mentioned he's looking for new musicals." "Pitched Stable Geniuses, not the right fit for his slate but he suggested we talk to [other producer]." The full chronological record of WN's relationship with this person.
**Internal assessments.** Candid observations that accumulate over time. What's their actual taste beyond what their credits suggest? How do they work — hands-on or hands-off? Collaborative or controlling? What's their reputation among people WN trusts? Do they follow through? Are they someone WN wants to build with long-term? These assessments are private institutional knowledge that gets more valuable with every interaction.
**Tags.** Ad-hoc grouping for whatever the team needs in the moment — "Met at NAMT 2025," "Interested in Moonshot," "Marc's contact," "New works focus," "Potential for Stable Geniuses."
**Show matching.**
The AI understands what's on WN's slate (from Slate — themes, genre, scale, development stage, creative team, structural profile from Dramaturg) and what each producer's taste and track record look like. It continuously evaluates fit between WN's shows and the producers in the database.
Looking at a producer: "Which of our shows might interest them, and why?" The AI matches based on genre alignment, thematic overlap, scale fit, and the producer's demonstrated patterns. "Producer X has produced three intimate musicals with social themes — Moonshot is a strong fit because of [specific reasons]." "Producer Y typically works at a larger scale than Moonshot's current development stage, but her recent move to [organization] suggests she's expanding into smaller work."
Looking at a show: "Which producers should we be talking to, and why?" The AI ranks the full database — including producers WN hasn't met yet — by fit with the specific show. The reasoning matters as much as the ranking. "These five producers are the strongest matches for Moonshot. Three of them WN has existing relationships with. Two are new — here's who they are and why they fit."
Show matching pulls from Radar when relevant — "Producer X just produced a show that rode the same cultural wave Moonshot is positioned for. The timing alignment makes this worth pursuing now."
**Relationship awareness.**
For producers WN has a relationship with, the system understands where things stand without forcing it into pipeline stages. Some producers WN is just aware of and researching. Some WN has met casually. Some WN is actively in conversation with about a specific show. Some have expressed interest in a project. Some have passed on something. Some WN has worked with before. The system reflects this naturally from the interaction history — it's not a status the team manually sets, it's something the AI reads from the data.
Warmth matters. How recent is the engagement, how active, how substantive? "Talked last week, she's reading the Moonshot script" is a warm, active relationship. "Met once at a conference eight months ago" is cool. "Haven't connected in six months after she said she'd get back to us" might need attention. The system surfaces relationships going cold so WN can decide whether to re-engage.
For producers WN doesn't have a relationship with yet, the system still provides the full context — dossier, taste profile, network, show matching. Everything needed to approach them intelligently when the time comes.
**Outreach.**
The system supports planned outreach around a specific show or opportunity. "We're submitting Moonshot to these 15 producers." For each, the system tracks: have we contacted them, when, through what channel, what was the response, where does the conversation stand, when should we follow up. The team sees the full outreach picture for any show in one place.
The system reminds the team when follow-ups are due. "You pitched Producer X two weeks ago and haven't heard back — time to follow up?" Not automated emails — prompts for the team to take human action.
Multiple outreach campaigns can run simultaneously for different shows. The system prevents embarrassing overlaps — "you're about to pitch Producer X on Stable Geniuses, but Marc pitched her Moonshot three days ago."
**AI querying.**
"Who should we be talking to about Moonshot?" "Which producers have done Off-Broadway musicals in the last five years?" "Who have we lost touch with that we should reconnect with?" "What's our full relationship history with Producer X?" "Who's producing new work right now that we should know about?" "Find producers who've worked with [director WN is considering for a show]." "Who did Marc meet at that conference last month?" "Which producers in our database have never been pitched and might be a fit for something on our slate?" "What producers are connected to [venue WN is interested in]?"
**What Producers exposes to other tools.**
Slate asks: "which producers should we pitch this show to?" Producers returns matched producers with reasoning, including both existing relationships and new prospects.
Collaborators asks: "does this producer have relationships with any of our collaborators?" Producers has the full network history to answer that — co-production credits, repeated working relationships, shared organizational affiliations.
Funding asks: "is this funder also a producer we're tracking?" Producers provides the professional context around that person — their production history, their taste, the relationship status.
Audience can provide engagement context — whether a producer has engagement history with WN beyond the professional relationship. Producers asks Audience, not the other way around.
Context provides conversation history for any producer — every meeting where they were discussed, what was said, what was decided.
Radar provides market context that enriches producer conversations — "Producer X's recent show rode the same cultural trend that Moonshot is positioned for."
Status: specced at planning level.
### Slate
System of record for WN's own projects and their development history. The script is the source of truth — upload a script and the system derives everything else.
**Core data:**
A Show is the top-level entity with static identity: title, medium (musical/play), genre, logline, summary, rights status (original, optioned, public domain adaptation). Logline and summary can be LLM-generated from the script and human-refined.
Script Versions live under each Show. Each version is an uploaded file with a version label, upload date, and change notes. LLM processing kicks off on upload — reads the script, extracts structured data, stores it tied to that version.
**Music uploads.** For musicals, music is part of the script. Slate accepts music files alongside script documents — demo recordings, rehearsal tracks, piano/vocal scores, orchestrations. Music is tied to the script version it corresponds to. Multiple file types, multiple tracks per version. Not analyzed by AI currently, but stored, versioned, and available. Casting can pull relevant tracks as audition material. Dramaturg may eventually analyze musical content alongside the text.
Development Stage lives on the Show, not the script version. A show can have multiple script versions within the same stage. Stages: early development, internal read, workshop, staged reading, seeking production, in production, running, closed. (WN defines the actual stages.)
Milestones are events in the show's life — "internal read on [date] with [these people]," "staged reading at [venue] on [date]," "submitted to [festival/program]." Each milestone can link to a script version, creative team at that point, and notes.
Creative Team Attachments are per-show and time-aware. Role, person, status (interested, attached, confirmed, departed), dates.
**Visual identity.**
Each show has its own look and feel — logo, color palette, typography, imagery, mood boards, key art, visual references. This is the show's brand, separate from WN's brand. The system stores and versions these assets. They exist independently and inform everything outward-facing — pitches, campaign materials, social content, whatever needs to represent the show visually.
**Pitches.**
Slate owns pitch creation. A pitch is always about a show, regardless of who it's aimed at. Pitching Moonshot to a producer, an investor, a foundation, a festival — the subject is the same, the emphasis shifts.
The AI generates pitches by pulling from wherever the relevant data lives. Show data — logline, summary, creative team, development history, structural analysis from Dramaturg. Cultural context from Radar — why this show matters right now. Audience data — proof of demand, who's engaging and why. Funding data — budget, capitalization status, financial projections. Producers data — who's already attached or interested.
The team specifies the audience for the pitch — producer, investor, grant-maker, festival — and the AI tailors the emphasis accordingly. All pitch materials for a show live in Slate, in one place, regardless of who they were created for.
**LLM extraction on script upload:**
Character breakdown (names, descriptions, age ranges, line/song count). Scene breakdown (locations, characters per scene). Song list with placement (musicals). Estimated runtime. Minimum cast size and doubling possibilities. Vocal ranges and dance requirements if indicated. Budget range estimate based on structural data (cast size, musicians, locations, musical vs play). Logline drafts. Summary. Comparables ("structurally similar to X, thematic overlap with Y"). Content advisories.
Version diff on upload: compares new version to previous, produces change summary ("three scenes cut, second act opening rewritten, new character added"). Becomes part of the version record.
**On-demand AI:**
"Give me a pitch paragraph for this show." "Generate a one-pager." "What are the producing challenges?" "How has this script evolved across versions?" "Compare the structure of this show to [comparable]."
Over time, budget estimates calibrate against what WN actually spent. Comparables sharpen as the system learns WN's taste.
**What Slate exposes to other tools:**
Producers asks: "what shows are in active development that might interest Producer X?" Casting asks: "what roles need to be cast for Show Y?" Funding asks: "what's the estimated budget?" Radar asks: "what themes and genres are on WN's slate?"
Status: specced at planning level. Needs detailed data model and build spec.
### Talent
Performer dossier system. The persistent knowledge base of who's out there in the theatre world, independent of any specific role or casting need.
**Three modes of AI work within a dossier:**
**Retrieval.** Collecting facts that exist somewhere. Credits, representation, training, union status. The agent finds it and records it.
**Inference.** Deriving things not explicitly stated. Vocal range from roles played. Type from casting patterns. Dance ability from credits and training. Different confidence level than retrieval — the system should know the difference.
**Synthesis.** Composing a coherent profile from everything retrieved and inferred. "Emerging musical theatre leading man, belt-mix range, strong comedy instincts, growing social visibility." Nobody wrote that anywhere — the AI assembled it.
These have different confidence levels and the system should distinguish "we know this" from "we inferred this" from "we synthesized this."
**Intake paths:**
All roads lead to Talent. No matter how a person enters the system, the result is the same: a dossier gets built and they exist in Talent.
**1. WN submission portal, no show attached.** Public-facing page on the WN site. "Interested in working with Weird Noises?" Name, headshot, social URL. Not tied to a specific role or show. The AI takes the URL and builds the dossier. This is the persistent talent pipeline — performers self-select into WN's world.
**2. WN submission portal, show attached.** When casting is active for a specific show, the portal can accept submissions for specific roles. Person submits, dossier gets built, and they're tagged with the show and role. Casting picks that up later.
**3. Bookmarklet.** The team's primary capture tool. A browser bookmarklet that works on any page — Actors Access, Instagram, BroadwayWorld, a random article, anywhere. Click it, and the current page gets sent to Talent. Talent builds the dossier from whatever URL was provided. The bookmarklet UI can optionally tag the person to a show and role — but the bookmarklet itself only talks to Talent. If Talent needs show/role data for the dropdown, Talent is what reaches into Slate. The bookmarklet doesn't know other tools exist.
Also serves as a duplicate check — if the person already exists in Talent, the bookmarklet can surface that before creating a new entry.
**4. Manual add.** Directly within the Talent tool. Drop a URL or type a name. Same dossier-building process.
**Actors Access and Talent:**
WN uses AA. It's where the industry lives — performers, agents, casting notices. That doesn't change. WN posts breakdowns on AA, submissions come in through AA, and the team reviews them there. The difference is that AA is a source, not the system of record. When the team sees someone worth tracking — whether for the current show or just in general — the bookmarklet pulls them into Talent. Talent is where WN's institutional knowledge lives. AA is where the industry transacts.
The WN submission portal is an additional intake path, not a replacement for AA. Some performers will find WN directly. Others will always come through AA. Both end up in the same place.
**What the AI assembles in a dossier:**
Identity basics: name, headshot pulls, age range, location.
Credits: BroadwayWorld, Playbill, IBDB, IMDb, personal sites. Chronological credit history — show, role, venue, year. Flags notable credits (Broadway, major Off-Broadway, national tours, regional flagships).
Training: where they studied, notable programs or teachers.
Representation: agent and/or manager, agency, contact info if public.
Union status: AEA, SAG-AFTRA. Inferred from credits if not stated.
Performance profile: vocal range, dance ability, type. All inferred from credits, training, and roles unless explicitly stated.
Social presence: following, engagement, content type, visibility.
Press and buzz: reviews mentioning them, interviews, profiles, nominations.
Network: who they've worked with — directors, cast members, producers.
**What WN adds over time:**
Interaction notes: "saw them in X, impressive," "read for Moonshot, strong but wrong for role," "Marc knows them from Y."
Internal tags: ad-hoc categorization. "Watch list," "offered before," "Marc's recommendation."
Availability notes if known.
Fit assessments: per-show notes on potential casting fit.
**AI querying:**
Natural language against the full database. "Who could play a college-age male lead, sings tenor, has musical comedy credits, NYC-based?" "Everyone who's worked with [director]." "Who did we flag after seeing them in something this year?"
**Dossier refresh:**
Dossiers go stale. The system periodically re-researches and flags changes: "[Person] just opened on Broadway," "[Person] changed agents." Refresh cadence can vary based on how active WN's relationship is with the person.
**What Talent exposes to other tools:**
Casting asks: "who fits this breakdown?" Talent returns matched dossiers ranked by fit.
Collaborators or Producers might ask about overlap — "has this performer worked with people we know?" Talent returns connections.
Status: specced at planning level. Needs detailed data model and build spec.
### Casting
Workflow tool for filling roles on a specific show. Talent is who's out there. Casting is the internal process of getting the right people into the right roles.
**Casting does not talk to the outside world.** It talks to Talent. All inbound submissions — from AA, the WN portal, bookmarklet captures — land in Talent first. Casting pulls from Talent when it needs candidates.
**Actors Access and Casting:**
WN posts breakdowns on AA because that's where performers and agents look. That's standard industry practice and there's no reason to change it. The WN site and direct agent outreach are additional distribution channels, not replacements. The difference from a traditional casting process is that AA is a distribution and discovery channel, not WN's workspace. Submissions come through AA, the team reviews them there, and people worth pursuing get pulled into Talent (via the bookmarklet). From that point forward, the work happens inside Casting — not in AA's interface.
**The casting lifecycle:**
**Breakdown.** A show (from Slate) has roles to fill. Character data from the script — name, description, age range, vocal range, dance requirements — becomes the starting point. The team refines it. Casting manages where it gets distributed.
**Candidate pool.** Casting queries Talent: "who fits this breakdown?" This includes people who submitted for the role (tagged in Talent) plus people the AI matched from the broader database. The team can also manually pull anyone from Talent into consideration for a role.
**Review.** The team reviews candidates inside Casting. Each candidate's Talent dossier is right there. Decisions: pass, schedule audition, save for another role, flag for future. Every decision is recorded — who made it, notes, reasoning. All of this feeds back into Talent as interaction history.
**Audition scheduling.** Time slots, room assignments, reader assignments, accompanist scheduling for musicals. Confirmations, reschedules.
**Audition notes.** Per-person, per-team-member.
Notes can be structured (quick ratings on vocal ability, acting, movement, look/type, chemistry) or freeform. Voice memos — tap record, say your reaction, it gets transcribed and attached.
After a session, the AI synthesizes across team members' notes. "Marc and Husani both flagged this person for the lead. Marc loved the comedic timing, Husani noted strong vocal control but questioned the movement." Summary, not decision.
**Callbacks.** Same flow, notes layer again. Side-by-side comparison: everyone being considered for this role, every team member's notes from every round.
**Offers.** Who's getting offered what role, terms, agent communication, deadline tracking, backup choices if declined.
**Equity compliance.** EPA/ECC requirements if applicable. Documentation that WN met union obligations.
**Diversity tracking.** Aggregate, anonymized data on submission demographics vs. callback demographics vs. cast demographics. Not quotas — WN being able to see its own patterns and hold itself accountable.
**AI within Casting:**
Candidate matching: ranking candidates from Talent against a breakdown, with reasoning.
Note synthesis: summarizing team feedback across rounds.
Pattern recognition over time: "You've cast this type in this role across three shows. Here's who you haven't considered." Pushing against unconscious defaults.
Schedule optimization: fitting audition logistics across rooms, readers, accompanists, and team calendars.
**What Casting produces for other tools:**
Talent gets enriched by every casting interaction — notes, outcomes, offers made and accepted/declined.
Slate gets casting status — which roles are filled, in process, or open.
**What Casting does NOT own:**
People. Talent owns people. Casting is ephemeral per-show. When the show is cast, the process is done. But all data it generated lives on in Talent and Slate.
Status: specced at planning level. Needs detailed data model and build spec.
### Radar
Cultural monitoring system. Continuously watches the world and maps what it finds against WN's interests. This is not a tool any theatre company has. It turns cultural intuition into a systematic, compounding capability.
**What Radar watches:**
**Publishing and adaptation pipeline.** Book sales, bestseller lists, new releases in relevant genres. BookTok and BookTube trends — what's being talked about, what's being devoured, what fandoms are forming. Fanfic activity on AO3 and similar platforms — volume and velocity of writing in specific fandoms is a leading indicator of audience hunger. Audiobook and podcast fiction trends. Optioning activity — what IP is being picked up for screen adaptation, which signals broader cultural interest even if the adaptation is in a different medium.
**Social and cultural sentiment.** TikTok, Instagram, Twitter/X, Threads, Reddit. Not just what's trending but what kinds of stories and themes people are responding to emotionally. "Queer joy" as a cultural appetite didn't show up in a sales report — it showed up in how people talked about certain content. The AI needs to read sentiment, not just count mentions.
**Streaming and screen.** What's performing on Netflix, Hulu, Prime, etc. What's getting renewed, what's generating fan communities. Screen trends often signal or amplify cultural appetites that theatre can serve differently. Heated Rivalry's success as a novel is one thing — the broader appetite it represents for queer sports romance is the signal Radar cares about.
**Theatre-specific landscape.** What's being developed — readings, workshops, festivals, commissioning announcements. BroadwayWorld casting notices and development news. Regional theatre season announcements. What's transferring, what's closing, what's winning awards. New work festivals and what they're programming. This is the competitive intelligence layer — what's the landscape for a show like Moonshot right now?
**Music and performance culture.** What sounds, styles, and aesthetics are resonating in music, performance art, drag, live entertainment. Theatre doesn't exist in a vacuum — the energy of a show's score and visual language connects to broader performance culture.
**News and politics.** Cultural moments that create receptivity for certain stories. Social movements, political shifts, generational tensions, identity conversations. Not to chase headlines, but to understand the emotional environment audiences are living in.
**What Radar does with what it watches:**
**Signal mapping to slate.** The primary function. Radar knows what's on WN's slate (from Slate — themes, genres, subject matter, structural elements). It continuously maps external signals against that slate. "Interest in [theme] is spiking — that connects to [show] because [reason]." This isn't a daily alert firehose. It's a synthesized, prioritized briefing. The AI filters noise from signal.
**Timing intelligence.** Not just "is there appetite for this" but "is the appetite growing, peaking, or fading." A show that's perfect for a cultural moment needs to move while the moment is alive. Radar should have a sense of trajectory, not just snapshot.
**White space identification.** "Here's a cultural appetite that nothing on your slate addresses." This is the development opportunity radar. It's not telling WN what to write — it's telling WN where the hunger is. Creative decisions remain human. But knowing where the unserved audiences are is strategic intelligence.
**Competitive landscape.** "Three other new musicals in development have queer romance themes. Here's how they're positioned and how Moonshot is distinct." Or: "Nobody is developing anything in [space] despite strong cultural signals." Over time, Radar builds a map of the entire new work pipeline and WN's position within it.
**Comparable identification for existing shows.** "This novel just broke out and shares DNA with [WN show]. Here's why that matters for your pitch to producers." Feeds into Producers and into Slate's comparable data.
**How Radar delivers information:**
This needs thought. A firehose of signals is useless. Radar should produce periodic synthesized briefings — maybe weekly, maybe triggered by significant signal changes. "Here's what moved this week and what it means for your slate." The team should also be able to query it: "What's the current cultural landscape for queer musicals?" "Is there appetite for horror-comedy in theatre right now?" "What's trending in the BookTok-to-adaptation pipeline?"
**What Radar does NOT do:**
It doesn't make creative decisions. It doesn't tell WN what to develop or how to develop it. It provides strategic context. The humans decide what to do with it.
It doesn't do marketing. Audience and Marketing tools (when built) handle how WN talks to people. Radar is about understanding the landscape, not acting on it.
**What Radar exposes to other tools:**
Slate asks: "what's the current cultural relevance of this show's themes?" Radar returns a landscape assessment.
Producers asks: "what market context should we include when pitching this show?" Radar returns talking points grounded in real data.
Dramaturg might ask: "are there structural or tonal trends in what's resonating right now?" Radar returns patterns.
**What makes Radar compound:**
It gets smarter over time because it learns what WN cares about. Early on, it's broad — watching everything, flagging a lot. Over time, it calibrates to WN's taste, WN's slate, WN's strategic positioning. It starts to understand not just "what's trending" but "what's trending that matters to Weird Noises specifically." The signal-to-noise ratio improves with every interaction.
It also builds a historical record of cultural moments. "Last time we saw this pattern of signals, here's what happened." Predictive capability emerges from accumulated observation.
Status: not yet specced beyond this planning level. Needs detailed design on data sources, signal processing, briefing format, and AI architecture.

### Dramaturg
AI-powered script and score analysis. Hand it a script, get back structural, comparative, and developmental insight. Not a replacement for human dramaturgy — a tool that makes the humans sharper.
**Core interaction:**
Select the medium (musical, play, screenplay, teleplay). Upload a script. The AI reads it and produces a comprehensive analysis. The team reads it, argues with it, ignores parts, uses what's useful.
**What the AI produces on upload:**
**Structural analysis.** Act/scene structure, where the turns are, pacing graph. For musicals: song placement and function (I want song, conflict song, charm song, eleven o'clock number, etc.). Where's the energy high, where does it dip.
**Character analysis.** Stage time per character, arcs, relationship mapping, balance across the piece. For musicals: who sings, how often, what kind of material.
**Emotional mapping.** Scene-by-scene emotional register — comedy, tension, intimacy, heartbreak. The audience's journey across the piece. Where are the tonal shifts and are they earned.
**Thematic tracking.** What themes surface, where they recur, whether the piece delivers on what it sets up.
**Dialogue analysis.** Voice distinctiveness between characters, rhythm and register. For musicals: whether book-to-song transitions escalate naturally or lurch.
**Comparables.** Placing the work in a landscape of existing work. Not "this is derivative" — "this sits here, and here's how it's distinct."
**Producing considerations.** Cast size, set complexity, technical demands, band size, estimated runtime. Dramaturg frames these as creative considerations, not logistics — "14 locations implies either a unit set or a heavy fly budget" is a dramaturgical observation.
**Potential concerns.** Observations, not prescriptions. "The protagonist disappears for 20 minutes in Act 2." "The B-plot resolves before the A-plot crisis." The team decides if they're actually problems.
**Version comparison:**
When a new draft is uploaded (via Slate), Dramaturg compares analyses across versions. Not what text changed — how the structure changed. "The pacing issue in Act 2 is tighter in this draft." "The new song shifts the emotional arc — here's how." Tracks how a show evolves structurally over time.
**On-demand queries:**
"Is the Act 1 finale earning its climax?" "Compare our song placement to [show]." "What happens to the pacing if we cut Scene 4?" "Where are the best candidates for a new song in Act 2?" Thinking partner, not just report generator.
**The learning layer:**
**Anti-formulaic by design.** Dramaturg knows conventional structure so it can describe departures, not prescribe adherence. "Your second act break is unconventional — here's what that does" is useful. "Your second act break is wrong" is formulaic. Structurally literate without being structurally conservative. Its job is to articulate what the script is doing, not what it should be doing.
**No sycophancy.** Dramaturg does not soften, hedge, or sandwich observations in praise. It states what it sees. If a structural choice creates a problem, it says so directly. If something works, it can say that too — but never as a cushion for what comes next. The tool is calibrated to be honest the way a trusted collaborator is honest, not the way a polite stranger is. This requires deliberate prompt engineering against LLMs' default tendency toward validation. The seeded references and per-author calibration help — the tool knows what WN values, so it's not being harsh for its own sake. It's being direct because that's what's useful.
**Seeded references.** Through admin/settings, the team seeds Dramaturg with examples of shows that represent WN's values and taste — including shows that break convention and succeed. These become the baseline lens. The team adds, removes, and adjusts references as WN's taste evolves.
**Calibration to WN.** Over time, learns what WN's shows tend to do well and where they tend to struggle. Surfaces patterns across the slate. Team feedback ("this was useful" vs. "this was irrelevant") trains its sense of what matters to WN.
**Per-author craft calibration.** Learns individual writers' tendencies from multiple drafts. Flags recurring habits without the writer rediscovering them each time.
**Per-author feedback style calibration.** Adjusts how it communicates based on who it's talking to. Can be seeded explicitly ("this writer prefers questions over statements") and refined as the tool observes how writers respond.
**Medium-specific frameworks:**
Musical, play, screenplay, teleplay each have different structural expectations. Song placement analysis doesn't apply to a screenplay. The analytical framework shifts based on medium selection. The tool and interface are the same.
**What Dramaturg does NOT do:**
Write, generate, or rewrite. It analyzes. Creative work is human.
Judge quality. "This is good" isn't useful. "This structural choice produces this effect" is.
**What Dramaturg exposes to other tools:**
Slate gets structural metadata — act/scene breakdown, character breakdown, song list, runtime.
Radar can ask: "does this show's thematic profile align with current cultural signals?"
Producers can ask: "give me a structural pitch summary for this show."
Status: specced at planning level. Needs detailed design on analytical frameworks per medium, the seeded reference system, and the learning/calibration mechanism.
### Audience
System for understanding the people who engage with Weird Noises.
**Data intake.**
Touchpoints flow in from every system that touches people — email platform, social accounts, ticketing, donation platforms, event RSVPs, the WN site. Each touchpoint: this person, this action, this date, this channel, optionally this project. For events without formal ticketing, the team logs attendance. Integrations get built as tools come online. Early on some intake is manual.
**Identity resolution.**
People show up through different channels with different identifiers. An email from Fractured Atlas, an Instagram handle, a ticket purchase name. Audience resolves these into a single person. Some automatic (email matching), some AI-inferred (name matching, cross-referencing), some ambiguous and flagged rather than guessed.
**AI research on every person.**
Every person who enters Audience gets researched. Who they are, what they do professionally, what organizations they're connected to, what communities they're in, what their interests are, what their reach is. Same principle as Talent building dossiers — the AI goes out and builds understanding from whatever signals are available. Dossiers refresh as people's circumstances change.
**What WN adds over time.**
Manual notes on any person. Tags for ad-hoc grouping.
**Analytics.**
Aggregate views across the whole audience or any segment of it. Growth over time, engagement broken down by channel, by project, and by time period. Retention — who comes back and who doesn't, and what distinguishes the two. Geographic distribution of the audience. Comparative analysis across projects — how the Moonshot audience differs from the Stable Geniuses audience in composition, interests, and engagement patterns. Dashboards and period-over-period comparisons that let the team see how the audience is evolving.
**Engagement health.**
Not just snapshots but trajectories over time. Who's actively engaged, who's drifting, who's lapsed. The system proactively surfaces changes — "these 12 people used to engage regularly and haven't in three months" — so that WN can maintain relationships rather than discover they've gone cold.
**AI querying.**
**Individual.** "Who is this person? What's their full picture — engagement with WN, professional life, communities, reach?" The complete understanding of any single audience member.
**Project.** "Who engaged with this project? Who are they? What connects them? How do they compare to the audience for other projects?" A portrait of a project's audience built from knowledge of every person in it.
**Aggregate.** "Who is our audience? What patterns exist? What do they have in common, what's surprising?" Synthesized understanding, not just charts.
**Strategic.** "Where should WN be showing up? What accounts should we follow, what publications should we pitch, what festivals and communities overlap with our audience? Who are we not reaching?" Concrete recommendations with reasoning, based on where the actual humans who engage with WN already exist in the world.
**Outward discovery.** "Based on who engages with WN, who else fits that profile? What adjacent communities exist that WN has no presence in?" Understanding the audience you have becomes a lens for finding the audience you could have.
**Opportunity surfacing.** The system proactively identifies what individual people might unlock for WN. "This audience member just moved to a role at [organization]." "This person is connected to a foundation that funds the kind of work WN does." "This person knows a producer WN has been trying to reach." Any person who shows up might be able to open a door WN didn't know existed.
**What Audience does NOT do:**
Marketing execution. Doesn't send emails, run campaigns, manage ads. It's the knowledge layer. Marketing tools pull from it.
**What Audience exposes to other tools:**
**Person-level.** Any people-facing tool can ask Audience about a specific person — engagement history, trajectory, professional profile, communities, reach. Producers looking at a producer gets their full engagement context. Talent looking at a performer knows their relationship with WN. Casting considering an actor gets the whole picture.
**Project-level.** Slate can ask for a portrait of a project's audience — who they are, what connects them, what channels drove them.
**Aggregate.** Funding can ask about donor patterns. Radar can cross-reference cultural signals against audience behavior. Producers can pull proof of audience demand — a real portrait of who the audience is and why they care.
**Strategic.** Any tool doing outward-facing work can tap Audience's knowledge about where WN should be showing up — publications, festivals, communities, accounts that overlap with WN's actual audience.
Status: specced at planning level.
### Collaborators
The people who make shows — directors, choreographers, music directors, designers (set, costume, lighting, sound, projection), orchestrators, arrangers, dramaturg(s), fight directors, intimacy coordinators. Distinct from Talent (performers) and Producers (the people who finance and produce).
**Intake.**
The team adds someone to Collaborators when they encounter their work and want to remember them, or when they're attached to a WN project. Could be after seeing a show, getting a recommendation, reading a review, meeting someone at an event, or hiring someone for a reading. The team enters who the person is and why they're being added. The AI researches from there.
The database grows over time as WN encounters more people's work. Some entries are people WN has worked with. Some are people WN is aware of and interested in. Both belong in the system.
**AI research.**
When someone is added, the AI builds a profile. Credits and production history — what they've worked on, where, with whom. Areas of specialty. Aesthetic sensibility inferred from their body of work. Awards and recognition. Representation if applicable. Network — who they've worked with, which overlaps with WN's relationships across Producers, Talent, and other collaborators.
**What WN adds over time.**
For people WN has actually worked with: how it went. Strong creative vision but hard to collaborate with? Amazing with actors but missed the bigger picture? Perfect for comedy, wrong for drama? Candid internal assessments that become irreplaceable institutional knowledge.
Team dynamics. A music director who has great chemistry with a specific director. A choreographer who clashes with a specific designer. These dynamics matter enormously and they're tracked nowhere in the industry.
For everyone — internal notes, tags, and fit assessments per show.
**AI querying.**
"Who's out there directing new musicals?" "Who's designed sets for intimate Off-Broadway musicals in the last three years?" "Find me choreographers who've worked with [director WN is considering]." "Who in our database has worked at [venue]?"
"We're putting together a creative team for Moonshot — who should we be thinking about for director, and why?" The AI draws on credits, aesthetic match with the material, WN's internal notes, network overlap with other people attached to the project, and availability.
**Relationship to Slate.**
When a collaborator is attached to a show in Slate, that's reflected in Collaborators too. The collaborator's profile shows every WN project they've been involved with, in what capacity, and how it went. Slate owns the attachment (who's on this project). Collaborators owns the person (who is this person across all projects).
**What Collaborators exposes to other tools.**
Casting might ask: "has this actor worked with the director attached to this show?" Collaborators has the director's full network.
Producers might ask: "does this producer have relationships with any of our collaborators?" Network overlap.
Slate can enrich its creative team attachments with full profiles from Collaborators.
Status: specced at planning level.

### Theatre Ops
The operational backbone of producing a show. This is the only theatre-specific tool in Intelligence. Everything else works across mediums. If WN eventually needs film/TV production operations, that would be a separate tool.
**Budgeting.**
Every show has two distinct budgets. The capitalization budget covers the total cost to mount a production from development through opening night — a one-time fundraising target. The weekly operating budget covers the ongoing cost to run the show once it's open and determines how long a show can sustain before it needs to recoup or close. The system manages both.
The AI generates initial budget drafts from show data. Slate provides cast size, musician count, number of locations, technical complexity. Theatre Ops applies industry-standard cost models and WN's own historical production data to produce a starting budget that the team refines. Budget models improve with each production WN mounts — the more shows that go through the system, the more accurate the initial drafts become.
Once a production is underway, Theatre Ops tracks actuals against the budget. Where spending is over or under, what the burn rate looks like, and what the projected recoupment timeline is.
**Union compliance.**
Theatre involves multiple unions, each with its own contract structures, minimum rates, benefit contribution requirements, work rules, and reporting obligations. AEA for actors, IATSE for stagehands, wardrobe, hair, and makeup, SDC for directors and choreographers, USA for designers, Local 802 for musicians. The system knows the current agreements and continuously monitors compliance — are minimums being paid correctly, are benefit contributions calculated right, are work rule limits being respected for hours, breaks, and consecutive performance limits. It flags issues before they become grievances or penalties.
**Payroll and royalties.**
Cast, crew, musicians, and creative team all have different pay structures — weekly salaries, per-performance rates, royalty percentages. The system calculates what everyone is owed each week based on the performance schedule, the applicable union rates, and any individually negotiated deals. Royalty calculations are particularly complex, involving different royalty pools, different percentage tiers at different recoupment levels, caps and floors. The system tracks all of it.
**Venue and contracts.**
Venue rental terms, technical specifications, load-in and load-out schedules, house rules, insurance requirements, and bonds. The system stores contracts, tracks deadlines and obligations, and surfaces upcoming requirements before they're missed.
**Company management.**
The logistical care of the humans involved in a production. Housing and travel arrangements for out-of-town company members, per diem tracking, company rules and handbook, emergency contacts.
**House seats and comps.**
Managing producer house seat allocations and comp ticket policies. Tracking who gets what across every performance.
**Production scheduling.**
Rehearsal schedules, tech schedules, performance calendars. Coordinating availability across cast, crew, and creative team. AEA has specific rules about rehearsal hours, breaks, and days off, and the system enforces these automatically — a proposed schedule that violates union rules gets flagged before it's published.
**AI within Theatre Ops.**
Budget generation from show data. Compliance monitoring across all unions. Payroll and royalty calculation. Schedule optimization within union constraints. Proactive alerts when something needs attention — a rehearsal schedule approaching work rule limits, benefit contributions coming due, spending trending over budget in a specific category. Over time, every production that runs through Theatre Ops makes the system's cost models, scheduling templates, and compliance patterns sharper for the next one.
**What Theatre Ops exposes to other tools.**
Slate gets production status and financial health for any active production.
Funding gets budget data — how much needs to be raised, current capitalization status, weekly operating costs, and recoupment projections.
Status: specced at planning level.

### Funding
The money side of WN's projects. Tracks who's giving money, how much, for what, and where things stand. Owns its own people — the individuals and organizations that fund WN's work. A wealthy friend writing a check, a commercial investor capitalizing a production, and a donor giving through fiscal sponsorship are all different relationships, but they all live here.
Some of these people also exist in other tools. A producer who invests in a show is in Producers for the professional relationship and in Funding for the financial one. A donor who also attends readings is in Audience for the engagement and in Funding for the giving.
**AI research on funders.**
Every person or organization that puts money into WN gets researched. Who are they, what else have they funded or invested in, what are their interests, what's their capacity, what are they connected to. This informs stewardship of existing relationships and identification of prospective funders.
**Capitalization tracking.**
This is the core of Funding. Each show has a capitalization target from its budget in Theatre Ops. Funding tracks how much has been raised, from whom, through what vehicles, and what's still needed. Investor tracking — who's in, how much, what terms. Cap table management — ownership stakes, distribution rights, recoupment positions. For shows with mixed funding (some investment, some donations through fiscal sponsorship), the system tracks all sources for the same project.
**Offering documents.**
For commercially capitalized shows, the system manages offering documents — templates, version tracking, distribution tracking. Who received it, who signed, who's pending.
**Investor relations.**
Communication obligations, reporting schedules, distribution calculations. Once a show is running, investors need to know how it's performing financially. The system tracks what's owed to whom at what recoupment level and manages the reporting cadence.
**Fiscal sponsorship and donations.**
For projects using fiscal sponsorship (like Moonshot through Fractured Atlas), the system tracks donors, amounts, campaigns, tiers, and progress. This is a smaller piece of the funding picture than commercial capitalization but worth supporting.
**Grants and residencies.**
Some development opportunities exist for for-profit companies — residencies, commissioning programs, certain arts council funding. The system tracks these when relevant — deadlines, application status, outcomes. Not a central feature, but supported when applicable.
**Financial reporting.**
Per-show funding status. Capitalization progress against target. Recoupment tracking for active productions. Investor reporting. Donor acknowledgment tracking for fiscal sponsorship campaigns.
**What Funding asks other tools.**
Slate: budget data to set capitalization targets. Pitch materials when needed for investor conversations.
Producers: professional context on funders who are also producers.
Audience: engagement context on funders who are also audience members.
Radar: market context relevant to investment cases.
**What Funding exposes to other tools.**
Slate: how much has been raised for each project, how much is needed, current financial status.
Theatre Ops: capitalization status for recoupment projections.
Producers: financial context on producers who are also investors.
Status: specced at planning level.
### Context
The record of every conversation WN has. Meetings are automatically ingested, transcribed, and processed by the AI. What was discussed, what was decided, what was committed to — all searchable, all available to the rest of Intelligence.
**Intake.**
Meetings flow in automatically from wherever they happen. Google Meet auto-notes and transcripts, tl;dv or Otter exports from external meetings, Zoom recordings. The team shouldn't have to do anything to get a meeting into the system — it arrives on its own. The system monitors the sources and ingests new meeting data as it appears.
**Confidentiality.**
Two states. Default is open — visible to everyone on the team. Any meeting can be restricted to a configurable list (currently Husani and Marc). To restrict a meeting, say "this is confidential" during the meeting itself. The AI detects the marker in the transcript and restricts access. No pre-configuration needed, works regardless of platform or who scheduled the meeting.
**What the AI does with every meeting.**
Each meeting gets a clear summary — what was discussed, what was decided, what came out of it. Not a condensed transcript. A synthesis that captures the substance.
**Meeting preparation.** Before a scheduled meeting, Context synthesizes everything relevant from previous conversations. Meeting with Producer X? Here's every previous conversation with them — what was discussed, what was promised, what's changed since. The team walks into every meeting with full context.
**Querying and search.**
"What did we decide about the Act 2 opening?" "What did Marc say about the venue options?" "When did we first discuss [topic]?" "What's been said about Moonshot's casting in the last month?" Every conversation WN has ever had is searchable — not as raw transcripts but as understood, synthesized knowledge.
**What Context exposes to other tools.**
Any tool can ask Context for relevant conversation history. Producers looking at a producer can pull every meeting where that person was discussed. Slate can pull every conversation about a specific project. Casting can find every discussion about a specific role or performer. Funding can pull conversations about investor negotiations. The full conversational history of any topic, person, or project is available to whatever tool needs it.
Status: specced at planning level.


# Integration Patterns (Not Standalone Tools)
### Relationship Graph
Cross-system query capability. "Find me a path to Producer X through people we know." Fans out to Producers, Talent, Collaborators, and Slate. The graph is the connections between systems, not a system itself. Any people-facing tool can invoke it.

