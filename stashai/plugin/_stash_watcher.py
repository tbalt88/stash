"""Background watcher: monitors the Claude Code process and progressively
uploads the transcript while the session is running. After exit, uploads
final transcript, artifacts, and generates the summary.

The stash is created eagerly at session start so the URL is known immediately.
This watcher fills in the content as the session progresses.

argv: script.py <claude_pid> <session_id> <workspace_id> <agent_name>
                <base_url> <api_key> <cwd> <data_dir> <stash_id>
"""

import json
import os
import sys
import time
from pathlib import Path

UPLOAD_INTERVAL = 30


def _is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _find_transcript(session_id: str) -> str:
    transcript_dir = Path.home() / ".claude" / "projects"
    if not transcript_dir.is_dir():
        return ""
    for d in transcript_dir.iterdir():
        if not d.is_dir():
            continue
        candidate = d / f"{session_id}.jsonl"
        if candidate.is_file():
            return str(candidate)
    return ""


def _upload_transcript(client, stash_id: str, transcript_path: Path) -> bool:
    try:
        client.upload_stash_transcript(stash_id, transcript_path)
        return True
    except Exception:
        return False


def main() -> None:
    (_, claude_pid_str, session_id, workspace_id, agent_name,
     base_url, api_key, cwd, data_dir, stash_id) = sys.argv

    claude_pid = int(claude_pid_str)

    if not stash_id:
        return

    from stashai.plugin.stash_client import StashClient

    transcript_path = ""
    last_upload_size = 0
    last_upload_time = 0

    with StashClient(base_url=base_url, api_key=api_key) as client:
        # Poll until Claude Code exits, uploading transcript periodically
        while _is_alive(claude_pid):
            now = time.monotonic()

            if not transcript_path:
                transcript_path = _find_transcript(session_id)

            if transcript_path and now - last_upload_time >= UPLOAD_INTERVAL:
                tp = Path(transcript_path)
                if tp.is_file():
                    current_size = tp.stat().st_size
                    if current_size > last_upload_size:
                        if _upload_transcript(client, stash_id, tp):
                            last_upload_size = current_size
                            last_upload_time = now

            time.sleep(1)

        # Session ended — final upload
        if not transcript_path:
            transcript_path = _find_transcript(session_id)

        if not transcript_path:
            return

        tp = Path(transcript_path)
        if tp.is_file():
            _upload_transcript(client, stash_id, tp)

    # Upload artifacts and generate summary in a separate process
    stats_path = Path(data_dir) / "stats.json"
    files_touched: list[str] = []
    if stats_path.is_file():
        try:
            stats = json.loads(stats_path.read_text())
            files_touched = stats.get("files_touched", stats.get("files_changed", []))
        except Exception:
            pass

    from stashai.plugin.stash_upload import spawn_stash_upload

    spawn_stash_upload(
        stash_id=stash_id,
        transcript_path=transcript_path,
        cwd=cwd,
        files_touched=files_touched,
        workspace_id=workspace_id,
        agent_name=agent_name,
        base_url=base_url,
        api_key=api_key,
    )


if __name__ == "__main__":
    main()
