from backend.services.session_title_service import title_from_summary


def test_title_from_summary_skips_generic_markdown_heading():
    title = title_from_summary(
        "## Session Summary\n\nAdded a new API route for members. Updated tests.",
        "session-1",
    )

    assert title == "Added a new API route for members"


def test_title_from_summary_strips_inline_generic_label():
    title = title_from_summary(
        "**Session Summary:** Added member invitations to the API. Documented the route.",
        "session-1",
    )

    assert title == "Added member invitations to the API"


def test_title_from_summary_skips_generic_section_heading():
    title = title_from_summary(
        "## Session Summary\n\n### What changed\n\n- Added member invitation routes.",
        "session-1",
    )

    assert title == "Added member invitation routes"


def test_title_from_summary_skips_what_happened_heading():
    title = title_from_summary(
        "## What Happened?\n\nInvestigated API gateway latency and added tracing.",
        "session-1",
    )

    assert title == "Investigated API gateway latency and added tracing"


def test_title_from_summary_skips_empty_accomplishment_heading():
    title = title_from_summary(
        "Accomplishment:\nImplemented session title display in the sidebar.",
        "session-1",
    )

    assert title == "Implemented session title display in the sidebar"


def test_title_from_summary_skips_generic_status_line():
    title = title_from_summary(
        "Status: This session is waiting for tests.\nUpdated the session title parser.",
        "session-1",
    )

    assert title == "Updated the session title parser"


def test_title_from_summary_strips_this_session_lead_in():
    title = title_from_summary(
        "This session investigated API gateway latency and added tracing.",
        "session-1",
    )

    assert title == "Investigated API gateway latency and added tracing"


def test_title_from_summary_falls_back_to_session_id_for_empty_summary():
    assert title_from_summary("## Session Summary", "session-1") == "session-1"
