"""
Producers interface.

Business logic and MCP tool registration for the Producers tool.
All 6 MCP tools are registered here, plus methods used by routes.
"""

import logging
from datetime import datetime, timezone

from fastmcp import FastMCP
from sqlalchemy import or_, func as sa_func
from sqlalchemy.orm import Session, joinedload

from producers.backend.ai import (
    get_relationship_state_label,
    recompute_relationship_state,
)
from producers.backend.models import (
    Award,
    ChangeHistory,
    DiscoveryCalibration,
    DiscoveryCandidate,
    DiscoveryFocusArea,
    DiscoveryScan,
    EntityEmail,
    EntitySocialLink,
    FollowUpSignal,
    IntelligenceProfile,
    Interaction,
    LookupValue,
    Organization,
    Producer,
    ProducerOrganization,
    ProducerProduction,
    ProducerSettings,
    ProducerShow,
    ProducerTag,
    ProducerTrait,
    ProducerIntel,
    Production,
    ResearchSource,
    Show,
    SocialPlatform,
    Tag,
    Venue,
)

logger = logging.getLogger(__name__)


class ProducersInterface:
    def __init__(self, session_factory, mcp_server: FastMCP):
        self._session_factory = session_factory
        self._mcp_server = mcp_server
        self._register_mcp_tools(mcp_server)

    def _register_mcp_tools(self, mcp_server: FastMCP):
        """Register Producers MCP tools — reads and writes for producers, shows, productions, venues, and discovery."""

        # --- Producer reads ---

        @mcp_server.tool
        def producers_search(criteria: str) -> list[dict]:
            """Search producers by criteria. Searchable by: first/last name, email, organization,
            location, tags, relationship state, production history attributes.
            Also handles identity matching — exact lookup by name or email."""
            return self.search(criteria)

        @mcp_server.tool
        def producers_get_record(producer_id: int) -> dict:
            """Full profile for a single producer. Returns: identity (first_name, last_name, email, phone,
            location, photo, website, social links, birthdate, pronouns, nickname, college,
            hometown, spouse/partner, languages, seasonal location),
            dossier metadata, intake source, tags, relationship state."""
            return self.get_record(producer_id)

        @mcp_server.tool
        def producers_get_productions(producer_id: int) -> list[dict]:
            """A producer's production history. Returns: list of productions with title,
            venue (name, type, city/state/country), year/run period, producer role, scale, run length,
            outcome, awards, and co-producers on each production."""
            return self.get_productions(producer_id)

        @mcp_server.tool
        def producers_get_organizations(producer_id: int) -> list[dict]:
            """A producer's organizational affiliations. Returns: list of organizations with
            name, type, role/title held, start date, end date, notes."""
            return self.get_organizations(producer_id)

        @mcp_server.tool
        def producers_get_interactions(producer_id: int) -> list[dict]:
            """WN's interaction history with a producer. Returns: chronological list of
            interactions with date, text, author, and any follow-up signals."""
            return self.get_interactions(producer_id)

        @mcp_server.tool
        def producers_get_relationship_state(producer_id: int) -> dict:
            """The relationship state for a producer. Returns: last contact date,
            interaction count, interaction frequency, pending follow-ups, computed state
            label (no_contact, new, active, waiting, overdue, gone_cold)."""
            return self.get_relationship_state(producer_id)

        # --- Lookup values ---

        @mcp_server.tool
        def producers_get_lookup_values(category: str, entity_type: str) -> list[dict]:
            """Get all lookup values for a category and entity type. Returns id, value,
            display_label, description, and css_class for each value. The description
            contains rich domain context that explains what each value means and when
            to use it. Categories include: scale (production), medium (show),
            work_origin (show), production_type (production), budget_tier (production),
            funding_type (production), venue_type (venue), role (producer_production),
            role (producer_show), scan_focus_type (discovery_scan)."""
            return self.get_lookup_values(category, entity_type)

        # --- Show reads ---

        @mcp_server.tool
        def producers_get_show(show_id: int) -> dict:
            """Get a show with all its data. Returns: id, title, medium, original_year,
            description, genre (prose), themes (prose), summary (prose), plot_synopsis (prose), work_origin,
            productions (with year, venue, scale, producer credits), and
            producer_shows (IP-level producer relationships with roles)."""
            return self.get_show(show_id)

        @mcp_server.tool
        def producers_search_shows(search: str = "", limit: int = 50, offset: int = 0) -> dict:
            """Search shows by title. Returns paginated list with id, title, medium,
            original_year, description, genre, themes, summary, plot_synopsis, work_origin."""
            return self.list_shows(search, limit, offset)

        # --- Show writes ---

        @mcp_server.tool
        def producers_update_show(show_id: int, genre: str = None, themes: str = None,
                                   summary: str = None, plot_synopsis: str = None,
                                   work_origin_id: int = None,
                                   medium_id: int = None, original_year: int = None,
                                   description: str = None) -> dict:
            """Update a show's fields. All parameters are optional — only provided fields
            are updated. Use producers_get_lookup_values('work_origin', 'show') and
            producers_get_lookup_values('medium', 'show') to get valid IDs.
            genre, themes, summary, and plot_synopsis are prose fields — write rich, informative text."""
            data = {}
            if genre is not None: data["genre"] = genre
            if themes is not None: data["themes"] = themes
            if summary is not None: data["summary"] = summary
            if plot_synopsis is not None: data["plot_synopsis"] = plot_synopsis
            if work_origin_id is not None: data["work_origin_id"] = work_origin_id
            if medium_id is not None: data["medium_id"] = medium_id
            if original_year is not None: data["original_year"] = original_year
            if description is not None: data["description"] = description
            return self.update_show(show_id, data)

        # --- Organization reads ---

        @mcp_server.tool
        def producers_search_organizations(search: str = "", limit: int = 50, offset: int = 0) -> dict:
            """Search organizations by name. Returns paginated list with id, name, org_type,
            website, city, state_region, country, description, producer_count."""
            return self.list_organizations(search, limit, offset)

        @mcp_server.tool
        def producers_get_organization(organization_id: int) -> dict:
            """Get a single organization with all its data including affiliated producers.
            Returns: id, name, org_type, website, location, description, social_links,
            emails, and list of affiliated producers with their roles and tenure."""
            return self.get_organization(organization_id)

        # --- Venue reads ---

        @mcp_server.tool
        def producers_search_venues(search: str = "", limit: int = 50, offset: int = 0) -> dict:
            """Search venues by name. Returns paginated list with id, name, venue_type,
            city, state_region, country, capacity, description."""
            return self.list_venues(search, limit, offset)

        # --- Venue writes ---

        @mcp_server.tool
        def producers_create_venue(name: str, venue_type_id: int = None, city: str = None,
                                    state_region: str = None, country: str = None,
                                    capacity: int = None, description: str = None) -> dict:
            """Create a new venue. Use producers_get_lookup_values('venue_type', 'venue')
            to get valid venue_type_id values. Always search for existing venues first
            with producers_search_venues before creating a new one to avoid duplicates."""
            return self.create_venue({
                "name": name, "venue_type_id": venue_type_id, "city": city,
                "state_region": state_region, "country": country,
                "capacity": capacity, "description": description,
            })

        # --- Production writes ---

        @mcp_server.tool
        def producers_create_production(show_id: int, year: int = None,
                                         venue_id: int = None, scale_id: int = None,
                                         production_type_id: int = None,
                                         budget_tier_id: int = None,
                                         funding_type_id: int = None,
                                         capitalization: int = None,
                                         recouped: bool = None,
                                         start_date: str = None, end_date: str = None,
                                         run_length: str = None,
                                         description: str = None) -> dict:
            """Create a new production of a show. A production is a specific mounting —
            a run at a venue in a given year. Use lookup value tools to get valid IDs:
            producers_get_lookup_values('scale', 'production') for scale_id,
            producers_get_lookup_values('production_type', 'production') for production_type_id,
            producers_get_lookup_values('budget_tier', 'production') for budget_tier_id,
            producers_get_lookup_values('funding_type', 'production') for funding_type_id.
            Search for existing venues with producers_search_venues and use the venue_id.
            Fill in every field you can find information for — capitalization in dollars,
            recouped as true/false, start_date and end_date as YYYY-MM-DD."""
            data = {"show_id": show_id}
            if year is not None: data["year"] = year
            if venue_id is not None: data["venue_id"] = venue_id
            if scale_id is not None: data["scale_id"] = scale_id
            if production_type_id is not None: data["production_type_id"] = production_type_id
            if budget_tier_id is not None: data["budget_tier_id"] = budget_tier_id
            if funding_type_id is not None: data["funding_type_id"] = funding_type_id
            if capitalization is not None: data["capitalization"] = capitalization
            if recouped is not None: data["recouped"] = recouped
            if start_date is not None: data["start_date"] = start_date
            if end_date is not None: data["end_date"] = end_date
            if run_length is not None: data["run_length"] = run_length
            if description is not None: data["description"] = description
            return self.create_production(data, "ai:show_research")

        @mcp_server.tool
        def producers_update_production(production_id: int, year: int = None,
                                         venue_id: int = None, scale_id: int = None,
                                         production_type_id: int = None,
                                         budget_tier_id: int = None,
                                         funding_type_id: int = None,
                                         capitalization: int = None,
                                         recouped: bool = None,
                                         start_date: str = None, end_date: str = None,
                                         run_length: str = None,
                                         description: str = None) -> dict:
            """Update an existing production's fields. Only provided fields are updated.
            Use the same lookup value tools as producers_create_production for valid IDs."""
            data = {}
            if year is not None: data["year"] = year
            if venue_id is not None: data["venue_id"] = venue_id
            if scale_id is not None: data["scale_id"] = scale_id
            if production_type_id is not None: data["production_type_id"] = production_type_id
            if budget_tier_id is not None: data["budget_tier_id"] = budget_tier_id
            if funding_type_id is not None: data["funding_type_id"] = funding_type_id
            if capitalization is not None: data["capitalization"] = capitalization
            if recouped is not None: data["recouped"] = recouped
            if start_date is not None: data["start_date"] = start_date
            if end_date is not None: data["end_date"] = end_date
            if run_length is not None: data["run_length"] = run_length
            if description is not None: data["description"] = description
            return self.update_production(production_id, data, "ai:show_research")

        # --- Producer-show and producer-production links ---

        @mcp_server.tool
        def producers_add_producer_to_show(producer_id: int, show_id: int,
                                            role_id: int = None) -> dict:
            """Link a producer to a show at the IP level (rights, development, lead producing).
            Use producers_get_lookup_values('role', 'producer_show') for valid role_id values.
            Always search for the producer first with producers_search to get their ID."""
            return self.add_producer_show(producer_id, show_id, role_id, "ai:show_research")

        @mcp_server.tool
        def producers_add_producer_to_production(production_id: int, producer_id: int,
                                                  role_id: int = None) -> dict:
            """Link a producer to a specific production with a credit role.
            Use producers_get_lookup_values('role', 'producer_production') for valid role_id values.
            Always search for the producer first with producers_search to get their ID."""
            return self.add_producer_to_production(production_id, producer_id, role_id, "ai:show_research")

        # --- Discovery candidates ---

        @mcp_server.tool
        def producers_add_discovery_candidate(first_name: str, last_name: str,
                                               reasoning: str, source: str = None,
                                               scan_id: int = None) -> dict:
            """Add a producer to the discovery review queue. Use this when you find a
            producer credit for someone who is NOT already in the database (check with
            producers_search first). The reasoning should explain who they are and why
            they were found — e.g. 'Lead producer of Hamilton's 2015 Broadway production.
            Not currently in the WN database.' The team will review and decide whether
            to confirm them, which triggers full dossier research."""
            return self.create_discovery_candidate(
                first_name=first_name, last_name=last_name,
                reasoning=reasoning, source=source, scan_id=scan_id,
            )

    # --- MCP tool implementations ---

    def search(self, criteria: str) -> list[dict]:
        """Search producers by various criteria."""
        with self._session_factory() as session:
            query = session.query(Producer).options(
                joinedload(Producer.organizations).joinedload(ProducerOrganization.organization),
                joinedload(Producer.tags).joinedload(ProducerTag.tag),
            )
            criteria_lower = criteria.lower().strip()

            # Check for email-like search
            if "@" in criteria:
                email_producer_ids = (
                    session.query(EntityEmail.entity_id)
                    .filter(
                        EntityEmail.entity_type == "producer",
                        EntityEmail.email.ilike(f"%{criteria}%"),
                    )
                    .subquery()
                )
                query = query.filter(Producer.id.in_(email_producer_ids))
            else:
                # Search across name (individual and full), location
                query = query.filter(
                    or_(
                        (Producer.first_name + ' ' + Producer.last_name).ilike(f"%{criteria}%"),
                        Producer.first_name.ilike(f"%{criteria}%"),
                        Producer.last_name.ilike(f"%{criteria}%"),
                        Producer.city.ilike(f"%{criteria}%"),
                        Producer.state_region.ilike(f"%{criteria}%"),
                    )
                )

            producers = query.limit(50).all()
            return [self._producer_summary(p, session) for p in producers]

    def get_record(self, producer_id: int) -> dict:
        """Get full producer record."""
        with self._session_factory() as session:
            producer = session.query(Producer).options(
                joinedload(Producer.tags).joinedload(ProducerTag.tag),
            ).filter_by(id=producer_id).first()
            if not producer:
                return {"error": "Producer not found"}

            cold_threshold = self._get_cold_threshold(session)
            state_label = get_relationship_state_label(producer, cold_threshold)
            tags = [pt.tag.name for pt in producer.tags if pt.tag]

            emails = self._get_emails(session, "producer", producer_id)
            social_links = self._get_social_links(session, "producer", producer_id)
            primary_email = next((e for e in emails if e["is_primary"]), None)

            return {
                "id": producer.id,
                "first_name": producer.first_name,
                "last_name": producer.last_name,
                "email": primary_email["email"] if primary_email else None,
                "emails": emails,
                "phone": producer.phone,
                "city": producer.city,
                "state_region": producer.state_region,
                "country": producer.country,
                "photo_url": producer.photo_url,
                "website": producer.website,
                "social_links": social_links,
                "birthdate": str(producer.birthdate) if producer.birthdate else None,
                "pronouns": producer.pronouns,
                "nickname": producer.nickname,
                "college": producer.college,
                "hometown": producer.hometown,
                "hometown_state": producer.hometown_state,
                "hometown_country": producer.hometown_country,
                "spouse_partner": producer.spouse_partner,
                "languages": producer.languages,
                "seasonal_location": producer.seasonal_location,
                "description": producer.description,
                "last_research_date": str(producer.last_research_date) if producer.last_research_date else None,
                "research_sources_consulted": producer.research_sources_consulted,
                "research_gaps": producer.research_gaps,
                "research_status": producer.research_status,
                "research_status_detail": producer.research_status_detail,
                "intake_source": producer.intake_source,
                "intake_source_url": producer.intake_source_url,
                "intake_ai_reasoning": producer.intake_ai_reasoning,
                "last_contact_date": str(producer.last_contact_date) if producer.last_contact_date else None,
                "interaction_count": producer.interaction_count,
                "interaction_frequency": producer.interaction_frequency,
                "next_followup_due": str(producer.next_followup_due) if producer.next_followup_due else None,
                "relationship_state": state_label,
                "tags": tags,
                "created_at": str(producer.created_at),
                "updated_at": str(producer.updated_at),
            }

    def get_productions(self, producer_id: int) -> list[dict]:
        """Get a producer's production history."""
        with self._session_factory() as session:
            links = (session.query(ProducerProduction)
                     .filter_by(producer_id=producer_id)
                     .options(
                         joinedload(ProducerProduction.role),
                         joinedload(ProducerProduction.production)
                         .joinedload(Production.scale),
                         joinedload(ProducerProduction.production)
                         .joinedload(Production.show)
                         .joinedload(Show.medium),
                         joinedload(ProducerProduction.production)
                         .joinedload(Production.venue)
                         .joinedload(Venue.venue_type),
                         joinedload(ProducerProduction.production)
                         .joinedload(Production.producers)
                         .joinedload(ProducerProduction.producer),
                     )
                     .all())

            results = []
            for link in links:
                prod = link.production
                co_producers = [
                    {"name": f"{pp.producer.first_name} {pp.producer.last_name}", "role": self._lookup_dict(pp.role)}
                    for pp in prod.producers
                    if pp.producer_id != producer_id
                ]
                venue_data = None
                if prod.venue:
                    venue_data = {
                        "name": prod.venue.name,
                        "venue_type": self._lookup_dict(prod.venue.venue_type),
                        "city": prod.venue.city,
                        "state_region": prod.venue.state_region,
                        "country": prod.venue.country,
                    }
                show_data = None
                if prod.show:
                    show_data = {
                        "id": prod.show.id,
                        "title": prod.show.title,
                        "medium": self._lookup_dict(prod.show.medium),
                        "original_year": prod.show.original_year,
                    }
                results.append({
                    "production_id": prod.id,
                    "title": show_data["title"] if show_data else None,
                    "show": show_data,
                    "venue": venue_data,
                    "year": prod.year,
                    "start_date": str(prod.start_date) if prod.start_date else None,
                    "end_date": str(prod.end_date) if prod.end_date else None,
                    "scale": self._lookup_dict(prod.scale),
                    "role": self._lookup_dict(link.role),
                    "run_length": prod.run_length,
                    "description": prod.description,
                    "co_producers": co_producers,
                })
            return results

    def get_organizations(self, producer_id: int) -> list[dict]:
        """Get a producer's organizational affiliations."""
        with self._session_factory() as session:
            links = (session.query(ProducerOrganization)
                     .filter_by(producer_id=producer_id)
                     .options(
                         joinedload(ProducerOrganization.organization)
                         .joinedload(Organization.org_type),
                     )
                     .all())
            return [
                {
                    "organization_id": link.organization.id,
                    "name": link.organization.name,
                    "org_type": self._lookup_dict(link.organization.org_type),
                    "role_title": link.role_title,
                    "start_date": str(link.start_date) if link.start_date else None,
                    "end_date": str(link.end_date) if link.end_date else None,
                    "notes": link.notes,
                }
                for link in links
            ]

    def get_interactions(self, producer_id: int) -> list[dict]:
        """Get WN's interaction history with a producer."""
        with self._session_factory() as session:
            interactions = (session.query(Interaction)
                           .filter_by(producer_id=producer_id)
                           .options(joinedload(Interaction.follow_up_signals))
                           .order_by(Interaction.date.desc())
                           .all())
            return [
                {
                    "id": i.id,
                    "date": str(i.date) if i.date else None,
                    "content": i.content,
                    "author": i.author,
                    "follow_up_signals": [
                        {
                            "id": f.id,
                            "implied_action": f.implied_action,
                            "timeframe": f.timeframe,
                            "due_date": str(f.due_date) if f.due_date else None,
                            "resolved": f.resolved,
                        }
                        for f in i.follow_up_signals
                    ],
                }
                for i in interactions
            ]

    def get_relationship_state(self, producer_id: int) -> dict:
        """Get the relationship state for a producer."""
        with self._session_factory() as session:
            producer = session.get(Producer, producer_id)
            if not producer:
                return {"error": "Producer not found"}

            cold_threshold = self._get_cold_threshold(session)
            state_label = get_relationship_state_label(producer, cold_threshold)

            pending_followups = (session.query(FollowUpSignal)
                                .filter_by(producer_id=producer_id, resolved=False)
                                .all())
            now = datetime.now(timezone.utc)

            return {
                "producer_id": producer_id,
                "last_contact_date": str(producer.last_contact_date) if producer.last_contact_date else None,
                "interaction_count": producer.interaction_count,
                "interaction_frequency": producer.interaction_frequency,
                "pending_follow_ups": [
                    {
                        "id": f.id,
                        "implied_action": f.implied_action,
                        "timeframe": f.timeframe,
                        "due_date": str(f.due_date) if f.due_date else None,
                        "overdue": f.due_date < now if f.due_date else False,
                    }
                    for f in pending_followups
                ],
                "state_label": state_label,
            }

    # --- Route-facing methods ---

    def _get_cold_threshold(self, session) -> int:
        """Read gone_cold_threshold_days from settings, default 90."""
        setting = session.query(ProducerSettings).filter_by(key="gone_cold_threshold_days").first()
        if setting and setting.value is not None:
            try:
                return int(setting.value)
            except (ValueError, TypeError):
                pass
        return 90

    def list_producers(self, search: str = "", state_filter: str = "",
                       tag_filter: str = "", sort: str = "name",
                       sort_dir: str = "asc", limit: int = 50, offset: int = 0) -> dict:
        """List producers with search, filter, sort, and pagination."""
        with self._session_factory() as session:
            cold_threshold = self._get_cold_threshold(session)
            query = session.query(Producer).options(
                joinedload(Producer.organizations).joinedload(ProducerOrganization.organization),
                joinedload(Producer.tags).joinedload(ProducerTag.tag),
            )

            if search:
                email_ids = (
                    session.query(EntityEmail.entity_id)
                    .filter(
                        EntityEmail.entity_type == "producer",
                        EntityEmail.email.ilike(f"%{search}%"),
                    )
                    .subquery()
                )
                query = query.filter(
                    or_(
                        Producer.first_name.ilike(f"%{search}%"),
                        Producer.last_name.ilike(f"%{search}%"),
                        Producer.id.in_(email_ids),
                    )
                )

            if tag_filter:
                query = (query.join(ProducerTag, isouter=False)
                         .join(Tag)
                         .filter(Tag.name == tag_filter))

            # Sort mapping
            sort_columns = {
                "name": (Producer.last_name, Producer.first_name),
                "updated": (Producer.updated_at,),
                "last_contact": (Producer.last_contact_date,),
                "city": (Producer.city,),
            }
            # Organization sort requires a subquery for the current org name
            if sort == "organization":
                from sqlalchemy import select
                org_subq = (
                    select(Organization.name)
                    .join(ProducerOrganization, ProducerOrganization.organization_id == Organization.id)
                    .where(
                        ProducerOrganization.producer_id == Producer.id,
                        ProducerOrganization.end_date.is_(None),
                    )
                    .correlate(Producer)
                    .limit(1)
                    .scalar_subquery()
                    .label("current_org_name")
                )
                sort_cols = (org_subq,)
            else:
                sort_cols = sort_columns.get(sort, (Producer.last_name, Producer.first_name))
            if sort_dir == "desc":
                order = [c.desc().nullslast() for c in sort_cols]
            else:
                order = [c.asc().nullsfirst() for c in sort_cols]

            # When filtering by state, we must compute state for all matching
            # producers first since state is derived, then paginate in Python.
            if state_filter:
                all_producers = query.order_by(*order).all()
                filtered = []
                for p in all_producers:
                    state = get_relationship_state_label(p, cold_threshold)
                    if state == state_filter:
                        summary = self._producer_summary(p, session)
                        summary["relationship_state"] = state
                        filtered.append(summary)
                total = len(filtered)
                return {"producers": filtered[offset:offset + limit], "total": total}

            total = query.count()
            producers = query.order_by(*order).offset(offset).limit(limit).all()

            results = []
            for p in producers:
                summary = self._producer_summary(p, session)
                summary["relationship_state"] = get_relationship_state_label(p, cold_threshold)
                results.append(summary)

            return {"producers": results, "total": total}

    def create_producer(self, data: dict, user_email: str) -> dict:
        """Create a new producer record."""
        with self._session_factory() as session:
            producer = Producer(
                first_name=data["first_name"],
                last_name=data["last_name"],
                phone=data.get("phone"),
                city=data.get("city"),
                state_region=data.get("state_region"),
                country=data.get("country"),
                website=data.get("website"),
                intake_source=data.get("intake_source", "manual"),
                intake_source_url=data.get("intake_source_url"),
            )
            session.add(producer)
            session.flush()

            # Handle email
            email = data.get("email")
            if email:
                session.add(EntityEmail(
                    entity_type="producer", entity_id=producer.id,
                    email=email, is_primary=True,
                ))

            # Handle social links
            for link in (data.get("social_links") or []):
                platform = session.query(SocialPlatform).filter_by(name=link.get("platform")).first()
                if platform:
                    session.add(EntitySocialLink(
                        entity_type="producer", entity_id=producer.id,
                        platform_id=platform.id, url=link.get("url", ""),
                    ))

            # Handle initial org affiliation
            org_name = data.get("organization")
            if org_name:
                org = session.query(Organization).filter_by(name=org_name).first()
                if not org:
                    org = Organization(name=org_name)
                    session.add(org)
                    session.flush()
                session.add(ProducerOrganization(
                    producer_id=producer.id,
                    organization_id=org.id,
                    role_title=data.get("org_role"),
                ))

            # Handle initial tags
            for tag_name in data.get("tags", []):
                tag = session.query(Tag).filter_by(name=tag_name).first()
                if not tag:
                    tag = Tag(name=tag_name)
                    session.add(tag)
                    session.flush()
                session.add(ProducerTag(producer_id=producer.id, tag_id=tag.id))

            # Log initial note as interaction if provided
            notes = data.get("notes")
            if notes:
                session.add(Interaction(
                    producer_id=producer.id,
                    content=notes,
                    author=user_email,
                    date=datetime.now(timezone.utc),
                ))

            _log_creation(session, producer.id, user_email)
            session.commit()

            return {"id": producer.id, "first_name": producer.first_name, "last_name": producer.last_name}

    def update_producer(self, producer_id: int, data: dict, user_email: str) -> dict:
        """Update producer fields. Tracks changes in history."""
        with self._session_factory() as session:
            producer = session.get(Producer, producer_id)
            if not producer:
                return {"error": "Producer not found"}

            editable_fields = [
                "first_name", "last_name", "phone", "city", "state_region", "country",
                "photo_url", "website",
                "birthdate", "pronouns", "nickname", "college",
                "hometown", "hometown_state", "hometown_country",
                "spouse_partner", "languages", "seasonal_location",
            ]

            for field in editable_fields:
                if field in data:
                    old_val = getattr(producer, field)
                    new_val = data[field]
                    if str(old_val) != str(new_val):
                        setattr(producer, field, new_val)
                        session.add(ChangeHistory(
                            entity_type="producer",
                            entity_id=producer_id,
                            field_name=field,
                            old_value=str(old_val) if old_val is not None else None,
                            new_value=str(new_val) if new_val is not None else None,
                            changed_by=user_email,
                        ))

            session.commit()
            return {"id": producer_id, "updated": True}

    def add_interaction(self, producer_id: int, content: str, author: str) -> dict:
        """Add an interaction and trigger all save-time processing."""
        with self._session_factory() as session:
            producer = session.get(Producer, producer_id)
            if not producer:
                return {"error": "Producer not found"}

            interaction = Interaction(
                producer_id=producer_id,
                content=content,
                author=author,
                date=datetime.now(timezone.utc),
            )
            session.add(interaction)
            session.flush()

            # Auto-resolve ALL pending follow-ups when a new interaction is logged.
            # Spec: "Follow-up signals auto-resolve when a new interaction is logged
            # with that producer."
            now = datetime.now(timezone.utc)
            pending = (session.query(FollowUpSignal)
                       .filter(
                           FollowUpSignal.producer_id == producer_id,
                           FollowUpSignal.resolved == False,
                       )
                       .all())
            for f in pending:
                f.resolved = True
                f.resolved_at = now

            # Recompute relationship state
            recompute_relationship_state(session, producer_id)

            session.commit()

            return {
                "id": interaction.id,
                "producer_id": producer_id,
                "date": str(interaction.date),
                "content": content,
                "author": author,
            }

    def add_tag(self, producer_id: int, tag_name: str, user_email: str = "system") -> dict:
        """Add a tag to a producer."""
        with self._session_factory() as session:
            tag = session.query(Tag).filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                session.add(tag)
                session.flush()

            existing = session.query(ProducerTag).filter_by(
                producer_id=producer_id, tag_id=tag.id
            ).first()
            if existing:
                return {"already_exists": True}

            session.add(ProducerTag(producer_id=producer_id, tag_id=tag.id))
            session.add(ChangeHistory(
                entity_type="producer", entity_id=producer_id,
                field_name="tag_added", old_value=None,
                new_value=tag_name, changed_by=user_email,
            ))
            session.commit()
            return {"tag": tag_name, "added": True}

    def remove_tag(self, producer_id: int, tag_name: str, user_email: str = "system") -> dict:
        """Remove a tag from a producer."""
        with self._session_factory() as session:
            tag = session.query(Tag).filter_by(name=tag_name).first()
            if not tag:
                return {"error": "Tag not found"}

            pt = session.query(ProducerTag).filter_by(
                producer_id=producer_id, tag_id=tag.id
            ).first()
            if pt:
                session.delete(pt)
                session.add(ChangeHistory(
                    entity_type="producer", entity_id=producer_id,
                    field_name="tag_removed", old_value=tag_name,
                    new_value=None, changed_by=user_email,
                ))
                session.commit()
            return {"tag": tag_name, "removed": True}

    def get_change_history(self, entity_type: str, entity_id: int,
                           limit: int = 50) -> list[dict]:
        """Get change history for an entity."""
        with self._session_factory() as session:
            changes = (session.query(ChangeHistory)
                       .filter_by(entity_type=entity_type, entity_id=entity_id)
                       .order_by(ChangeHistory.changed_at.desc())
                       .limit(limit)
                       .all())
            return [
                {
                    "id": c.id,
                    "field_name": c.field_name,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "changed_by": c.changed_by,
                    "changed_at": str(c.changed_at),
                }
                for c in changes
            ]

    def check_duplicates(self, first_name: str, last_name: str, email: str = "", organization: str = "") -> list[dict]:
        """Check for potential duplicate producers.

        Name + organization is the strongest non-email signal per spec.
        """
        with self._session_factory() as session:
            candidates = []

            # Exact email match
            if email:
                email_match = (
                    session.query(EntityEmail)
                    .filter(EntityEmail.entity_type == "producer", EntityEmail.email == email)
                    .first()
                )
                exact = session.get(Producer, email_match.entity_id) if email_match else None
                if exact:
                    candidates.append({
                        **self._producer_summary(exact),
                        "match_type": "exact_email",
                        "confidence": "definitive",
                    })
                    return candidates

            # Fuzzy name match
            query = session.query(Producer).options(
                joinedload(Producer.organizations).joinedload(ProducerOrganization.organization),
                joinedload(Producer.tags).joinedload(ProducerTag.tag),
            )
            if first_name and len(first_name) > 1:
                query = query.filter(Producer.first_name.ilike(f"%{first_name}%"))
            if last_name and len(last_name) > 1:
                query = query.filter(Producer.last_name.ilike(f"%{last_name}%"))
            if first_name or last_name:
                matches = query.limit(10).all()
                for m in matches:
                    # Name + org match is strongest non-email signal
                    match_type = "fuzzy_name"
                    confidence = "possible"
                    if organization:
                        current_orgs = [
                            po.organization.name.lower()
                            for po in (m.organizations or [])
                            if po.organization
                        ]
                        if any(organization.lower() in org for org in current_orgs):
                            match_type = "name_and_org"
                            confidence = "likely"

                    candidates.append({
                        **self._producer_summary(m),
                        "match_type": match_type,
                        "confidence": confidence,
                    })

            return candidates

    def get_dashboard_data(self) -> dict:
        """Get data for the dashboard view."""
        with self._session_factory() as session:
            now = datetime.now(timezone.utc)

            # Overdue follow-ups
            overdue_followups = (session.query(FollowUpSignal)
                                .filter(
                                    FollowUpSignal.resolved == False,
                                    FollowUpSignal.due_date < now,
                                )
                                .options(joinedload(FollowUpSignal.interaction))
                                .limit(20)
                                .all())

            overdue_list = []
            for f in overdue_followups:
                producer = session.get(Producer, f.producer_id)
                if producer:
                    overdue_list.append({
                        "producer_id": f.producer_id,
                        "first_name": producer.first_name,
                        "last_name": producer.last_name,
                        "implied_action": f.implied_action,
                        "due_date": str(f.due_date),
                        "days_overdue": (now - f.due_date).days,
                    })

            # Research in progress
            researching = (session.query(Producer)
                          .filter(Producer.research_status.in_(["pending", "in_progress"]))
                          .all())

            # Discovery candidates
            discovery_count = (session.query(DiscoveryCandidate)
                              .filter_by(status="pending")
                              .count())

            # Recent interactions (with producer names)
            recent_interactions = (session.query(Interaction)
                                  .options(joinedload(Interaction.producer))
                                  .order_by(Interaction.date.desc())
                                  .limit(10)
                                  .all())

            # Recent changes from AI refresh
            recent_changes = (session.query(ChangeHistory)
                             .filter(ChangeHistory.changed_by.in_(["AI research", "AI refresh"]))
                             .order_by(ChangeHistory.changed_at.desc())
                             .limit(10)
                             .all())

            # Total counts
            total_producers = session.query(Producer).count()

            # Enrich AI changes with producer names
            ai_changes_enriched = []
            for c in recent_changes:
                first_name = None
                last_name = None
                if c.entity_type == "producer":
                    p = session.get(Producer, c.entity_id)
                    if p:
                        first_name = p.first_name
                        last_name = p.last_name
                # Human-readable field label
                field_label = c.field_name.replace("_", " ").title()
                # Significant changes = news-worthy fields the team should notice
                significant_fields = {
                    "current_activity", "production_added", "organization_added",
                    "career_trajectory_summary", "relationship_summary",
                }
                is_significant = c.field_name in significant_fields
                ai_changes_enriched.append({
                    "entity_type": c.entity_type,
                    "entity_id": c.entity_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "field_name": c.field_name,
                    "field_label": field_label,
                    "new_value": c.new_value[:200] if c.new_value else None,
                    "old_value": c.old_value[:100] if c.old_value else None,
                    "changed_by": c.changed_by,
                    "changed_at": str(c.changed_at),
                    "significant": is_significant,
                })

            return {
                "overdue_followups": overdue_list,
                "researching": [
                    {"id": p.id, "first_name": p.first_name, "last_name": p.last_name, "status": p.research_status}
                    for p in researching
                ],
                "discovery_candidates_count": discovery_count,
                "recent_interactions": [
                    {
                        "id": i.id,
                        "producer_id": i.producer_id,
                        "first_name": i.producer.first_name if i.producer else None,
                        "last_name": i.producer.last_name if i.producer else None,
                        "date": str(i.date),
                        "content": i.content[:200],
                        "author": i.author,
                    }
                    for i in recent_interactions
                ],
                "recent_ai_changes": ai_changes_enriched,
                "total_producers": total_producers,
            }

    def get_discovery_candidates(self, status: str = "pending") -> list[dict]:
        """Get AI discovery candidates with enriched data."""
        with self._session_factory() as session:
            candidates = (session.query(DiscoveryCandidate)
                         .filter_by(status=status)
                         .order_by(DiscoveryCandidate.created_at.desc())
                         .all())
            return [
                {
                    "id": c.id,
                    "scan_id": c.scan_id,
                    "first_name": c.first_name,
                    "last_name": c.last_name,
                    "reasoning": c.reasoning,
                    "source": c.source,
                    "raw_data": c.raw_data,
                    "status": c.status,
                    "dedup_status": c.dedup_status,
                    "dedup_matches": c.dedup_matches,
                    "created_at": str(c.created_at),
                }
                for c in candidates
            ]

    def create_discovery_candidate(self, first_name: str, last_name: str,
                                    reasoning: str, source: str = None,
                                    scan_id: int = None) -> dict:
        """Create a discovery candidate for team review."""
        with self._session_factory() as session:
            candidate = DiscoveryCandidate(
                first_name=first_name,
                last_name=last_name,
                reasoning=reasoning,
                source=source,
                scan_id=scan_id,
                status="pending",
            )
            session.add(candidate)
            session.commit()
            return {"id": candidate.id, "first_name": first_name, "last_name": last_name}

    def review_discovery(self, candidate_id: int, action: str,
                         user_email: str, reason: str = None,
                         edited_data: dict = None) -> dict:
        """Confirm or dismiss a discovery candidate.

        When confirming, edited_data can override raw_data fields.
        The producer is created with the curated data.
        """
        with self._session_factory() as session:
            candidate = session.get(DiscoveryCandidate, candidate_id)
            if not candidate:
                return {"error": "Candidate not found"}

            candidate.status = action  # "confirmed" or "dismissed"
            candidate.reviewed_at = datetime.now(timezone.utc)
            candidate.reviewed_by = user_email
            if action == "dismissed" and reason:
                candidate.dismissed_reason = reason

            result = {"id": candidate_id, "status": action}

            if action == "confirmed":
                # Merge raw_data with any user edits
                data = dict(candidate.raw_data or {})
                if edited_data:
                    data.update(edited_data)

                # Use edited name if provided, else original
                first_name = data.pop("first_name", candidate.first_name)
                last_name = data.pop("last_name", candidate.last_name)

                # Build producer with all available data
                producer = Producer(
                    first_name=first_name,
                    last_name=last_name,
                    intake_source="ai_discovery",
                    intake_ai_reasoning=candidate.reasoning,
                    city=data.get("city"),
                    state_region=data.get("state_region"),
                    country=data.get("country"),
                    website=data.get("website"),
                )

                session.add(producer)
                session.flush()

                # Handle social links
                for link in (data.get("social_links") or []):
                    platform = session.query(SocialPlatform).filter_by(name=link.get("platform")).first()
                    if platform:
                        session.add(EntitySocialLink(
                            entity_type="producer", entity_id=producer.id,
                            platform_id=platform.id, url=link.get("url", ""),
                        ))

                # Handle email candidates
                email_candidates = data.get("email_candidates")
                if email_candidates:
                    high = next((c for c in email_candidates if c.get("confidence") == "high"), None)
                    primary_email = high["email"] if high else email_candidates[0].get("email")
                    for ec in email_candidates:
                        session.add(EntityEmail(
                            entity_type="producer", entity_id=producer.id,
                            email=ec["email"],
                            source=ec.get("source"),
                            confidence=ec.get("confidence"),
                            is_primary=(ec["email"] == primary_email),
                        ))

                # Create organization affiliation if provided
                org_name = data.get("organization")
                if org_name:
                    org = session.query(Organization).filter(
                        Organization.name.ilike(org_name)
                    ).first()
                    if not org:
                        org = Organization(name=org_name)
                        session.add(org)
                        session.flush()
                    session.add(ProducerOrganization(
                        producer_id=producer.id,
                        organization_id=org.id,
                        role_title=data.get("organization_role"),
                    ))

                result["producer_id"] = producer.id

            session.commit()
            return result

    # --- Discovery scan history and focus areas ---

    def get_scan_history(self, limit: int = 25, offset: int = 0) -> dict:
        """Get paginated discovery scan history."""
        with self._session_factory() as session:
            total = session.query(DiscoveryScan).count()
            scans = (session.query(DiscoveryScan)
                     .options(joinedload(DiscoveryScan.focus_type))
                     .order_by(DiscoveryScan.started_at.desc())
                     .offset(offset)
                     .limit(limit)
                     .all())
            results = []
            for s in scans:
                confirmed = dismissed = pending = 0
                if s.candidates:
                    for c in s.candidates:
                        if c.status == "confirmed":
                            confirmed += 1
                        elif c.status == "dismissed":
                            dismissed += 1
                        elif c.status == "pending":
                            pending += 1

                results.append({
                    "id": s.id,
                    "focus_area": s.focus_area,
                    "focus_type": self._lookup_dict(s.focus_type),
                    "started_at": str(s.started_at) if s.started_at else None,
                    "completed_at": str(s.completed_at) if s.completed_at else None,
                    "status": s.status,
                    "candidates_found": s.candidates_found,
                    "candidates_after_dedup": s.candidates_after_dedup,
                    "confirmed": confirmed,
                    "dismissed": dismissed,
                    "pending": pending,
                    "error_detail": s.error_detail,
                })
            return {"scans": results, "total": total}

    def get_scan_detail(self, scan_id: int) -> dict | None:
        """Get a scan with its candidates."""
        with self._session_factory() as session:
            scan = session.query(DiscoveryScan).options(
                joinedload(DiscoveryScan.focus_type)
            ).filter_by(id=scan_id).first()
            if not scan:
                return None
            return {
                "id": scan.id,
                "focus_area": scan.focus_area,
                "focus_type": self._lookup_dict(scan.focus_type),
                "started_at": str(scan.started_at) if scan.started_at else None,
                "completed_at": str(scan.completed_at) if scan.completed_at else None,
                "status": scan.status,
                "candidates_found": scan.candidates_found,
                "candidates_after_dedup": scan.candidates_after_dedup,
                "intelligence_profile_snapshot": scan.intelligence_profile_snapshot,
                "calibration_snapshot": scan.calibration_snapshot,
                "error_detail": scan.error_detail,
                "candidates": [
                    {
                        "id": c.id,
                        "first_name": c.first_name,
                        "last_name": c.last_name,
                        "reasoning": c.reasoning,
                        "source": c.source,
                        "raw_data": c.raw_data,
                        "status": c.status,
                        "dedup_status": c.dedup_status,
                        "dedup_matches": c.dedup_matches,
                        "created_at": str(c.created_at),
                    }
                    for c in (scan.candidates or [])
                ],
            }

    def get_focus_areas(self) -> list[dict]:
        """Get all discovery focus areas."""
        with self._session_factory() as session:
            areas = (session.query(DiscoveryFocusArea)
                     .order_by(DiscoveryFocusArea.sort_order)
                     .all())
            return [
                {
                    "id": a.id,
                    "name": a.name,
                    "description": a.description,
                    "active": a.active,
                    "last_used_at": str(a.last_used_at) if a.last_used_at else None,
                    "sort_order": a.sort_order,
                }
                for a in areas
            ]

    def create_focus_area(self, name: str, description: str = None) -> dict:
        """Create a new discovery focus area."""
        with self._session_factory() as session:
            area = DiscoveryFocusArea(name=name, description=description)
            session.add(area)
            session.commit()
            return {"id": area.id, "name": area.name}

    def update_focus_area(self, focus_id: int, data: dict) -> dict:
        """Update a focus area."""
        with self._session_factory() as session:
            area = session.get(DiscoveryFocusArea, focus_id)
            if not area:
                return {"error": "Focus area not found"}
            for field in ("name", "description", "active", "sort_order"):
                if field in data:
                    setattr(area, field, data[field])
            session.commit()
            return {"id": area.id, "updated": True}

    def delete_focus_area(self, focus_id: int) -> dict:
        """Delete a focus area."""
        with self._session_factory() as session:
            area = session.get(DiscoveryFocusArea, focus_id)
            if not area:
                return {"error": "Focus area not found"}
            session.delete(area)
            session.commit()
            return {"deleted": True}

    def get_intelligence_profile(self) -> dict | None:
        """Get the latest intelligence profile."""
        with self._session_factory() as session:
            profile = (session.query(IntelligenceProfile)
                       .order_by(IntelligenceProfile.generated_at.desc())
                       .first())
            if not profile:
                return None
            return {
                "id": profile.id,
                "profile_text": profile.profile_text,
                "producer_count": profile.producer_count,
                "generated_at": str(profile.generated_at),
            }

    def get_calibration_summary(self) -> dict | None:
        """Get the latest calibration summary."""
        with self._session_factory() as session:
            cal = (session.query(DiscoveryCalibration)
                   .order_by(DiscoveryCalibration.generated_at.desc())
                   .first())
            if not cal:
                return None
            return {
                "id": cal.id,
                "calibration_text": cal.calibration_text,
                "dismissal_count": cal.dismissal_count,
                "generated_at": str(cal.generated_at),
            }

    def get_settings(self) -> dict:
        """Get all producer settings."""
        with self._session_factory() as session:
            settings = session.query(ProducerSettings).all()
            return {s.key: s.value for s in settings}

    def update_setting(self, key: str, value) -> dict:
        """Update a producer setting."""
        with self._session_factory() as session:
            setting = session.query(ProducerSettings).filter_by(key=key).first()
            if setting:
                setting.value = value
            else:
                session.add(ProducerSettings(key=key, value=value))
            session.commit()
            return {"key": key, "updated": True}

    def create_tag(self, name: str, description: str = None) -> dict:
        """Create a standalone tag."""
        with self._session_factory() as session:
            existing = session.query(Tag).filter_by(name=name).first()
            if existing:
                return {"error": "Tag already exists", "id": existing.id}
            tag = Tag(name=name, description=description)
            session.add(tag)
            session.commit()
            return {"id": tag.id, "name": tag.name, "description": tag.description}

    def get_tags(self) -> list[dict]:
        """Get all tags with usage counts."""
        with self._session_factory() as session:
            tags = session.query(Tag).all()
            result = []
            for tag in tags:
                count = session.query(ProducerTag).filter_by(tag_id=tag.id).count()
                result.append({"id": tag.id, "name": tag.name, "description": tag.description, "count": count})
            return sorted(result, key=lambda x: x["count"], reverse=True)

    def get_tag(self, tag_id: int, search: str = "", sort: str = "name",
                sort_dir: str = "asc", limit: int = 25, offset: int = 0) -> dict:
        """Get a single tag with its producers (paginated)."""
        with self._session_factory() as session:
            tag = session.get(Tag, tag_id)
            if not tag:
                return {"error": "Tag not found"}

            cold_threshold = self._get_cold_threshold(session)

            query = (session.query(Producer)
                     .join(ProducerTag, ProducerTag.producer_id == Producer.id)
                     .filter(ProducerTag.tag_id == tag_id)
                     .options(
                         joinedload(Producer.organizations).joinedload(ProducerOrganization.organization),
                         joinedload(Producer.tags).joinedload(ProducerTag.tag),
                     ))

            if search:
                tag_email_ids = (
                    session.query(EntityEmail.entity_id)
                    .filter(
                        EntityEmail.entity_type == "producer",
                        EntityEmail.email.ilike(f"%{search}%"),
                    )
                    .subquery()
                )
                query = query.filter(
                    or_(
                        Producer.first_name.ilike(f"%{search}%"),
                        Producer.last_name.ilike(f"%{search}%"),
                        Producer.id.in_(tag_email_ids),
                    )
                )

            sort_columns = {
                "name": (Producer.last_name, Producer.first_name),
                "updated": (Producer.updated_at,),
                "last_contact": (Producer.last_contact_date,),
                "city": (Producer.city,),
            }
            sort_cols = sort_columns.get(sort, (Producer.last_name, Producer.first_name))
            if sort_dir == "desc":
                order = [c.desc().nullslast() for c in sort_cols]
            else:
                order = [c.asc().nullsfirst() for c in sort_cols]

            total = query.count()
            producers = query.order_by(*order).offset(offset).limit(limit).all()

            results = []
            for p in producers:
                summary = self._producer_summary(p, session)
                summary["relationship_state"] = get_relationship_state_label(p, cold_threshold)
                results.append(summary)

            return {
                "id": tag.id,
                "name": tag.name,
                "description": tag.description,
                "created_at": str(tag.created_at) if tag.created_at else None,
                "producers": results,
                "total": total,
            }

    def update_tag(self, tag_id: int, data: dict) -> dict:
        """Update a tag's name and/or description."""
        with self._session_factory() as session:
            tag = session.get(Tag, tag_id)
            if not tag:
                return {"error": "Tag not found"}
            if "name" in data:
                tag.name = data["name"]
            if "description" in data:
                tag.description = data["description"]
            session.commit()
            return {"id": tag.id, "name": tag.name, "description": tag.description}

    def delete_tag(self, tag_id: int) -> dict:
        """Delete a tag and all its associations."""
        with self._session_factory() as session:
            session.query(ProducerTag).filter_by(tag_id=tag_id).delete()
            session.query(Tag).filter_by(id=tag_id).delete()
            session.commit()
            return {"deleted": True}

    def get_research_sources(self) -> list[dict]:
        """Get managed research sources."""
        with self._session_factory() as session:
            sources = (session.query(ResearchSource)
                       .order_by(ResearchSource.sort_order)
                       .all())
            return [
                {"id": s.id, "name": s.name, "url": s.url,
                 "description": s.description, "sort_order": s.sort_order,
                 "created_at": str(s.created_at) if s.created_at else None}
                for s in sources
            ]

    def get_research_source(self, source_id: int) -> dict:
        """Get a single research source."""
        with self._session_factory() as session:
            s = session.get(ResearchSource, source_id)
            if not s:
                return {"error": "Source not found"}
            return {
                "id": s.id, "name": s.name, "url": s.url,
                "description": s.description, "sort_order": s.sort_order,
                "created_at": str(s.created_at) if s.created_at else None,
            }

    def create_research_source(self, name: str, url: str = "",
                                description: str = None) -> dict:
        """Create a research source."""
        with self._session_factory() as session:
            max_order = session.query(ResearchSource.sort_order).order_by(
                ResearchSource.sort_order.desc()
            ).first()
            order = (max_order[0] + 1) if max_order else 0
            source = ResearchSource(name=name, url=url, description=description,
                                     sort_order=order)
            session.add(source)
            session.commit()
            return {"id": source.id, "name": name, "description": description}

    def update_research_source(self, source_id: int, data: dict) -> dict:
        """Update a research source."""
        with self._session_factory() as session:
            source = session.get(ResearchSource, source_id)
            if not source:
                return {"error": "Source not found"}
            if "name" in data:
                source.name = data["name"]
            if "url" in data:
                source.url = data["url"]
            if "description" in data:
                source.description = data["description"]
            session.commit()
            return {"id": source.id, "name": source.name, "url": source.url,
                    "description": source.description}

    def reorder_research_sources(self, source_ids: list[int]) -> dict:
        """Reorder research sources by providing IDs in desired order."""
        with self._session_factory() as session:
            for i, sid in enumerate(source_ids):
                source = session.get(ResearchSource, sid)
                if source:
                    source.sort_order = i
            session.commit()
            return {"reordered": True}

    def delete_research_source(self, source_id: int) -> dict:
        """Delete a research source."""
        with self._session_factory() as session:
            session.query(ResearchSource).filter_by(id=source_id).delete()
            session.commit()
            return {"deleted": True}

    def import_spreadsheet(self, rows: list[dict], user_email: str) -> dict:
        """Import producers from spreadsheet data."""
        created = []
        duplicates = []
        for row in rows:
            first_name = row.get("first_name", "").strip()
            last_name = row.get("last_name", "").strip()
            if not first_name or not last_name:
                continue
            dupes = self.check_duplicates(first_name, last_name, row.get("email", ""))
            if dupes:
                duplicates.append({"row": row, "duplicates": dupes})
                continue
            result = self.create_producer(row, user_email)
            created.append(result)
        return {"created": created, "duplicates": duplicates, "total": len(rows)}

    def merge_import_row(self, producer_id: int, import_data: dict,
                         resolved_fields: dict, user_email: str) -> dict:
        """Merge import data into an existing producer record.

        Fills empty scalar fields, adds new emails and org associations.
        resolved_fields contains user choices for conflicts (field -> chosen value).
        """
        with self._session_factory() as session:
            producer = session.get(Producer, producer_id)
            if not producer:
                return {"error": "Producer not found"}

            # Scalar fields — fill empty or apply user-resolved conflicts
            scalar_fields = ["phone", "city", "state_region", "country", "website"]
            for field in scalar_fields:
                import_val = import_data.get(field)
                if not import_val:
                    continue
                existing_val = getattr(producer, field)
                # Use resolved value if user picked one, otherwise fill empty
                if field in resolved_fields:
                    new_val = resolved_fields[field]
                    if new_val != existing_val:
                        from producers.backend.ai import _log_change
                        _log_change(session, "producer", producer_id, field,
                                    existing_val, new_val, user_email)
                        setattr(producer, field, new_val)
                elif not existing_val:
                    from producers.backend.ai import _log_change
                    _log_change(session, "producer", producer_id, field,
                                None, import_val, user_email)
                    setattr(producer, field, import_val)

            # Email — add if not already on this producer
            email = import_data.get("email")
            if email:
                existing_email = (
                    session.query(EntityEmail)
                    .filter_by(entity_type="producer", entity_id=producer_id, email=email)
                    .first()
                )
                if not existing_email:
                    session.add(EntityEmail(
                        entity_type="producer", entity_id=producer_id,
                        email=email, source="import", is_primary=False,
                    ))

            # Organization — add association if not already linked
            org_data = import_data.get("organization")
            if org_data and isinstance(org_data, dict):
                org_id = org_data.get("existing_org_id")
                if not org_id and org_data.get("create_new"):
                    org = Organization(name=org_data["name"])
                    session.add(org)
                    session.flush()
                    org_id = org.id
                if org_id:
                    existing_link = (
                        session.query(ProducerOrganization)
                        .filter_by(producer_id=producer_id, organization_id=org_id)
                        .first()
                    )
                    if not existing_link:
                        session.add(ProducerOrganization(
                            producer_id=producer_id,
                            organization_id=org_id,
                            role_title=org_data.get("role_title"),
                        ))

            session.commit()
            return {"id": producer_id, "merged": True}

    # --- Producer delete ---

    def delete_producer(self, producer_id: int) -> dict:
        """Delete a producer and all related data."""
        with self._session_factory() as session:
            producer = session.get(Producer, producer_id)
            if not producer:
                return {"error": "Producer not found"}
            session.delete(producer)
            session.commit()
            return {"deleted": True, "id": producer_id}

    # --- Social Platforms ---

    def list_social_platforms(self) -> list[dict]:
        with self._session_factory() as session:
            platforms = session.query(SocialPlatform).order_by(SocialPlatform.sort_order, SocialPlatform.name).all()
            results = []
            for p in platforms:
                prod_count = (session.query(EntitySocialLink)
                              .filter_by(platform_id=p.id, entity_type="producer").count())
                org_count = (session.query(EntitySocialLink)
                             .filter_by(platform_id=p.id, entity_type="organization").count())
                results.append({
                    "id": p.id, "name": p.name, "base_url": p.base_url,
                    "icon_svg": p.icon_svg, "description": p.description,
                    "sort_order": p.sort_order,
                    "producer_count": prod_count, "organization_count": org_count,
                })
            return results

    def get_social_platform(self, platform_id: int) -> dict:
        with self._session_factory() as session:
            platform = session.get(SocialPlatform, platform_id)
            if not platform:
                return {"error": "Platform not found"}

            # Find all producers with this platform
            producer_links = (session.query(EntitySocialLink)
                              .filter_by(platform_id=platform_id, entity_type="producer")
                              .all())
            producers_with = []
            for link in producer_links:
                p = session.get(Producer, link.entity_id)
                if p:
                    producers_with.append({
                        "id": p.id, "first_name": p.first_name,
                        "last_name": p.last_name, "url": link.url,
                    })

            # Find all organizations with this platform
            org_links = (session.query(EntitySocialLink)
                         .filter_by(platform_id=platform_id, entity_type="organization")
                         .all())
            orgs_with = []
            for link in org_links:
                o = session.get(Organization, link.entity_id)
                if o:
                    orgs_with.append({"id": o.id, "name": o.name, "url": link.url})

            return {
                "id": platform.id, "name": platform.name, "base_url": platform.base_url,
                "icon_svg": platform.icon_svg, "description": platform.description,
                "sort_order": platform.sort_order,
                "producers": producers_with, "organizations": orgs_with,
            }

    def create_social_platform(self, data: dict) -> dict:
        with self._session_factory() as session:
            platform = SocialPlatform(
                name=data["name"],
                base_url=data.get("base_url"),
                icon_svg=data.get("icon_svg"),
                description=data.get("description"),
            )
            session.add(platform)
            session.commit()
            return {"id": platform.id, "name": platform.name, "base_url": platform.base_url, "description": platform.description}

    def update_social_platform(self, platform_id: int, data: dict) -> dict:
        with self._session_factory() as session:
            platform = session.get(SocialPlatform, platform_id)
            if not platform:
                return {"error": "Platform not found"}
            for field in ("name", "base_url", "icon_svg", "description"):
                if field in data:
                    setattr(platform, field, data[field])
            session.commit()
            return {"id": platform.id, "name": platform.name, "base_url": platform.base_url}

    def delete_social_platform(self, platform_id: int) -> dict:
        with self._session_factory() as session:
            platform = session.get(SocialPlatform, platform_id)
            if not platform:
                return {"error": "Platform not found"}

            in_use = session.query(EntitySocialLink).filter_by(platform_id=platform_id).count() > 0
            if in_use:
                return {"error": "Platform is in use and cannot be deleted"}

            session.delete(platform)
            session.commit()
            return {"deleted": True}

    def add_social_link(self, entity_type: str, entity_id: int, platform_id: int, url: str) -> dict:
        """Add a social link for an entity."""
        with self._session_factory() as session:
            existing = (session.query(EntitySocialLink)
                        .filter_by(entity_type=entity_type, entity_id=entity_id, platform_id=platform_id)
                        .first())
            if existing:
                return {"error": "Entity already has this platform link"}
            session.add(EntitySocialLink(
                entity_type=entity_type, entity_id=entity_id,
                platform_id=platform_id, url=url,
            ))
            session.commit()
            return {"added": True}

    def remove_social_link(self, entity_type: str, entity_id: int, platform_id: int) -> dict:
        """Remove a social link from an entity."""
        with self._session_factory() as session:
            link = (session.query(EntitySocialLink)
                    .filter_by(entity_type=entity_type, entity_id=entity_id, platform_id=platform_id)
                    .first())
            if not link:
                return {"error": "Link not found"}
            session.delete(link)
            session.commit()
            return {"removed": True}

    def update_social_link(self, entity_type: str, entity_id: int, platform_id: int, url: str) -> dict:
        """Update a social link URL."""
        with self._session_factory() as session:
            link = (session.query(EntitySocialLink)
                    .filter_by(entity_type=entity_type, entity_id=entity_id, platform_id=platform_id)
                    .first())
            if not link:
                return {"error": "Link not found"}
            link.url = url
            session.commit()
            return {"updated": True}

    # --- Organization CRUD ---

    def list_organizations(self, search: str = "", limit: int = 50, offset: int = 0) -> dict:
        """List all organizations with optional search."""
        with self._session_factory() as session:
            query = session.query(Organization).options(
                joinedload(Organization.org_type),
            )
            if search:
                query = query.filter(Organization.name.ilike(f"%{search}%"))
            total = query.count()
            orgs = query.order_by(Organization.name).offset(offset).limit(limit).all()
            results = []
            for o in orgs:
                producer_count = session.query(ProducerOrganization).filter_by(organization_id=o.id).count()
                results.append({
                    "id": o.id, "name": o.name, "org_type": self._lookup_dict(o.org_type),
                    "website": o.website,
                    "city": o.city, "state_region": o.state_region, "country": o.country,
                    "description": o.description, "producer_count": producer_count,
                })
            return {"organizations": results, "total": total}

    def get_organization(self, org_id: int) -> dict:
        """Get a single organization with its producers."""
        with self._session_factory() as session:
            org = session.query(Organization).options(
                joinedload(Organization.org_type),
                joinedload(Organization.producers).joinedload(ProducerOrganization.producer),
            ).filter_by(id=org_id).first()
            if not org:
                return {"error": "Organization not found"}
            social_links = self._get_social_links(session, "organization", org_id)
            emails = self._get_emails(session, "organization", org_id)
            return {
                "id": org.id, "name": org.name, "org_type": self._lookup_dict(org.org_type),
                "website": org.website,
                "city": org.city, "state_region": org.state_region, "country": org.country,
                "description": org.description,
                "social_links": social_links,
                "emails": emails,
                "created_at": str(org.created_at) if org.created_at else None,
                "producers": [
                    {
                        "affiliation_id": po.id,
                        "producer_id": po.producer.id,
                        "first_name": po.producer.first_name,
                        "last_name": po.producer.last_name,
                        "role_title": po.role_title,
                        "start_date": str(po.start_date) if po.start_date else None,
                        "end_date": str(po.end_date) if po.end_date else None,
                        "relationship_state": get_relationship_state_label(po.producer),
                        "last_contact_date": str(po.producer.last_contact_date) if po.producer.last_contact_date else None,
                    }
                    for po in org.producers if po.producer
                ],
            }

    def resolve_or_create_organization(self, name: str, user_email: str) -> int:
        """Find an organization by name, or create it. Returns the org ID."""
        with self._session_factory() as session:
            org = session.query(Organization).filter_by(name=name).first()
            if org:
                return org.id
            org = Organization(name=name)
            session.add(org)
            session.commit()
            return org.id

    def create_organization(self, data: dict) -> dict:
        """Create a new organization."""
        with self._session_factory() as session:
            org = Organization(
                name=data["name"],
                org_type_id=data.get("org_type_id"),
                website=data.get("website"),
                city=data.get("city"),
                state_region=data.get("state_region"),
                country=data.get("country"),
                description=data.get("description"),
            )
            session.add(org)
            session.flush()

            # Handle social links
            for link in (data.get("social_links") or []):
                platform = session.query(SocialPlatform).filter_by(name=link.get("platform")).first()
                if platform:
                    session.add(EntitySocialLink(
                        entity_type="organization", entity_id=org.id,
                        platform_id=platform.id, url=link.get("url", ""),
                    ))

            session.commit()
            return {"id": org.id, "name": org.name}

    def update_organization(self, org_id: int, data: dict, user_email: str) -> dict:
        """Update an organization's details."""
        with self._session_factory() as session:
            org = session.get(Organization, org_id)
            if not org:
                return {"error": "Organization not found"}
            for field in ["name", "org_type_id", "website", "city", "state_region", "country", "description"]:
                if field in data:
                    old_val = getattr(org, field)
                    new_val = data[field]
                    if str(old_val) != str(new_val):
                        setattr(org, field, new_val)
                        session.add(ChangeHistory(
                            entity_type="organization", entity_id=org_id,
                            field_name=field,
                            old_value=str(old_val) if old_val is not None else None,
                            new_value=str(new_val) if new_val is not None else None,
                            changed_by=user_email,
                        ))
            session.commit()
            return {"id": org_id, "updated": True}

    def delete_organization(self, org_id: int) -> dict:
        """Delete an organization and all affiliations."""
        with self._session_factory() as session:
            session.query(ProducerOrganization).filter_by(organization_id=org_id).delete()
            session.query(Organization).filter_by(id=org_id).delete()
            session.commit()
            return {"deleted": True}

    def add_producer_affiliation(self, producer_id: int, org_id: int,
                                  data: dict, user_email: str) -> dict:
        """Add an organization affiliation for a producer."""
        with self._session_factory() as session:
            from datetime import date as date_type
            affiliation = ProducerOrganization(
                producer_id=producer_id,
                organization_id=org_id,
                role_title=data.get("role_title"),
                start_date=data.get("start_date"),
                end_date=data.get("end_date"),
                notes=data.get("notes"),
            )
            session.add(affiliation)
            org = session.get(Organization, org_id)
            org_name = org.name if org else str(org_id)
            session.add(ChangeHistory(
                entity_type="producer", entity_id=producer_id,
                field_name="organization_added", old_value=None,
                new_value=org_name, changed_by=user_email,
            ))
            session.commit()
            return {"id": affiliation.id, "created": True}

    def update_producer_affiliation(self, affiliation_id: int, data: dict,
                                     user_email: str) -> dict:
        """Update an organization affiliation (role, dates, notes)."""
        with self._session_factory() as session:
            aff = session.get(ProducerOrganization, affiliation_id)
            if not aff:
                return {"error": "Affiliation not found"}
            for field in ["role_title", "start_date", "end_date", "notes"]:
                if field in data:
                    setattr(aff, field, data[field])
            session.commit()
            return {"id": affiliation_id, "updated": True}

    def remove_producer_affiliation(self, affiliation_id: int, user_email: str) -> dict:
        """Remove an organization affiliation from a producer."""
        with self._session_factory() as session:
            aff = session.get(ProducerOrganization, affiliation_id)
            if not aff:
                return {"error": "Affiliation not found"}
            org = session.get(Organization, aff.organization_id)
            org_name = org.name if org else str(aff.organization_id)
            session.add(ChangeHistory(
                entity_type="producer", entity_id=aff.producer_id,
                field_name="organization_removed", old_value=org_name,
                new_value=None, changed_by=user_email,
            ))
            session.delete(aff)
            session.commit()
            return {"deleted": True}

    # --- Production CRUD ---

    def list_all_productions(self, search: str = "", limit: int = 50,
                              offset: int = 0) -> dict:
        """List all productions with optional search."""
        with self._session_factory() as session:
            query = session.query(Production).options(
                joinedload(Production.scale),
                joinedload(Production.show).joinedload(Show.medium),
                joinedload(Production.venue).joinedload(Venue.venue_type),
                joinedload(Production.producers).joinedload(ProducerProduction.producer),
                joinedload(Production.producers).joinedload(ProducerProduction.role),
            )
            if search:
                query = query.join(Production.show).filter(Show.title.ilike(f"%{search}%"))
            total = query.count()
            prods = query.order_by(Production.year.desc().nullslast()).offset(offset).limit(limit).all()
            return {
                "productions": [self._production_detail(p) for p in prods],
                "total": total,
            }

    def get_production(self, production_id: int) -> dict:
        """Get a single production with full details."""
        with self._session_factory() as session:
            prod = session.query(Production).options(
                joinedload(Production.scale),
                joinedload(Production.show).joinedload(Show.medium),
                joinedload(Production.venue).joinedload(Venue.venue_type),
                joinedload(Production.producers).joinedload(ProducerProduction.producer),
                joinedload(Production.producers).joinedload(ProducerProduction.role),
            ).filter_by(id=production_id).first()
            if not prod:
                return {"error": "Production not found"}
            return self._production_detail(prod)

    def create_production(self, data: dict, user_email: str) -> dict:
        """Create a new production."""
        with self._session_factory() as session:
            # Handle venue — look up or create
            venue_id = data.get("venue_id")
            venue_name = data.get("venue_name")
            if venue_name and not venue_id:
                venue = session.query(Venue).filter_by(name=venue_name).first()
                if not venue:
                    venue = Venue(name=venue_name, venue_type_id=data.get("venue_type_id"))
                    session.add(venue)
                    session.flush()
                venue_id = venue.id

            prod = Production(
                show_id=data["show_id"],
                venue_id=venue_id,
                year=data.get("year"),
                start_date=data.get("start_date"),
                end_date=data.get("end_date"),
                scale_id=data.get("scale_id"),
                run_length=data.get("run_length"),
                description=data.get("description"),
                production_type_id=data.get("production_type_id"),
                capitalization=data.get("capitalization"),
                budget_tier_id=data.get("budget_tier_id"),
                recouped=data.get("recouped"),
                funding_type_id=data.get("funding_type_id"),
            )
            session.add(prod)
            session.flush()

            # Optionally link a producer
            producer_id = data.get("producer_id")
            show = session.get(Show, data["show_id"])
            show_title = show.title if show else str(data["show_id"])
            if producer_id:
                session.add(ProducerProduction(
                    producer_id=producer_id,
                    production_id=prod.id,
                    role_id=data.get("producer_role_id"),
                ))
                session.add(ChangeHistory(
                    entity_type="producer", entity_id=producer_id,
                    field_name="production_added", old_value=None,
                    new_value=show_title, changed_by=user_email,
                ))

            session.commit()
            return {"id": prod.id, "title": show_title}

    def update_production(self, production_id: int, data: dict, user_email: str) -> dict:
        """Update a production's details."""
        with self._session_factory() as session:
            prod = session.get(Production, production_id)
            if not prod:
                return {"error": "Production not found"}
            for field in ["venue_id", "year", "start_date", "end_date",
                          "scale_id", "run_length", "description",
                          "production_type_id", "capitalization", "budget_tier_id", "recouped", "funding_type_id"]:
                if field in data:
                    old_val = getattr(prod, field)
                    new_val = data[field]
                    if str(old_val) != str(new_val):
                        setattr(prod, field, new_val)
            session.commit()
            return {"id": production_id, "updated": True}

    def delete_production(self, production_id: int) -> dict:
        """Delete a production and all related data."""
        with self._session_factory() as session:
            session.query(ProducerProduction).filter_by(production_id=production_id).delete()
            session.query(Production).filter_by(id=production_id).delete()
            session.commit()
            return {"deleted": True}

    def add_producer_to_production(self, production_id: int, producer_id: int,
                                    role_id: int, user_email: str) -> dict:
        """Link a producer to a production with a credit role."""
        with self._session_factory() as session:
            existing = session.query(ProducerProduction).filter_by(
                producer_id=producer_id, production_id=production_id
            ).first()
            if existing:
                return {"error": "Producer already linked to this production"}
            link = ProducerProduction(
                producer_id=producer_id, production_id=production_id, role_id=role_id
            )
            session.add(link)
            prod = session.query(Production).options(
                joinedload(Production.show)
            ).filter_by(id=production_id).first()
            title = prod.show.title if prod and prod.show else str(production_id)
            session.add(ChangeHistory(
                entity_type="producer", entity_id=producer_id,
                field_name="production_added", old_value=None,
                new_value=title,
                changed_by=user_email,
            ))
            session.commit()
            return {"id": link.id, "created": True}

    def update_producer_production_role(self, link_id: int, role_id: int) -> dict:
        """Update a producer's credit role on a production."""
        with self._session_factory() as session:
            link = session.get(ProducerProduction, link_id)
            if not link:
                return {"error": "Link not found"}
            link.role_id = role_id
            session.commit()
            return {"id": link_id, "updated": True}

    def remove_producer_from_production(self, link_id: int, user_email: str) -> dict:
        """Remove a producer from a production."""
        with self._session_factory() as session:
            link = session.get(ProducerProduction, link_id)
            if not link:
                return {"error": "Link not found"}
            prod = session.query(Production).options(
                joinedload(Production.show)
            ).filter_by(id=link.production_id).first()
            title = prod.show.title if prod and prod.show else str(link.production_id)
            session.add(ChangeHistory(
                entity_type="producer", entity_id=link.producer_id,
                field_name="production_removed",
                old_value=title,
                new_value=None, changed_by=user_email,
            ))
            session.delete(link)
            session.commit()
            return {"deleted": True}

    # --- Show CRUD ---

    def list_shows(self, search: str = "", limit: int = 50, offset: int = 0) -> dict:
        """List all shows with optional search."""
        with self._session_factory() as session:
            query = session.query(Show).options(
                joinedload(Show.medium),
            )
            if search:
                query = query.filter(Show.title.ilike(f"%{search}%"))
            total = query.count()
            shows = query.order_by(Show.title).offset(offset).limit(limit).all()
            return {
                "shows": [
                    {
                        "id": s.id, "title": s.title,
                        "medium": self._lookup_dict(s.medium),
                        "original_year": s.original_year,
                        "description": s.description,
                        "genre": s.genre,
                        "themes": s.themes,
                        "summary": s.summary,
                        "plot_synopsis": s.plot_synopsis,
                        "work_origin": self._lookup_dict(s.work_origin) if hasattr(s, 'work_origin') else None,
                        "production_count": len(s.productions),
                    }
                    for s in shows
                ],
                "total": total,
            }

    def get_show(self, show_id: int) -> dict:
        """Get a single show with its productions and producer relationships."""
        with self._session_factory() as session:
            show = session.query(Show).options(
                joinedload(Show.medium),
                joinedload(Show.work_origin),
                joinedload(Show.productions).joinedload(Production.scale),
                joinedload(Show.productions).joinedload(Production.venue),
                joinedload(Show.productions).joinedload(Production.producers)
                .joinedload(ProducerProduction.producer),
                joinedload(Show.productions).joinedload(Production.producers)
                .joinedload(ProducerProduction.role),
                joinedload(Show.producer_shows).joinedload(ProducerShow.producer),
                joinedload(Show.producer_shows).joinedload(ProducerShow.role),
            ).filter_by(id=show_id).first()
            if not show:
                return {"error": "Show not found"}
            productions = []
            for p in show.productions:
                venue_data = None
                if p.venue:
                    venue_data = {"id": p.venue.id, "name": p.venue.name}
                producers_list = []
                for pp in p.producers:
                    if pp.producer:
                        producers_list.append({
                            "link_id": pp.id,
                            "producer_id": pp.producer.id,
                            "first_name": pp.producer.first_name,
                            "last_name": pp.producer.last_name,
                            "role": self._lookup_dict(pp.role),
                        })
                productions.append({
                    "id": p.id, "venue": venue_data,
                    "year": p.year, "scale": self._lookup_dict(p.scale),
                    "producers": producers_list,
                })
            producer_shows = []
            for ps in show.producer_shows:
                if ps.producer:
                    producer_shows.append({
                        "id": ps.id,
                        "producer_id": ps.producer.id,
                        "first_name": ps.producer.first_name,
                        "last_name": ps.producer.last_name,
                        "role": self._lookup_dict(ps.role),
                    })
            return {
                "id": show.id, "title": show.title,
                "medium": self._lookup_dict(show.medium),
                "original_year": show.original_year,
                "description": show.description,
                "genre": show.genre,
                "themes": show.themes,
                "summary": show.summary,
                "plot_synopsis": show.plot_synopsis,
                "work_origin": self._lookup_dict(show.work_origin) if hasattr(show, 'work_origin') else None,
                "created_at": str(show.created_at) if show.created_at else None,
                "productions": productions,
                "producer_shows": producer_shows,
            }

    def create_show(self, data: dict) -> dict:
        """Create a new show."""
        with self._session_factory() as session:
            show = Show(
                title=data["title"],
                medium_id=data.get("medium_id"),
                original_year=data.get("original_year"),
                description=data.get("description"),
                genre=data.get("genre"),
                themes=data.get("themes"),
                summary=data.get("summary"),
                plot_synopsis=data.get("plot_synopsis"),
                work_origin_id=data.get("work_origin_id"),
            )
            session.add(show)
            session.commit()
            return {"id": show.id, "title": show.title}

    def update_show(self, show_id: int, data: dict) -> dict:
        """Update a show's details."""
        with self._session_factory() as session:
            show = session.get(Show, show_id)
            if not show:
                return {"error": "Show not found"}
            for field in ["title", "medium_id", "original_year", "description", "genre", "themes", "summary", "plot_synopsis", "work_origin_id"]:
                if field in data:
                    setattr(show, field, data[field])
            session.commit()
            return {"id": show_id, "updated": True}

    def delete_show(self, show_id: int) -> dict:
        """Delete a show. Fails if it has productions."""
        with self._session_factory() as session:
            prod_count = session.query(Production).filter_by(show_id=show_id).count()
            if prod_count > 0:
                return {"error": f"Cannot delete show — used by {prod_count} production(s)"}
            session.query(ProducerShow).filter_by(show_id=show_id).delete()
            session.query(Show).filter_by(id=show_id).delete()
            session.commit()
            return {"deleted": True}

    # --- Producer ↔ Show (IP-level relationships) ---

    def get_producer_shows(self, producer_id: int) -> list[dict]:
        """Get a producer's IP-level show relationships."""
        with self._session_factory() as session:
            links = (session.query(ProducerShow)
                     .filter_by(producer_id=producer_id)
                     .options(
                         joinedload(ProducerShow.show).joinedload(Show.medium),
                         joinedload(ProducerShow.role),
                     )
                     .all())
            return [
                {
                    "id": ps.id,
                    "show_id": ps.show.id,
                    "show_title": ps.show.title,
                    "medium": self._lookup_dict(ps.show.medium),
                    "original_year": ps.show.original_year,
                    "role": self._lookup_dict(ps.role),
                }
                for ps in links if ps.show
            ]

    def add_producer_show(self, producer_id: int, show_id: int,
                           role_id: int, user_email: str) -> dict:
        """Link a producer to a show with an IP-level role."""
        with self._session_factory() as session:
            existing = session.query(ProducerShow).filter_by(
                producer_id=producer_id, show_id=show_id, role_id=role_id
            ).first()
            if existing:
                return {"error": "Producer already has this role on this show"}
            link = ProducerShow(
                producer_id=producer_id, show_id=show_id, role_id=role_id
            )
            session.add(link)
            show = session.get(Show, show_id)
            session.add(ChangeHistory(
                entity_type="producer", entity_id=producer_id,
                field_name="show_role_added", old_value=None,
                new_value=show.title if show else str(show_id),
                changed_by=user_email,
            ))
            session.commit()
            return {"id": link.id, "created": True}

    def remove_producer_show(self, link_id: int, user_email: str) -> dict:
        """Remove a producer's IP-level relationship to a show."""
        with self._session_factory() as session:
            link = session.get(ProducerShow, link_id)
            if not link:
                return {"error": "Link not found"}
            show = session.get(Show, link.show_id)
            session.add(ChangeHistory(
                entity_type="producer", entity_id=link.producer_id,
                field_name="show_role_removed",
                old_value=show.title if show else str(link.show_id),
                new_value=None, changed_by=user_email,
            ))
            session.delete(link)
            session.commit()
            return {"deleted": True}

    # --- Venue CRUD ---

    def list_venues(self, search: str = "", limit: int = 50, offset: int = 0) -> dict:
        """List venues with optional search and pagination."""
        with self._session_factory() as session:
            query = session.query(Venue).options(
                joinedload(Venue.venue_type),
            )
            if search:
                query = query.filter(Venue.name.ilike(f"%{search}%"))
            total = query.count()
            venues = query.order_by(Venue.name).offset(offset).limit(limit).all()
            return {
                "venues": [
                    {
                        "id": v.id, "name": v.name, "venue_type": self._lookup_dict(v.venue_type),
                        "city": v.city, "state_region": v.state_region, "country": v.country,
                        "capacity": v.capacity, "description": v.description,
                        "production_count": len(v.productions),
                    }
                    for v in venues
                ],
                "total": total,
            }

    def get_venue(self, venue_id: int) -> dict:
        """Get a single venue with its productions."""
        with self._session_factory() as session:
            venue = session.get(Venue, venue_id)
            if not venue:
                return {"error": "Venue not found"}
            productions = []
            for p in venue.productions:
                show_data = None
                if p.show:
                    show_data = {"id": p.show.id, "title": p.show.title, "medium": self._lookup_dict(p.show.medium)}
                productions.append({
                    "id": p.id, "title": p.title, "show": show_data,
                    "year": p.year, "scale": self._lookup_dict(p.scale),
                    "run_length": p.run_length, "description": p.description,
                    "producer_count": len(p.producers),
                })
            # Collect unique producers across all productions at this venue
            producer_map = {}
            for p in venue.productions:
                for pp in p.producers:
                    if pp.producer_id not in producer_map:
                        producer_map[pp.producer_id] = {
                            "id": pp.producer.id,
                            "first_name": pp.producer.first_name,
                            "last_name": pp.producer.last_name,
                            "production_count": 0,
                        }
                    producer_map[pp.producer_id]["production_count"] += 1
            venue_producers = sorted(producer_map.values(), key=lambda x: (x["last_name"].lower(), x["first_name"].lower()))

            social_links = self._get_social_links(session, "venue", venue_id)
            emails = self._get_emails(session, "venue", venue_id)

            return {
                "id": venue.id, "name": venue.name, "venue_type": self._lookup_dict(venue.venue_type),
                "city": venue.city, "state_region": venue.state_region, "country": venue.country,
                "capacity": venue.capacity, "description": venue.description,
                "social_links": social_links,
                "emails": emails,
                "productions": productions,
                "producers": venue_producers,
            }

    def add_production_to_venue(self, venue_id: int, production_id: int) -> dict:
        """Link a production to a venue by setting its venue_id."""
        with self._session_factory() as session:
            production = session.get(Production, production_id)
            if not production:
                return {"error": "Production not found"}
            venue = session.get(Venue, venue_id)
            if not venue:
                return {"error": "Venue not found"}
            if production.venue_id == venue_id:
                return {"error": "Production is already at this venue"}
            production.venue_id = venue_id
            session.commit()
            return {"ok": True}

    def remove_production_from_venue(self, venue_id: int, production_id: int) -> dict:
        """Unlink a production from a venue by clearing its venue_id."""
        with self._session_factory() as session:
            production = session.get(Production, production_id)
            if not production:
                return {"error": "Production not found"}
            if production.venue_id != venue_id:
                return {"error": "Production is not at this venue"}
            production.venue_id = None
            session.commit()
            return {"ok": True}

    def create_venue(self, data: dict) -> dict:
        """Create a new venue."""
        with self._session_factory() as session:
            venue = Venue(
                name=data["name"],
                venue_type_id=data.get("venue_type_id"),
                city=data.get("city"),
                state_region=data.get("state_region"),
                country=data.get("country"),
                capacity=data.get("capacity"),
                description=data.get("description"),
            )
            session.add(venue)
            session.commit()
            return {"id": venue.id, "name": venue.name}

    def update_venue(self, venue_id: int, data: dict) -> dict:
        """Update a venue's details."""
        with self._session_factory() as session:
            venue = session.get(Venue, venue_id)
            if not venue:
                return {"error": "Venue not found"}
            for field in ["name", "venue_type_id", "city", "state_region", "country", "capacity", "description"]:
                if field in data:
                    setattr(venue, field, data[field])
            session.commit()
            return {"id": venue_id, "updated": True}

    def delete_venue(self, venue_id: int) -> dict:
        """Delete a venue. Fails if linked to productions."""
        with self._session_factory() as session:
            prod_count = session.query(Production).filter_by(venue_id=venue_id).count()
            if prod_count > 0:
                return {"error": f"Cannot delete venue — used by {prod_count} production(s)"}
            session.query(Venue).filter_by(id=venue_id).delete()
            session.commit()
            return {"deleted": True}

    # --- Award CRUD ---

    def create_award(self, data: dict) -> dict:
        """Create an award on a producer, optionally linked to a production."""
        with self._session_factory() as session:
            award = Award(
                producer_id=data["producer_id"],
                production_id=data.get("production_id"),
                award_name=data["award_name"],
                category=data.get("category"),
                year=data.get("year"),
                outcome_id=data.get("outcome_id"),
            )
            session.add(award)
            session.commit()
            return {"id": award.id, "award_name": award.award_name}

    def update_award(self, award_id: int, data: dict) -> dict:
        """Update an award."""
        with self._session_factory() as session:
            award = session.get(Award, award_id)
            if not award:
                return {"error": "Award not found"}
            for field in ["award_name", "category", "year", "outcome_id", "production_id"]:
                if field in data:
                    setattr(award, field, data[field])
            session.commit()
            return {"id": award_id, "updated": True}

    def delete_award(self, award_id: int) -> dict:
        """Delete an award."""
        with self._session_factory() as session:
            session.query(Award).filter_by(id=award_id).delete()
            session.commit()
            return {"deleted": True}

    # --- Interaction edit/delete ---

    def update_interaction(self, interaction_id: int, content: str, user_email: str) -> dict:
        """Edit an interaction's content."""
        with self._session_factory() as session:
            interaction = session.get(Interaction, interaction_id)
            if not interaction:
                return {"error": "Interaction not found"}
            interaction.content = content
            session.add(ChangeHistory(
                entity_type="interaction", entity_id=interaction_id,
                field_name="content", old_value=None,
                new_value="(edited)", changed_by=user_email,
            ))
            session.commit()
            return {"id": interaction_id, "updated": True}

    def delete_interaction(self, interaction_id: int, producer_id: int) -> dict:
        """Delete an interaction and recompute relationship state."""
        with self._session_factory() as session:
            interaction = session.get(Interaction, interaction_id)
            if not interaction:
                return {"error": "Interaction not found"}
            session.query(FollowUpSignal).filter_by(interaction_id=interaction_id).delete()
            session.delete(interaction)
            session.flush()
            recompute_relationship_state(session, producer_id)
            session.commit()
            return {"deleted": True}

    # --- Follow-up signal management ---

    def resolve_follow_up(self, signal_id: int) -> dict:
        """Manually resolve a follow-up signal."""
        with self._session_factory() as session:
            signal = session.get(FollowUpSignal, signal_id)
            if not signal:
                return {"error": "Follow-up not found"}
            signal.resolved = True
            signal.resolved_at = datetime.now(timezone.utc)
            session.commit()
            return {"id": signal_id, "resolved": True}

    def update_follow_up(self, signal_id: int, data: dict) -> dict:
        """Update a follow-up signal (timeframe, action, due_date)."""
        with self._session_factory() as session:
            signal = session.get(FollowUpSignal, signal_id)
            if not signal:
                return {"error": "Follow-up not found"}
            for field in ["implied_action", "timeframe", "due_date"]:
                if field in data:
                    setattr(signal, field, data[field])
            session.commit()
            return {"id": signal_id, "updated": True}

    def delete_follow_up(self, signal_id: int) -> dict:
        """Delete a follow-up signal."""
        with self._session_factory() as session:
            session.query(FollowUpSignal).filter_by(id=signal_id).delete()
            session.commit()
            return {"deleted": True}

    # --- Tag merge ---

    def merge_tags(self, source_tag_id: int, target_tag_id: int) -> dict:
        """Merge source tag into target: reassign all producers, delete source."""
        with self._session_factory() as session:
            source = session.get(Tag, source_tag_id)
            target = session.get(Tag, target_tag_id)
            if not source or not target:
                return {"error": "Tag not found"}
            # Move associations from source to target (skip existing)
            source_links = session.query(ProducerTag).filter_by(tag_id=source_tag_id).all()
            for link in source_links:
                existing = session.query(ProducerTag).filter_by(
                    producer_id=link.producer_id, tag_id=target_tag_id
                ).first()
                if existing:
                    session.delete(link)
                else:
                    link.tag_id = target_tag_id
            # Delete source tag
            session.query(Tag).filter_by(id=source_tag_id).delete()
            session.commit()
            return {"merged": True, "target_tag": target.name}

    # --- Batch operations ---

    def batch_refresh(self, producer_ids: list[int]) -> dict:
        """Queue batch refresh for multiple producers. Returns count."""
        return {"count": len(producer_ids), "triggered": True}

    def batch_add_tag(self, producer_ids: list[int], tag_name: str,
                       user_email: str) -> dict:
        """Add a tag to multiple producers."""
        added = 0
        for pid in producer_ids:
            result = self.add_tag(pid, tag_name, user_email)
            if not result.get("already_exists"):
                added += 1
        return {"added": added, "total": len(producer_ids)}

    def batch_remove_tag(self, producer_ids: list[int], tag_name: str,
                          user_email: str) -> dict:
        """Remove a tag from multiple producers."""
        removed = 0
        for pid in producer_ids:
            self.remove_tag(pid, tag_name, user_email)
            removed += 1
        return {"removed": removed, "total": len(producer_ids)}

    # --- Traits/Intel CRUD ---

    def get_producer_traits(self, producer_id: int) -> list[dict]:
        """Get all traits for a producer."""
        with self._session_factory() as session:
            traits = (session.query(ProducerTrait)
                      .filter_by(producer_id=producer_id)
                      .options(joinedload(ProducerTrait.category))
                      .order_by(ProducerTrait.created_at.desc())
                      .all())
            return [
                {
                    "id": t.id,
                    "category": self._lookup_dict(t.category),
                    "value": t.value,
                    "confidence": t.confidence,
                    "computed_at": str(t.computed_at) if t.computed_at else None,
                    "created_at": str(t.created_at) if t.created_at else None,
                }
                for t in traits
            ]

    def create_producer_trait(self, producer_id: int, data: dict) -> dict:
        """Create a trait for a producer."""
        with self._session_factory() as session:
            trait = ProducerTrait(
                producer_id=producer_id,
                category_id=data["category_id"],
                value=data["value"],
                confidence=data.get("confidence"),
                computed_at=data.get("computed_at"),
            )
            session.add(trait)
            session.commit()
            return {"id": trait.id, "created": True}

    def update_producer_trait(self, trait_id: int, data: dict) -> dict:
        """Update a producer trait."""
        with self._session_factory() as session:
            trait = session.get(ProducerTrait, trait_id)
            if not trait:
                return {"error": "Trait not found"}
            for field in ("category_id", "value", "confidence", "computed_at"):
                if field in data:
                    setattr(trait, field, data[field])
            session.commit()
            return {"id": trait_id, "updated": True}

    def delete_producer_trait(self, trait_id: int) -> dict:
        """Delete a producer trait."""
        with self._session_factory() as session:
            trait = session.get(ProducerTrait, trait_id)
            if not trait:
                return {"error": "Trait not found"}
            session.delete(trait)
            session.commit()
            return {"deleted": True}

    def get_producer_intel(self, producer_id: int) -> list[dict]:
        """Get all intel for a producer."""
        with self._session_factory() as session:
            intel = (session.query(ProducerIntel)
                     .filter_by(producer_id=producer_id)
                     .options(joinedload(ProducerIntel.category))
                     .order_by(ProducerIntel.created_at.desc())
                     .all())
            return [
                {
                    "id": i.id,
                    "category": self._lookup_dict(i.category),
                    "observation": i.observation,
                    "confidence": i.confidence,
                    "source_url": i.source_url,
                    "discovered_at": str(i.discovered_at) if i.discovered_at else None,
                    "created_at": str(i.created_at) if i.created_at else None,
                }
                for i in intel
            ]

    def create_producer_intel(self, producer_id: int, data: dict) -> dict:
        """Create an intel entry for a producer."""
        with self._session_factory() as session:
            entry = ProducerIntel(
                producer_id=producer_id,
                category_id=data["category_id"],
                observation=data["observation"],
                confidence=data.get("confidence"),
                source_url=data.get("source_url"),
                discovered_at=data.get("discovered_at"),
            )
            session.add(entry)
            session.commit()
            return {"id": entry.id, "created": True}

    def update_producer_intel(self, intel_id: int, data: dict) -> dict:
        """Update a producer intel entry."""
        with self._session_factory() as session:
            entry = session.get(ProducerIntel, intel_id)
            if not entry:
                return {"error": "Intel entry not found"}
            for field in ("category_id", "observation", "confidence", "source_url", "discovered_at"):
                if field in data:
                    setattr(entry, field, data[field])
            session.commit()
            return {"id": intel_id, "updated": True}

    def delete_producer_intel(self, intel_id: int) -> dict:
        """Delete a producer intel entry."""
        with self._session_factory() as session:
            entry = session.get(ProducerIntel, intel_id)
            if not entry:
                return {"error": "Intel entry not found"}
            session.delete(entry)
            session.commit()
            return {"deleted": True}

    # --- Helpers ---

    def _production_detail(self, prod: Production) -> dict:
        """Full detail for a production. Title comes from the parent show."""
        show_data = None
        title = None
        if prod.show:
            title = prod.show.title
            show_data = {
                "id": prod.show.id, "title": prod.show.title,
                "medium": self._lookup_dict(prod.show.medium),
                "original_year": prod.show.original_year,
            }
        venue_data = None
        if prod.venue:
            venue_data = {
                "id": prod.venue.id, "name": prod.venue.name,
                "venue_type": self._lookup_dict(prod.venue.venue_type),
                "city": prod.venue.city, "state_region": prod.venue.state_region, "country": prod.venue.country,
            }
        producers = []
        if hasattr(prod, "producers"):
            for pp in prod.producers:
                if pp.producer:
                    producers.append({
                        "link_id": pp.id,
                        "producer_id": pp.producer.id,
                        "first_name": pp.producer.first_name,
                        "last_name": pp.producer.last_name,
                        "role": self._lookup_dict(pp.role),
                    })
        return {
            "id": prod.id, "title": title, "show": show_data, "venue": venue_data,
            "year": prod.year,
            "start_date": str(prod.start_date) if prod.start_date else None,
            "end_date": str(prod.end_date) if prod.end_date else None,
            "scale": self._lookup_dict(prod.scale), "run_length": prod.run_length,
            "description": prod.description,
            "production_type": self._lookup_dict(prod.production_type) if hasattr(prod, 'production_type') else None,
            "capitalization": prod.capitalization,
            "budget_tier": self._lookup_dict(prod.budget_tier) if hasattr(prod, 'budget_tier') else None,
            "recouped": prod.recouped,
            "funding_type": self._lookup_dict(prod.funding_type) if hasattr(prod, 'funding_type') else None,
            "producers": producers,
            "producer_count": len(producers),
        }

    # --- Entity helpers (shared across producer/org/venue) ---

    def _lookup_dict(self, lv):
        """Serialize a LookupValue relationship, or None."""
        if not lv:
            return None
        return {"id": lv.id, "value": lv.value, "display_label": lv.display_label, "description": lv.description, "css_class": lv.css_class}

    def _get_social_links(self, session, entity_type: str, entity_id: int) -> list[dict]:
        """Get social links for any entity type."""
        links = (session.query(EntitySocialLink)
                 .filter_by(entity_type=entity_type, entity_id=entity_id)
                 .options(joinedload(EntitySocialLink.platform))
                 .all())
        return [
            {"platform_id": l.platform_id, "platform_name": l.platform.name, "icon_svg": l.platform.icon_svg, "url": l.url}
            for l in links
        ]

    def _get_emails(self, session, entity_type: str, entity_id: int) -> list[dict]:
        """Get emails for any entity type."""
        emails = (session.query(EntityEmail)
                  .filter_by(entity_type=entity_type, entity_id=entity_id)
                  .options(joinedload(EntityEmail.email_type))
                  .order_by(EntityEmail.is_primary.desc(), EntityEmail.created_at)
                  .all())
        return [
            {
                "id": e.id, "email": e.email,
                "email_type": self._lookup_dict(e.email_type),
                "source": e.source, "confidence": e.confidence,
                "is_primary": e.is_primary,
            }
            for e in emails
        ]

    def _get_primary_email(self, session, entity_type: str, entity_id: int) -> str | None:
        """Get the primary email for an entity."""
        email = (session.query(EntityEmail)
                 .filter_by(entity_type=entity_type, entity_id=entity_id, is_primary=True)
                 .first())
        if email:
            return email.email
        # Fallback to first email
        email = (session.query(EntityEmail)
                 .filter_by(entity_type=entity_type, entity_id=entity_id)
                 .first())
        return email.email if email else None

    # --- Email CRUD ---

    def get_entity_emails(self, entity_type: str, entity_id: int) -> list[dict]:
        """Get emails for an entity."""
        with self._session_factory() as session:
            return self._get_emails(session, entity_type, entity_id)

    def add_entity_email(self, entity_type: str, entity_id: int, email: str,
                         type_id: int = None, source: str = None,
                         confidence: str = None, is_primary: bool = False) -> dict:
        """Add an email to an entity."""
        with self._session_factory() as session:
            # If marking as primary, unset existing primaries
            if is_primary:
                existing = (session.query(EntityEmail)
                            .filter_by(entity_type=entity_type, entity_id=entity_id, is_primary=True)
                            .all())
                for e in existing:
                    e.is_primary = False

            new_email = EntityEmail(
                entity_type=entity_type, entity_id=entity_id,
                email=email, type_id=type_id, source=source,
                confidence=confidence, is_primary=is_primary,
            )
            session.add(new_email)
            session.commit()
            return {"id": new_email.id, "added": True}

    def remove_entity_email(self, entity_type: str, entity_id: int, email_id: int) -> dict:
        """Remove an email from an entity."""
        with self._session_factory() as session:
            email = session.get(EntityEmail, email_id)
            if not email or email.entity_type != entity_type or email.entity_id != entity_id:
                return {"error": "Email not found"}
            session.delete(email)
            session.commit()
            return {"removed": True}

    def set_primary_email(self, entity_type: str, entity_id: int, email_id: int) -> dict:
        """Set an email as primary for an entity."""
        with self._session_factory() as session:
            # Unset existing primaries
            existing = (session.query(EntityEmail)
                        .filter_by(entity_type=entity_type, entity_id=entity_id, is_primary=True)
                        .all())
            for e in existing:
                e.is_primary = False

            email = session.get(EntityEmail, email_id)
            if not email or email.entity_type != entity_type or email.entity_id != entity_id:
                return {"error": "Email not found"}
            email.is_primary = True
            session.commit()
            return {"updated": True}

    # --- Lookup Values ---

    def get_lookup_value(self, lv_id: int) -> dict | None:
        """Get a single lookup value by ID."""
        with self._session_factory() as session:
            lv = session.query(LookupValue).get(lv_id)
            if not lv:
                return None
            return {
                "id": lv.id, "category": lv.category, "entity_type": lv.entity_type,
                "value": lv.value, "display_label": lv.display_label,
                "description": lv.description, "css_class": lv.css_class, "sort_order": lv.sort_order,
            }

    def get_lookup_values(self, category: str, entity_type: str) -> list[dict]:
        """Get lookup values for a category and entity type."""
        with self._session_factory() as session:
            values = (session.query(LookupValue)
                      .filter_by(category=category, entity_type=entity_type)
                      .order_by(LookupValue.sort_order)
                      .all())
            return [
                {"id": v.id, "value": v.value, "display_label": v.display_label, "description": v.description, "css_class": v.css_class}
                for v in values
            ]

    def get_all_lookup_values(self) -> list[dict]:
        """Get all lookup values grouped by category/entity_type."""
        with self._session_factory() as session:
            values = (session.query(LookupValue)
                      .order_by(LookupValue.category, LookupValue.entity_type, LookupValue.sort_order)
                      .all())
            return [
                {
                    "id": v.id, "category": v.category, "entity_type": v.entity_type,
                    "value": v.value, "display_label": v.display_label,
                    "description": v.description, "css_class": v.css_class, "sort_order": v.sort_order,
                }
                for v in values
            ]

    def create_lookup_value(self, data: dict) -> dict:
        """Create a new lookup value."""
        with self._session_factory() as session:
            lv = LookupValue(
                category=data["category"],
                entity_type=data["entity_type"],
                value=data["value"],
                display_label=data["display_label"],
                description=data.get("description"),
                css_class=data.get("css_class"),
                sort_order=data.get("sort_order", 0),
            )
            session.add(lv)
            session.flush()
            result = {
                "id": lv.id, "category": lv.category, "entity_type": lv.entity_type,
                "value": lv.value, "display_label": lv.display_label,
                "description": lv.description, "css_class": lv.css_class, "sort_order": lv.sort_order,
            }
            session.commit()
            return result

    def update_lookup_value(self, lv_id: int, data: dict) -> dict:
        """Update a lookup value."""
        with self._session_factory() as session:
            lv = session.query(LookupValue).get(lv_id)
            if not lv:
                raise ValueError(f"Lookup value {lv_id} not found")
            for key in ("value", "display_label", "description", "css_class", "sort_order"):
                if key in data:
                    setattr(lv, key, data[key])
            session.commit()
            return {
                "id": lv.id, "category": lv.category, "entity_type": lv.entity_type,
                "value": lv.value, "display_label": lv.display_label,
                "description": lv.description, "css_class": lv.css_class, "sort_order": lv.sort_order,
            }

    def delete_lookup_value(self, lv_id: int) -> dict:
        """Delete a lookup value if not referenced by any records."""
        with self._session_factory() as session:
            lv = session.query(LookupValue).get(lv_id)
            if not lv:
                raise ValueError(f"Lookup value {lv_id} not found")
            # Check all FK references
            usage = 0
            usage += session.query(Show).filter_by(medium_id=lv_id).count()
            usage += session.query(ProducerShow).filter_by(role_id=lv_id).count()
            usage += session.query(Production).filter_by(scale_id=lv_id).count()
            usage += session.query(ProducerProduction).filter_by(role_id=lv_id).count()
            usage += session.query(Organization).filter_by(org_type_id=lv_id).count()
            usage += session.query(Venue).filter_by(venue_type_id=lv_id).count()
            usage += session.query(Award).filter_by(outcome_id=lv_id).count()
            usage += session.query(EntityEmail).filter_by(type_id=lv_id).count()
            usage += session.query(ProducerTrait).filter_by(category_id=lv_id).count()
            usage += session.query(ProducerIntel).filter_by(category_id=lv_id).count()
            usage += session.query(Production).filter_by(production_type_id=lv_id).count()
            usage += session.query(Production).filter_by(budget_tier_id=lv_id).count()
            usage += session.query(Production).filter_by(funding_type_id=lv_id).count()
            usage += session.query(Show).filter_by(work_origin_id=lv_id).count()
            if usage > 0:
                raise ValueError(f"Cannot delete: used by {usage} record{'s' if usage != 1 else ''}")
            session.delete(lv)
            session.commit()
            return {"deleted": True}

    def reorder_lookup_values(self, category: str, entity_type: str, ordered_ids: list[int]) -> list[dict]:
        """Reorder lookup values within a category/entity_type group."""
        with self._session_factory() as session:
            for i, lv_id in enumerate(ordered_ids):
                lv = session.query(LookupValue).get(lv_id)
                if lv and lv.category == category and lv.entity_type == entity_type:
                    lv.sort_order = i
            session.commit()
            return self.get_lookup_values(category, entity_type)

    def _producer_summary(self, p: Producer, session=None) -> dict:
        """Minimal summary for list views and search results."""
        # Get current org
        current_org = None
        if hasattr(p, "organizations") and p.organizations:
            for po in p.organizations:
                if po.end_date is None and hasattr(po, "organization") and po.organization:
                    current_org = po.organization.name
                    break

        tags = []
        if hasattr(p, "tags") and p.tags:
            tags = [pt.tag.name for pt in p.tags if hasattr(pt, "tag") and pt.tag]

        primary_email = None
        if session:
            primary_email = self._get_primary_email(session, "producer", p.id)

        return {
            "id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "email": primary_email,
            "current_organization": current_org,
            "city": p.city,
            "last_contact_date": str(p.last_contact_date) if p.last_contact_date else None,
            "interaction_count": p.interaction_count or 0,
            "research_status": p.research_status,
            "research_status_detail": p.research_status_detail,
            "tags": tags,
            "updated_at": str(p.updated_at) if p.updated_at else None,
        }


def _log_creation(session: Session, producer_id: int, user_email: str):
    """Log the creation of a new producer."""
    session.add(ChangeHistory(
        entity_type="producer",
        entity_id=producer_id,
        field_name="created",
        old_value=None,
        new_value="Record created",
        changed_by=user_email,
    ))
