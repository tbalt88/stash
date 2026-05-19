"""Readable titles for sessions.

Session summaries are longer prose. Navigation needs a short title, so derive
one from the first useful summary line and ignore generic markdown wrappers.
"""

from __future__ import annotations

import re

MAX_TITLE_LENGTH = 80

_GENERIC_PREFIXES = (
    "session summary",
    "summary of changes",
    "summary",
    "what changed",
    "what happened",
    "what the session accomplished",
    "what was accomplished",
    "accomplishment",
    "accomplishments",
    "status",
    "session status",
    "key files modified or created",
    "key files",
    "important decisions made",
    "important decisions",
    "unfinished work or known issues",
    "known issues",
)


def title_from_summary(summary: str | None, session_id: str) -> str:
    for line in (summary or "").splitlines():
        title = _title_from_line(line)
        if title:
            return _truncate(title)
    return session_id


def _title_from_line(line: str) -> str:
    text = _strip_markdown(line)
    if not text:
        return ""

    text = _strip_generic_prefix(text)
    if not text:
        return ""

    text = _strip_generic_lead_in(text)
    if not text:
        return ""

    return _first_sentence(text)


def _strip_markdown(line: str) -> str:
    text = line.strip()
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text)
    text = re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", "", text)
    text = text.replace("**", "").replace("__", "").replace("`", "")
    return text.strip(" \t*_")


def _strip_generic_prefix(text: str) -> str:
    normalized = _normalize(text)
    for prefix in _GENERIC_PREFIXES:
        if normalized == prefix:
            return ""

    lower = text.lower()
    for prefix in _GENERIC_PREFIXES:
        if not lower.startswith(prefix):
            continue

        rest = text[len(prefix) :].lstrip(" :-–—")
        return rest.strip()

    return text


def _first_sentence(text: str) -> str:
    one_line = re.sub(r"\s+", " ", text).strip()
    sentence, separator, _ = one_line.partition(".")
    if separator:
        return sentence.strip()
    return one_line


def _truncate(title: str) -> str:
    if len(title) <= MAX_TITLE_LENGTH:
        return title
    return title[:MAX_TITLE_LENGTH]


def _strip_generic_lead_in(text: str) -> str:
    lower = text.lower()
    for phrase in ("this session just ", "this session is ", "this session was "):
        if lower.startswith(phrase):
            return ""
    if lower.startswith("this session "):
        return _capitalize_first(text[len("this session ") :].strip())
    return text


def _capitalize_first(text: str) -> str:
    if not text:
        return text
    return text[0].upper() + text[1:]


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
