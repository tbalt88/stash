"""Rich output formatting for the stash CLI."""

from __future__ import annotations

import json

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def output_json(data) -> None:
    """Print data as JSON for machine consumption."""
    print(json.dumps(data, default=str))


def format_message(msg: dict) -> str:
    """Format a single message for display."""
    sender = msg.get("sender_name", msg.get("name", "?"))
    sender_type = msg.get("sender_type", "")
    content = msg.get("content", "")
    ts = msg.get("created_at", "")
    if isinstance(ts, str) and len(ts) > 19:
        ts = ts[:19]
    tag = f" [{sender_type}]" if sender_type == "agent" else ""
    return f"[dim]{ts}[/dim] [bold]{sender}{tag}[/bold]: {content}"


def print_messages(messages: list[dict]) -> None:
    """Print a list of messages."""
    if not messages:
        console.print("[dim]No messages.[/dim]")
        return
    for msg in messages:
        console.print(format_message(msg))


def print_workspaces(workspaces: list[dict], title: str = "Workspaces") -> None:
    """Print a table of workspaces."""
    if not workspaces:
        console.print("[dim]No workspaces found.[/dim]")
        return
    table = Table(title=title)
    table.add_column("Name", style="bold")
    table.add_column("ID", style="dim")
    table.add_column("Members")
    for workspace in workspaces:
        table.add_row(
            workspace.get("name", ""),
            str(workspace.get("id", ""))[:8],
            str(workspace.get("member_count", "?")),
        )
    console.print(table)


def print_user(user: dict, title: str = "Profile") -> None:
    """Print user profile as a panel."""
    lines = [
        f"[bold]{user.get('name', '')}[/bold]",
        f"Display: {user.get('display_name', '')}",
        f"ID: {user.get('id', '')}",
    ]
    if user.get("description"):
        lines.append(f"Bio: {user['description']}")
    lines.append(f"Created: {user.get('created_at', '')}")
    lines.append(f"Last seen: {user.get('last_seen', '')}")
    console.print(Panel("\n".join(lines), title=title))


def print_members(members: list[dict]) -> None:
    """Print workspace members table."""
    if not members:
        console.print("[dim]No members.[/dim]")
        return
    table = Table(title="Members")
    table.add_column("Name", style="bold")
    table.add_column("Role")
    table.add_column("Joined")
    for m in members:
        table.add_row(
            m.get("name", ""),
            m.get("role", "member"),
            str(m.get("joined_at", ""))[:19],
        )
    console.print(table)
