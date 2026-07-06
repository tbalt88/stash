"""Which model key a cloud-agent turn runs on.

The managed (server-owned) keys let paid users run the agent on our dime.
Resolution, mirroring Fleet's resolveUserKey but managed-only for now:

  - local dev exec  → no key; the dev machine's own harness login applies.
  - paid account    → the managed key for the run's provider (fail loud if the
                      server hasn't configured one).
  - free account    → 402: upgrade to Pro. (Bring-your-own-key is the
                      fast-follow that lifts this gate.)

Each harness has a default provider; a provider maps to one managed key and
one env var the CLI reads it from.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from ..config import settings
from . import billing_service


class NeedsProError(Exception):
    """A free account tried to run the managed cloud agent."""


class ProviderNotConfigured(Exception):
    """No managed key is configured for the run's provider."""


@dataclass(frozen=True)
class Provider:
    id: str
    env_var: str  # what the harness CLI reads the key from


ANTHROPIC = Provider("anthropic", "ANTHROPIC_API_KEY")
OPENAI = Provider("openai", "OPENAI_API_KEY")
OPENROUTER = Provider("openrouter", "OPENROUTER_API_KEY")
GEMINI = Provider("gemini", "GEMINI_API_KEY")


def _managed_key(provider: Provider) -> str | None:
    if provider is ANTHROPIC:
        return settings.ANTHROPIC_API_KEY
    if provider is OPENAI:
        return settings.OPENAI_API_KEY
    if provider is OPENROUTER:
        return settings.OPENROUTER_API_KEY
    if provider is GEMINI:
        return settings.MANAGED_GEMINI_API_KEY
    raise ValueError(f"unknown provider: {provider.id}")


async def turn_env(user_id: UUID, provider: Provider) -> dict[str, str]:
    """The provider env vars for one agent turn.

    Raises domain errors (NeedsProError / ProviderNotConfigured) so each
    caller maps them for its surface — an HTTP 402/503 for web chat, a
    friendly upgrade message for Slack/Telegram.
    """
    # Local dev runs the machine's own harness login; no key injection.
    if settings.AGENT_EXEC_MODE == "local":
        return {}

    if not await billing_service.is_pro(user_id):
        raise NeedsProError

    key = _managed_key(provider)
    if not key:
        raise ProviderNotConfigured(provider.id)
    return {provider.env_var: key}
