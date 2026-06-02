"""Granola integration: API-key provider (official public API).

Granola authenticates with a personal API key (`grn_…`) from the desktop app
(Settings → Connectors → API keys) — no OAuth. Notes are a connected source,
pulled into granola_notes by indexer.py via GET /notes (+ /notes/{id}).
"""

from ..registry import register_provider
from .provider import GranolaIntegration

register_provider(GranolaIntegration())
