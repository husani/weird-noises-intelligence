"""
Seed comprehensive test data for the Producers tool.

Run AFTER the server has started at least once (so lookup_values and social_platforms exist).
Usage: cd intelligence && PYTHONPATH=. poetry run python scripts/seed_test_data.py
"""

from datetime import datetime, timezone, timedelta, date

from shared.backend.config import settings  # noqa: F401 — triggers env load
from shared.backend.db import create_engine_for, create_session_factory
from producers.backend.models import (
    ALL_MODELS,
    Award,
    EntityEmail,
    EntitySocialLink,
    FollowUpSignal,
    Interaction,
    LookupValue,
    Organization,
    Producer,
    ProducerIntel,
    ProducerOrganization,
    ProducerProduction,
    ProducerShow,
    ProducerTag,
    ProducerTrait,
    Production,
    Show,
    SocialPlatform,
    Tag,
    Venue,
)


def _utcnow():
    return datetime.now(timezone.utc)


def _days_ago(n):
    return _utcnow() - timedelta(days=n)


def main():
    engine = create_engine_for("intelligence_producers")
    SessionFactory = create_session_factory(engine)

    with SessionFactory() as s:
        # Check if data already exists
        if s.query(Producer).count() > 0:
            print("Test data already exists. Drop the database first to re-seed.")
            return

        # --- Lookup value IDs ---
        def lv(category, value):
            row = s.query(LookupValue).filter_by(category=category, value=value).first()
            return row.id if row else None

        scale_broadway = lv("scale", "Broadway")
        scale_offbway = lv("scale", "Off-Broadway")
        scale_regional = lv("scale", "regional")
        scale_touring = lv("scale", "touring")
        scale_intl = lv("scale", "international")

        medium_musical = lv("medium", "musical")
        medium_play = lv("medium", "play")
        medium_play_with_music = lv("medium", "play with music")
        medium_revue = lv("medium", "revue")
        medium_solo = lv("medium", "solo show")

        role_pp_lead = lv("role", "lead producer")  # producer_production scope — resolved by value
        # Need to scope by entity_type for producer_production vs producer_show
        role_pp_lead = s.query(LookupValue).filter_by(category="role", entity_type="producer_production", value="lead producer").first()
        role_pp_co = s.query(LookupValue).filter_by(category="role", entity_type="producer_production", value="co-producer").first()
        role_pp_assoc = s.query(LookupValue).filter_by(category="role", entity_type="producer_production", value="associate producer").first()
        role_pp_exec = s.query(LookupValue).filter_by(category="role", entity_type="producer_production", value="executive producer").first()

        role_ps_rights = s.query(LookupValue).filter_by(category="role", entity_type="producer_show", value="rights holder").first()
        role_ps_lead = s.query(LookupValue).filter_by(category="role", entity_type="producer_show", value="lead producer").first()
        role_ps_dev = s.query(LookupValue).filter_by(category="role", entity_type="producer_show", value="developer").first()

        org_producing_office = lv("org_type", "producing office")
        org_nonprofit = lv("org_type", "non-profit theatre")
        org_commercial = lv("org_type", "commercial production company")
        org_devprogram = lv("org_type", "development program")

        venue_broadway = lv("venue_type", "Broadway house")
        venue_offbway = lv("venue_type", "Off-Broadway")
        venue_regional = lv("venue_type", "regional")
        venue_festival = lv("venue_type", "festival")

        outcome_nominated = lv("award_outcome", "nominated")
        outcome_won = lv("award_outcome", "won")

        email_personal = lv("email_type", "personal")
        email_work = lv("email_type", "work")
        email_org = lv("email_type", "organizational")

        # --- Social platform IDs ---
        def sp(name):
            row = s.query(SocialPlatform).filter_by(name=name).first()
            return row.id if row else None

        plat_instagram = sp("Instagram")
        plat_linkedin = sp("LinkedIn")
        plat_twitter = sp("Twitter/X")
        plat_ibdb = sp("IBDb")

        # ==================== VENUES ====================
        venues_data = [
            ("Richard Rodgers Theatre", venue_broadway, "New York", "NY", "USA", 1319, "Home of Hamilton since 2015"),
            ("Bernard B. Jacobs Theatre", venue_broadway, "New York", "NY", "USA", 1078, "Shubert Organization house on West 45th Street"),
            ("Booth Theatre", venue_broadway, "New York", "NY", "USA", 766, "Intimate Shubert house"),
            ("St. James Theatre", venue_broadway, "New York", "NY", "USA", 1710, "Jujamcyn house. Home to major musicals including Oklahoma!, The Producers, Frozen."),
            ("Vivian Beaumont Theater", venue_broadway, "New York", "NY", "USA", 1080, "Lincoln Center Theater's main stage"),
            ("New York Theatre Workshop", venue_offbway, "New York", "NY", "USA", 199, "Premiered Rent, Hadestown"),
            ("Playwrights Horizons", venue_offbway, "New York", "NY", "USA", 198, "New American plays and musicals"),
            ("Atlantic Theater Company", venue_offbway, "New York", "NY", "USA", 199, "Founded by David Mamet and William H. Macy. Linda Gross Theater and Stage 2."),
            ("Goodman Theatre", venue_regional, "Chicago", "IL", "USA", 856, "Major regional hub"),
            ("Arena Stage", venue_regional, "Washington", "DC", "USA", 680, "Fichandler Stage"),
            ("Oregon Shakespeare Festival", venue_festival, "Ashland", "OR", "USA", 1190, "Largest rep theatre in US"),
            ("Edinburgh Festival Theatre", venue_festival, "Edinburgh", None, "UK", 1915, "Edinburgh Fringe venue"),
        ]
        venues = []
        for name, vtype, city, state, country, cap, desc in venues_data:
            v = Venue(name=name, venue_type_id=vtype, city=city, state_region=state, country=country, capacity=cap, description=desc)
            s.add(v)
            venues.append(v)
        s.flush()

        # ==================== ORGANIZATIONS ====================
        orgs_data = [
            ("Seaview Productions", org_producing_office, "https://seaviewproductions.com", "New York", "NY", "USA",
             "Greg Nobile's producing office. Active on Broadway and Off-Broadway."),
            ("The Araca Group", org_commercial, "https://araca.com", "New York", "NY", "USA",
             "Diversified entertainment company. Produced Wicked, Elf, Urinetown."),
            ("Manhattan Theatre Club", org_nonprofit, "https://manhattantheatreclub.com", "New York", "NY", "USA",
             "Major Off-Broadway and Broadway nonprofit. Samuel J. Friedman Theatre."),
            ("Roundabout Theatre Company", org_nonprofit, "https://roundabouttheatre.org", "New York", "NY", "USA",
             "Largest nonprofit theatre in the US. Multiple venues."),
            ("Second Stage Theater", org_nonprofit, "https://2st.com", "New York", "NY", "USA",
             "Dedicated to living American playwrights. Hayes Theater on Broadway."),
            ("Lincoln Center Theater", org_nonprofit, "https://lct.org", "New York", "NY", "USA",
             "Three theatres at Lincoln Center. Vivian Beaumont, Mitzi Newhouse, Claire Tow."),
            ("Foresight Theatrical", org_producing_office, None, "New York", "NY", "USA",
             "Mark Shacket's general management and producing office."),
            ("Level Forward", org_commercial, "https://levelforward.com", "New York", "NY", "USA",
             "Adrienne Becker and Julia Dunetz. Jagged Little Pill, Oklahoma! revival."),
            ("National New Play Network", org_devprogram, "https://nnpn.org", "Washington", "DC", "USA",
             "Alliance of nonprofit theatres championing new plays."),
            ("Williamstown Theatre Festival", org_devprogram, "https://wtfestival.org", "Williamstown", "MA", "USA",
             "Summer festival and development pipeline. Major launching pad for Broadway."),
            ("Steppenwolf Theatre Company", org_nonprofit, "https://steppenwolf.org", "Chicago", "IL", "USA",
             "Ensemble-based company. Founded by Gary Sinise, Terry Kinney, Jeff Perry."),
            ("Public Theater", org_nonprofit, "https://publictheater.org", "New York", "NY", "USA",
             "Home of Shakespeare in the Park and Joe's Pub. Major new work incubator."),
        ]
        orgs = []
        for name, otype, website, city, state, country, desc in orgs_data:
            o = Organization(name=name, org_type_id=otype, website=website, city=city, state_region=state, country=country, description=desc)
            s.add(o)
            orgs.append(o)
        s.flush()

        # ==================== PRODUCERS ====================
        producers_data = [
            ("Jordan", "Roth", "212-555-0101", "New York", "NY", "USA", "https://jujamcyn.com", "manual"),
            ("Jeffrey", "Seller", "212-555-0102", "New York", "NY", "USA", None, "manual"),
            ("Mara", "Isaacs", "212-555-0103", "New York", "NY", "USA", "https://octopustheatricals.com", "manual"),
            ("Scott", "Rudin", None, "New York", "NY", "USA", None, "manual"),
            ("Orin", "Wolf", "212-555-0105", "New York", "NY", "USA", None, "manual"),
            ("Eva", "Price", "212-555-0106", "New York", "NY", "USA", None, "manual"),
            ("Greg", "Nobile", "212-555-0107", "New York", "NY", "USA", "https://seaviewproductions.com", "manual"),
            ("Barbara", "Whitman", "212-555-0108", "New York", "NY", "USA", None, "manual"),
            ("Hunter", "Arnold", "212-555-0109", "New York", "NY", "USA", "https://hunterarnold.com", "manual"),
            ("Sonia", "Friedman", "+44-20-555-0110", "London", None, "UK", "https://soniafriedman.com", "manual"),
            ("Sue", "Wagner", "212-555-0111", "New York", "NY", "USA", None, "url"),
            ("Rashad", "Chambers", "917-555-0112", "New York", "NY", "USA", None, "manual"),
            ("Jenny", "Gersten", "212-555-0113", "New York", "NY", "USA", None, "manual"),
            ("Tom", "Kirdahy", "212-555-0114", "New York", "NY", "USA", None, "manual"),
            ("Dori", "Berinstein", "310-555-0115", "Los Angeles", "CA", "USA", "https://doriberinsteinproductions.com", "manual"),
        ]
        producers = []
        for first, last, phone, city, state, country, website, intake in producers_data:
            p = Producer(
                first_name=first, last_name=last, phone=phone, city=city,
                state_region=state, country=country, website=website,
                intake_source=intake,
                research_status="complete",
            )
            s.add(p)
            producers.append(p)
        s.flush()

        # Add identity fields to some producers
        producers[0].nickname = "JR"
        producers[0].pronouns = "he/him"
        producers[0].college = "Columbia University"
        producers[1].pronouns = "he/him"
        producers[1].hometown = "Detroit"
        producers[1].hometown_state = "MI"
        producers[2].pronouns = "she/her"
        producers[2].college = "Yale School of Drama"
        producers[2].languages = "English, French"
        producers[4].nickname = "O"
        producers[4].college = "NYU Tisch"
        producers[9].hometown = "London"
        producers[9].hometown_country = "UK"
        producers[9].seasonal_location = "Provence, France (summers)"

        # Name lookup helper
        def pid(first, last):
            return next(p.id for p in producers if p.first_name == first and p.last_name == last)

        def oid(name):
            return next(o.id for o in orgs if o.name == name)

        def vid(name):
            return next(v.id for v in venues if v.name == name)

        # ==================== SHOWS ====================
        # Each distinct theatrical work as IP
        shows_data = [
            ("Hamilton", medium_musical, 2015, "Hip-hop musical telling the story of American Founding Father Alexander Hamilton. Book, music, and lyrics by Lin-Manuel Miranda."),
            ("Hadestown", medium_musical, 2006, "Folk opera retelling the myth of Orpheus and Eurydice. Music, lyrics, and book by Anaïs Mitchell."),
            ("The Lehman Trilogy", medium_play, 2013, "Epic three-act play tracing 163 years of the Lehman Brothers dynasty. By Stefano Massini, adapted by Ben Power."),
            ("Dear Evan Hansen", medium_musical, 2015, "Contemporary musical about a high school senior with social anxiety who fabricates a connection to a classmate who died by suicide. Score by Benj Pasek and Justin Paul."),
            ("The Band's Visit", medium_musical, 2016, "Intimate musical about an Egyptian police band stranded in a small Israeli desert town. Based on the 2007 film."),
            ("A Doll's House", medium_play, 1879, "Henrik Ibsen's landmark drama about a woman's struggle for independence within a stifling marriage. Widely considered the first modern play."),
            ("Stereophonic", medium_play, 2023, "David Adjmi play set in a 1970s recording studio, following a band making an album as their personal relationships fracture."),
            ("Suffs", medium_musical, 2022, "Musical about the women's suffrage movement in the final years before the 19th Amendment. Written by Shaina Taub."),
            ("The Outsiders", medium_musical, 2023, "Musical adaptation of the S.E. Hinton novel about rival teen gangs in 1960s Oklahoma. Directed by Danya Taymor."),
            ("Merrily We Roll Along", medium_musical, 1981, "Sondheim and Furth musical told in reverse chronology, tracing three friends from middle-aged disillusionment back to youthful idealism."),
            ("A Strange Loop", medium_musical, 2019, "Meta-musical by Michael R. Jackson about a Black queer writer writing a musical about a Black queer writer. Pulitzer Prize winner."),
            ("Between Riverside and Crazy", medium_play, 2014, "Stephen Adly Guirgis play about a retired NYPD officer fighting to keep his rent-stabilized apartment on Riverside Drive. Pulitzer Prize winner."),
            ("Fat Ham", medium_play, 2021, "James Ijames' Pulitzer-winning play reimagining Hamlet at a Black Southern family barbecue."),
            ("Jagged Little Pill", medium_musical, 2018, "Musical inspired by Alanis Morissette's album, weaving her songs into an original story about a suburban Connecticut family."),
            ("What the Constitution Means to Me", medium_play_with_music, 2017, "Heidi Schreck's genre-bending play exploring the U.S. Constitution through personal narrative and live debate."),
            ("Harry Potter and the Cursed Child", medium_play, 2016, "Two-part stage play set nineteen years after the events of the Harry Potter series. Story by J.K. Rowling, Jack Thorne, and John Tiffany."),
            ("Oklahoma!", medium_musical, 1943, "Rodgers and Hammerstein's groundbreaking musical set in Indian Territory at the turn of the 20th century."),
            ("The Minutes", medium_play, 2017, "Tracy Letts satirical play about a small-town city council meeting that takes a dark turn when a member raises uncomfortable questions about the town's history."),
            ("Cost of Living", medium_play, 2016, "Martyna Majok's Pulitzer-winning play about two pairs of people navigating disability, dependency, and connection in New Jersey."),
            ("Leopoldstadt", medium_play, 2020, "Tom Stoppard's sweeping drama following a Jewish family in Vienna from 1899 through the Holocaust and its aftermath."),
        ]
        shows = []
        for title, medium_id, orig_year, desc in shows_data:
            show = Show(title=title, medium_id=medium_id, original_year=orig_year, description=desc)
            s.add(show)
            shows.append(show)
        s.flush()

        # Add work_origin to some shows
        wo_original = lv("work_origin", "original")
        wo_adaptation = lv("work_origin", "adaptation")
        wo_revival = lv("work_origin", "revival")

        # Hamilton, Hadestown, Stereophonic, Suffs, A Strange Loop are originals
        shows[0].work_origin_id = wo_original  # Hamilton
        shows[1].work_origin_id = wo_original  # Hadestown
        shows[6].work_origin_id = wo_original  # Stereophonic
        shows[7].work_origin_id = wo_original  # Suffs
        shows[10].work_origin_id = wo_original  # A Strange Loop
        # The Outsiders, Jagged Little Pill are adaptations
        shows[8].work_origin_id = wo_adaptation  # The Outsiders
        shows[13].work_origin_id = wo_adaptation  # Jagged Little Pill
        # Oklahoma!, Merrily, A Doll's House are revivals
        shows[5].work_origin_id = wo_revival  # A Doll's House
        shows[9].work_origin_id = wo_revival  # Merrily We Roll Along
        shows[16].work_origin_id = wo_revival  # Oklahoma!

        def showid(title):
            return next(sh.id for sh in shows if sh.title == title)

        # ==================== PRODUCTIONS ====================
        prods_data = [
            ("Hamilton", showid("Hamilton"), vid("Richard Rodgers Theatre"), 2015, scale_broadway, "Cultural phenomenon. Ongoing."),
            ("Hadestown", showid("Hadestown"), vid("New York Theatre Workshop"), 2019, scale_broadway, "Started Off-Broadway, transferred to Broadway."),
            ("The Lehman Trilogy", showid("The Lehman Trilogy"), vid("Bernard B. Jacobs Theatre"), 2023, scale_broadway, "National Theatre transfer."),
            ("Dear Evan Hansen", showid("Dear Evan Hansen"), vid("Booth Theatre"), 2016, scale_broadway, "Closed 2022 after 1,678 performances."),
            ("The Band's Visit", showid("The Band's Visit"), vid("Atlantic Theater Company"), 2017, scale_broadway, "10 Tony Awards."),
            ("A Doll's House", showid("A Doll's House"), None, 2023, scale_broadway, "Jessica Chastain. Limited run."),
            ("Stereophonic", showid("Stereophonic"), None, 2024, scale_broadway, "David Adjmi. Record 13 Tony nominations."),
            ("Suffs", showid("Suffs"), None, 2024, scale_broadway, "Shaina Taub. Women's suffrage musical."),
            ("The Outsiders", showid("The Outsiders"), None, 2024, scale_broadway, "Danya Taymor direction."),
            ("Merrily We Roll Along", showid("Merrily We Roll Along"), None, 2023, scale_broadway, "Jonathan Groff, Daniel Radcliffe, Lindsay Mendez."),
            ("A Strange Loop", showid("A Strange Loop"), None, 2022, scale_broadway, "Michael R. Jackson. Pulitzer Prize winner."),
            ("Between Riverside and Crazy", showid("Between Riverside and Crazy"), None, 2023, scale_offbway, "Stephen Adly Guirgis. Pulitzer."),
            ("Fat Ham", showid("Fat Ham"), None, 2023, scale_offbway, "James Ijames. Hamlet reimagining."),
            ("Jagged Little Pill", showid("Jagged Little Pill"), vid("St. James Theatre"), 2019, scale_broadway, "Alanis Morissette musical."),
            ("What the Constitution Means to Me", showid("What the Constitution Means to Me"), None, 2019, scale_offbway, "Heidi Schreck. Broadway transfer."),
            ("Harry Potter and the Cursed Child", showid("Harry Potter and the Cursed Child"), None, 2018, scale_broadway, "Two-part play, later condensed."),
            ("Oklahoma!", showid("Oklahoma!"), None, 2019, scale_broadway, "Daniel Fish revival. Dark reimagining."),
            ("The Minutes", showid("The Minutes"), None, 2022, scale_broadway, "Tracy Letts. Steppenwolf transfer."),
            ("Cost of Living", showid("Cost of Living"), None, 2022, scale_offbway, "Martyna Majok. Pulitzer."),
            ("Leopoldstadt", showid("Leopoldstadt"), None, 2022, scale_broadway, "Tom Stoppard. Tony winner."),
        ]
        productions = []
        for title, show_id, v_id, year, sc_id, notes in prods_data:
            prod = Production(show_id=show_id, title=title, venue_id=v_id, year=year, scale_id=sc_id, description=notes)
            s.add(prod)
            productions.append(prod)
        s.flush()

        # Add production fields to some productions
        pt_world_premiere = lv("production_type", "world_premiere")
        pt_transfer = lv("production_type", "transfer")
        pt_revival = lv("production_type", "revival")
        bt_30m_plus = lv("budget_tier", "30m_plus")
        bt_15m_30m = lv("budget_tier", "15m_30m")
        bt_5m_15m = lv("budget_tier", "5m_15m")
        bt_2m_5m = lv("budget_tier", "2m_5m")
        ft_commercial = lv("funding_type", "commercial")
        ft_nonprofit = lv("funding_type", "nonprofit")
        ft_coprod = lv("funding_type", "co_production")

        productions[0].production_type_id = pt_world_premiere  # Hamilton
        productions[0].capitalization = 12500000
        productions[0].budget_tier_id = bt_5m_15m
        productions[0].recouped = True
        productions[0].funding_type_id = ft_commercial

        productions[1].production_type_id = pt_transfer  # Hadestown
        productions[1].capitalization = 11000000
        productions[1].budget_tier_id = bt_5m_15m
        productions[1].recouped = True
        productions[1].funding_type_id = ft_commercial

        productions[5].production_type_id = pt_revival  # A Doll's House
        productions[5].capitalization = 4000000
        productions[5].budget_tier_id = bt_2m_5m
        productions[5].funding_type_id = ft_commercial

        productions[6].production_type_id = pt_world_premiere  # Stereophonic
        productions[6].capitalization = 3500000
        productions[6].budget_tier_id = bt_2m_5m
        productions[6].funding_type_id = ft_coprod

        def prodid(title):
            return next(p.id for p in productions if p.title == title)

        # ==================== PRODUCER ↔ SHOW (IP-level) ====================
        ps_links = [
            (pid("Jeffrey", "Seller"), showid("Hamilton"), role_ps_rights.id),
            (pid("Jeffrey", "Seller"), showid("Hamilton"), role_ps_lead.id),
            (pid("Mara", "Isaacs"), showid("Hadestown"), role_ps_lead.id),
            (pid("Orin", "Wolf"), showid("Dear Evan Hansen"), role_ps_lead.id),
            (pid("Orin", "Wolf"), showid("The Band's Visit"), role_ps_lead.id),
            (pid("Greg", "Nobile"), showid("Stereophonic"), role_ps_lead.id),
            (pid("Greg", "Nobile"), showid("Suffs"), role_ps_lead.id),
            (pid("Barbara", "Whitman"), showid("A Strange Loop"), role_ps_lead.id),
            (pid("Sonia", "Friedman"), showid("Harry Potter and the Cursed Child"), role_ps_rights.id),
            (pid("Sonia", "Friedman"), showid("Leopoldstadt"), role_ps_lead.id),
            (pid("Tom", "Kirdahy"), showid("The Minutes"), role_ps_lead.id),
            (pid("Rashad", "Chambers"), showid("Fat Ham"), role_ps_lead.id),
            (pid("Jenny", "Gersten"), showid("What the Constitution Means to Me"), role_ps_dev.id),
            (pid("Eva", "Price"), showid("Oklahoma!"), role_ps_lead.id),
        ]
        for p_id, sh_id, r_id in ps_links:
            s.add(ProducerShow(producer_id=p_id, show_id=sh_id, role_id=r_id))

        # ==================== PRODUCER ↔ PRODUCTION ====================
        pp_links = [
            (pid("Jeffrey", "Seller"), prodid("Hamilton"), role_pp_lead.id),
            (pid("Jordan", "Roth"), prodid("Hamilton"), role_pp_co.id),
            (pid("Mara", "Isaacs"), prodid("Hadestown"), role_pp_lead.id),
            (pid("Jordan", "Roth"), prodid("Hadestown"), role_pp_co.id),
            (pid("Jordan", "Roth"), prodid("The Lehman Trilogy"), role_pp_lead.id),
            (pid("Orin", "Wolf"), prodid("Dear Evan Hansen"), role_pp_lead.id),
            (pid("Orin", "Wolf"), prodid("The Band's Visit"), role_pp_lead.id),
            (pid("Eva", "Price"), prodid("A Doll's House"), role_pp_lead.id),
            (pid("Greg", "Nobile"), prodid("Stereophonic"), role_pp_lead.id),
            (pid("Greg", "Nobile"), prodid("Suffs"), role_pp_lead.id),
            (pid("Greg", "Nobile"), prodid("The Outsiders"), role_pp_lead.id),
            (pid("Barbara", "Whitman"), prodid("Suffs"), role_pp_co.id),
            (pid("Barbara", "Whitman"), prodid("A Strange Loop"), role_pp_lead.id),
            (pid("Hunter", "Arnold"), prodid("Dear Evan Hansen"), role_pp_co.id),
            (pid("Hunter", "Arnold"), prodid("Merrily We Roll Along"), role_pp_lead.id),
            (pid("Hunter", "Arnold"), prodid("The Outsiders"), role_pp_co.id),
            (pid("Sonia", "Friedman"), prodid("The Lehman Trilogy"), role_pp_lead.id),
            (pid("Sonia", "Friedman"), prodid("Harry Potter and the Cursed Child"), role_pp_lead.id),
            (pid("Sonia", "Friedman"), prodid("Leopoldstadt"), role_pp_lead.id),
            (pid("Sonia", "Friedman"), prodid("Merrily We Roll Along"), role_pp_co.id),
            (pid("Rashad", "Chambers"), prodid("Fat Ham"), role_pp_lead.id),
            (pid("Rashad", "Chambers"), prodid("A Strange Loop"), role_pp_co.id),
            (pid("Jenny", "Gersten"), prodid("What the Constitution Means to Me"), role_pp_lead.id),
            (pid("Jenny", "Gersten"), prodid("Between Riverside and Crazy"), role_pp_co.id),
            (pid("Tom", "Kirdahy"), prodid("The Minutes"), role_pp_lead.id),
            (pid("Tom", "Kirdahy"), prodid("Leopoldstadt"), role_pp_co.id),
            (pid("Dori", "Berinstein"), prodid("The Band's Visit"), role_pp_co.id),
            (pid("Sue", "Wagner"), prodid("Jagged Little Pill"), role_pp_co.id),
            (pid("Eva", "Price"), prodid("Oklahoma!"), role_pp_co.id),
            (pid("Scott", "Rudin"), prodid("The Lehman Trilogy"), role_pp_co.id),
            (pid("Scott", "Rudin"), prodid("A Doll's House"), role_pp_co.id),
        ]
        for p_id, prod_id, r_id in pp_links:
            s.add(ProducerProduction(producer_id=p_id, production_id=prod_id, role_id=r_id))

        # ==================== PRODUCER ↔ ORGANIZATION ====================
        po_links = [
            (pid("Greg", "Nobile"), oid("Seaview Productions"), "Founder", date(2016, 1, 1), None),
            (pid("Jordan", "Roth"), oid("Roundabout Theatre Company"), "Board Member", date(2010, 1, 1), None),
            (pid("Mara", "Isaacs"), oid("Lincoln Center Theater"), "Resident Director", date(2015, 6, 1), date(2019, 12, 31)),
            (pid("Jenny", "Gersten"), oid("Public Theater"), "Associate Artistic Director", date(2018, 1, 1), None),
            (pid("Tom", "Kirdahy"), oid("Manhattan Theatre Club"), "Board Member", date(2019, 1, 1), None),
            (pid("Rashad", "Chambers"), oid("Second Stage Theater"), "Producing Fellow", date(2017, 9, 1), date(2019, 6, 30)),
            (pid("Dori", "Berinstein"), oid("Williamstown Theatre Festival"), "Guest Producer", date(2020, 6, 1), date(2020, 8, 31)),
            (pid("Sue", "Wagner"), oid("Level Forward"), "Producer", date(2019, 1, 1), None),
            (pid("Barbara", "Whitman"), oid("Second Stage Theater"), "Board Member", date(2020, 1, 1), None),
            (pid("Eva", "Price"), oid("The Araca Group"), "Partner", date(2014, 1, 1), date(2020, 12, 31)),
            (pid("Hunter", "Arnold"), oid("Foresight Theatrical"), "Associate", date(2015, 1, 1), date(2018, 12, 31)),
        ]
        for p_id, o_id, role, start, end in po_links:
            s.add(ProducerOrganization(producer_id=p_id, organization_id=o_id, role_title=role, start_date=start, end_date=end))

        # ==================== TAGS ====================
        tags_data = [
            ("Tony winner", "Has won at least one Tony Award as a lead or co-producer"),
            ("rising star", "Emerging producer gaining momentum and visibility in the industry"),
            ("new work champion", "Consistently develops and produces original new works"),
            ("commercial powerhouse", "Track record of commercially successful productions"),
            ("nonprofit leader", "Significant leadership role in nonprofit theatre"),
            ("international", "Active in international producing or transatlantic transfers"),
            ("BIPOC voices", "Committed to amplifying stories by and about people of color"),
            ("female-led", "Focuses on female-driven stories and creative teams"),
            ("immersive", "Interested in or experienced with immersive and site-specific theatre"),
            ("musical theatre", "Primary focus on musical theatre productions"),
            ("straight play", "Primary focus on non-musical plays"),
            ("development", "Active in early-stage development of new theatrical works"),
            ("revival specialist", "Known for producing notable revivals of classic works"),
            ("Off-Broadway", "Significant body of work in the Off-Broadway space"),
        ]
        tags = {}
        for name, desc in tags_data:
            t = Tag(name=name, description=desc)
            s.add(t)
            tags[name] = t
        s.flush()

        # ==================== PRODUCER ↔ TAGS ====================
        pt_links = [
            (pid("Jordan", "Roth"), ["Tony winner", "commercial powerhouse", "revival specialist"]),
            (pid("Jeffrey", "Seller"), ["Tony winner", "commercial powerhouse", "musical theatre"]),
            (pid("Mara", "Isaacs"), ["Tony winner", "new work champion", "immersive"]),
            (pid("Orin", "Wolf"), ["Tony winner", "musical theatre"]),
            (pid("Greg", "Nobile"), ["rising star", "new work champion", "BIPOC voices"]),
            (pid("Barbara", "Whitman"), ["female-led", "new work champion", "Off-Broadway"]),
            (pid("Hunter", "Arnold"), ["commercial powerhouse", "musical theatre"]),
            (pid("Sonia", "Friedman"), ["Tony winner", "international", "commercial powerhouse"]),
            (pid("Rashad", "Chambers"), ["rising star", "BIPOC voices", "new work champion"]),
            (pid("Jenny", "Gersten"), ["new work champion", "nonprofit leader", "straight play"]),
            (pid("Tom", "Kirdahy"), ["Tony winner", "straight play"]),
            (pid("Dori", "Berinstein"), ["musical theatre", "development"]),
            (pid("Eva", "Price"), ["commercial powerhouse", "musical theatre"]),
            (pid("Sue", "Wagner"), ["female-led", "musical theatre"]),
            (pid("Scott", "Rudin"), ["Tony winner", "commercial powerhouse", "straight play"]),
        ]
        for p_id, tag_list in pt_links:
            for tname in tag_list:
                s.add(ProducerTag(producer_id=p_id, tag_id=tags[tname].id))

        # ==================== AWARDS ====================
        awards_data = [
            (pid("Jeffrey", "Seller"), prodid("Hamilton"), "Tony Award", "Best Musical", 2016, outcome_won),
            (pid("Jeffrey", "Seller"), prodid("Hamilton"), "Pulitzer Prize", "Drama", 2016, outcome_won),
            (pid("Mara", "Isaacs"), prodid("Hadestown"), "Tony Award", "Best Musical", 2019, outcome_won),
            (pid("Orin", "Wolf"), prodid("Dear Evan Hansen"), "Tony Award", "Best Musical", 2017, outcome_won),
            (pid("Orin", "Wolf"), prodid("The Band's Visit"), "Tony Award", "Best Musical", 2018, outcome_won),
            (pid("Jordan", "Roth"), prodid("The Lehman Trilogy"), "Tony Award", "Best Play", 2023, outcome_nominated),
            (pid("Greg", "Nobile"), prodid("Stereophonic"), "Tony Award", "Best Play", 2024, outcome_won),
            (pid("Greg", "Nobile"), prodid("Suffs"), "Tony Award", "Best Musical", 2024, outcome_nominated),
            (pid("Barbara", "Whitman"), prodid("A Strange Loop"), "Tony Award", "Best Musical", 2022, outcome_won),
            (pid("Barbara", "Whitman"), prodid("A Strange Loop"), "Pulitzer Prize", "Drama", 2020, outcome_won),
            (pid("Hunter", "Arnold"), prodid("Dear Evan Hansen"), "Tony Award", "Best Musical", 2017, outcome_won),
            (pid("Hunter", "Arnold"), prodid("Merrily We Roll Along"), "Tony Award", "Best Revival of a Musical", 2024, outcome_won),
            (pid("Sonia", "Friedman"), prodid("Harry Potter and the Cursed Child"), "Tony Award", "Best Play", 2018, outcome_won),
            (pid("Sonia", "Friedman"), prodid("Leopoldstadt"), "Tony Award", "Best Play", 2023, outcome_won),
            (pid("Tom", "Kirdahy"), prodid("The Minutes"), "Tony Award", "Best Play", 2022, outcome_nominated),
            (pid("Rashad", "Chambers"), prodid("Fat Ham"), "Tony Award", "Best Play", 2023, outcome_nominated),
            (pid("Rashad", "Chambers"), prodid("Fat Ham"), "Pulitzer Prize", "Drama", 2022, outcome_won),
            (pid("Dori", "Berinstein"), prodid("The Band's Visit"), "Tony Award", "Best Musical", 2018, outcome_won),
            (pid("Eva", "Price"), prodid("Oklahoma!"), "Tony Award", "Best Revival of a Musical", 2019, outcome_won),
        ]
        for p_id, prod_id, award, cat, year, outcome in awards_data:
            s.add(Award(producer_id=p_id, production_id=prod_id, award_name=award, category=cat, year=year, outcome_id=outcome))

        # ==================== EMAILS ====================
        emails_data = [
            ("producer", pid("Jordan", "Roth"), "jordan@jujamcyn.com", email_work, "manual", None, True),
            ("producer", pid("Jeffrey", "Seller"), "jeff@sellerjams.com", email_work, "manual", None, True),
            ("producer", pid("Mara", "Isaacs"), "mara@octopustheatricals.com", email_work, "manual", None, True),
            ("producer", pid("Greg", "Nobile"), "greg@seaviewproductions.com", email_work, "manual", None, True),
            ("producer", pid("Greg", "Nobile"), "gnobile@gmail.com", email_personal, "manual", None, False),
            ("producer", pid("Eva", "Price"), "eva@evaprice.com", email_work, "manual", None, True),
            ("producer", pid("Hunter", "Arnold"), "hunter@hunterarnold.com", email_work, "manual", None, True),
            ("producer", pid("Sonia", "Friedman"), "sonia@soniafriedman.com", email_work, "manual", None, True),
            ("producer", pid("Rashad", "Chambers"), "rashad.chambers@gmail.com", email_personal, "manual", None, True),
            ("producer", pid("Tom", "Kirdahy"), "tom.kirdahy@gmail.com", email_personal, "manual", None, True),
            ("producer", pid("Barbara", "Whitman"), "barbara@whitmanproductions.com", email_work, "manual", None, True),
            ("organization", oid("Seaview Productions"), "info@seaviewproductions.com", None, "manual", None, True),
            ("organization", oid("Public Theater"), "submissions@publictheater.org", None, "manual", None, True),
            ("organization", oid("Manhattan Theatre Club"), "info@mtc-nyc.org", None, "manual", None, True),
        ]
        for etype, eid, email, type_id, source, confidence, primary in emails_data:
            s.add(EntityEmail(
                entity_type=etype, entity_id=eid, email=email,
                type_id=type_id, source=source, confidence=confidence, is_primary=primary,
            ))

        # ==================== SOCIAL LINKS ====================
        socials_data = [
            ("producer", pid("Jordan", "Roth"), plat_instagram, "https://instagram.com/jordanroth"),
            ("producer", pid("Jordan", "Roth"), plat_twitter, "https://x.com/jordanroth"),
            ("producer", pid("Jeffrey", "Seller"), plat_linkedin, "https://linkedin.com/in/jeffreyseller"),
            ("producer", pid("Mara", "Isaacs"), plat_instagram, "https://instagram.com/maraisaacs"),
            ("producer", pid("Greg", "Nobile"), plat_instagram, "https://instagram.com/gregnobile"),
            ("producer", pid("Greg", "Nobile"), plat_twitter, "https://x.com/gregnobile"),
            ("producer", pid("Hunter", "Arnold"), plat_instagram, "https://instagram.com/hunterarnold"),
            ("producer", pid("Sonia", "Friedman"), plat_instagram, "https://instagram.com/soniafriedmanproductions"),
            ("producer", pid("Sonia", "Friedman"), plat_twitter, "https://x.com/SFP_London"),
            ("producer", pid("Rashad", "Chambers"), plat_linkedin, "https://linkedin.com/in/rashadchambers"),
            ("organization", oid("Public Theater"), plat_instagram, "https://instagram.com/publictheaterny"),
            ("organization", oid("Seaview Productions"), plat_instagram, "https://instagram.com/seaviewproductions"),
        ]
        for etype, eid, plat_id, url in socials_data:
            if plat_id:
                s.add(EntitySocialLink(entity_type=etype, entity_id=eid, platform_id=plat_id, url=url))

        # ==================== INTERACTIONS ====================
        interactions_data = [
            (pid("Jordan", "Roth"), _days_ago(5), "Met at opening night of new revival. Discussed potential collaboration on immersive experiences. Very interested in non-traditional formats.", "Husani"),
            (pid("Jordan", "Roth"), _days_ago(45), "Coffee at Joe Allen's. Talked about the state of Broadway post-pandemic. He's bullish on new musicals with diverse creative teams.", "Husani"),
            (pid("Jeffrey", "Seller"), _days_ago(12), "Brief conversation at Broadway League event. He mentioned looking for new musical projects with strong book writers.", "Husani"),
            (pid("Mara", "Isaacs"), _days_ago(3), "Long phone call about Hadestown's continued success and what she's looking for next. Very interested in folk-influenced new musicals.", "Husani"),
            (pid("Mara", "Isaacs"), _days_ago(60), "Met at NAMT conference. She gave a great talk about development pipelines. Exchanged cards.", "Husani"),
            (pid("Greg", "Nobile"), _days_ago(7), "Zoom call to discuss the current season. Greg is expanding Seaview's slate and actively looking for new work. Mentioned interest in plays about technology and humanity.", "Husani"),
            (pid("Greg", "Nobile"), _days_ago(30), "Ran into him at Stereophonic. Brief chat about what's working on Broadway right now.", "Husani"),
            (pid("Greg", "Nobile"), _days_ago(90), "Initial outreach email. He responded warmly and suggested a call.", "Husani"),
            (pid("Barbara", "Whitman"), _days_ago(20), "Lunch meeting. Barbara is very focused on female-driven stories. She's looking for intimate musicals that could work Off-Broadway first.", "Husani"),
            (pid("Hunter", "Arnold"), _days_ago(15), "Quick call. Hunter is interested in big commercial musicals with pop sensibility. Also looking at IP-based properties.", "Husani"),
            (pid("Sonia", "Friedman"), _days_ago(40), "Video call, London to New York. Discussed transatlantic producing. She's interested in American new works that could play the West End.", "Husani"),
            (pid("Rashad", "Chambers"), _days_ago(8), "Coffee in Brooklyn. Rashad is passionate about amplifying Black playwrights. Looking for bold, joyful stories. Great energy.", "Husani"),
            (pid("Tom", "Kirdahy"), _days_ago(25), "Dinner with Tom. He talked about Terrence McNally's legacy and his commitment to LGBTQ+ stories on Broadway.", "Husani"),
            (pid("Eva", "Price"), _days_ago(35), "Met at a fundraiser. Eva has a sharp commercial eye — knows what sells. Interested in family-friendly musicals.", "Husani"),
        ]
        interaction_objs = []
        for p_id, dt, content, author in interactions_data:
            ix = Interaction(producer_id=p_id, date=dt, content=content, author=author)
            s.add(ix)
            interaction_objs.append(ix)
        s.flush()

        # ==================== FOLLOW-UP SIGNALS ====================
        followups_data = [
            (interaction_objs[0].id, pid("Jordan", "Roth"), "Send deck about immersive theatre concepts", "next week", _days_ago(-2)),
            (interaction_objs[2].id, pid("Jeffrey", "Seller"), "Follow up about book writer-driven musicals", "2 weeks", _days_ago(-2)),
            (interaction_objs[3].id, pid("Mara", "Isaacs"), "Send folk musical demo recordings", "this week", _days_ago(0)),
            (interaction_objs[5].id, pid("Greg", "Nobile"), "Share script of technology-themed play", "2 weeks", _days_ago(-7)),
            (interaction_objs[8].id, pid("Barbara", "Whitman"), "Send intimate musical workshop recording", "next month", _days_ago(-10)),
            (interaction_objs[9].id, pid("Hunter", "Arnold"), "Connect re: IP-based musical concept", "3 weeks", _days_ago(-6)),
            (interaction_objs[10].id, pid("Sonia", "Friedman"), "Send materials for transatlantic consideration", "1 month", _days_ago(5)),
            (interaction_objs[11].id, pid("Rashad", "Chambers"), "Follow up with script package", "next week", _days_ago(-1)),
        ]
        for ix_id, p_id, action, timeframe, due in followups_data:
            s.add(FollowUpSignal(
                interaction_id=ix_id, producer_id=p_id,
                implied_action=action, timeframe=timeframe, due_date=due,
            ))

        # Update producer relationship state fields
        for p in producers:
            ixs = [ix for ix in interaction_objs if ix.producer_id == p.id]
            if ixs:
                p.interaction_count = len(ixs)
                p.last_contact_date = max(ix.date for ix in ixs)

        s.commit()
        print(f"Seeded: {len(producers)} producers, {len(orgs)} organizations, "
              f"{len(venues)} venues, {len(shows)} shows, {len(productions)} productions, "
              f"{len(tags)} tags, {len(awards_data)} awards, "
              f"{len(interactions_data)} interactions, {len(followups_data)} follow-ups, "
              f"{len(ps_links)} producer-show links")


if __name__ == "__main__":
    main()
