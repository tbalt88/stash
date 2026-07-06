"""The user's cloud computer: interactive terminal (and later, file browsing).

The browser's WebSocket can't carry an Authorization header, so the bearer
token rides a query parameter. The backend holds both sockets and pumps
bytes between them — the Sprites org token never reaches the browser.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket
from starlette.websockets import WebSocketDisconnect

from ..auth import authenticate_token
from ..services import sprite_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/me/machine", tags=["machine"])


@router.websocket("/terminal")
async def terminal(ws: WebSocket, token: str = "", cols: int = 80, rows: int = 24):
    try:
        user = await authenticate_token(token)
    except HTTPException:
        await ws.close(code=4401, reason="Invalid token")
        return
    await ws.accept()

    try:
        sprite = await sprite_service.acquire(user["id"])
        term = await sprite_service.open_terminal(sprite, cols=cols, rows=rows)
    except Exception:
        logger.exception("terminal: failed to open shell for user %s", user["id"])
        await ws.close(code=1011, reason="Could not reach your computer")
        return

    async def pump_output() -> None:
        async for data in term.output():
            await ws.send_bytes(data)
        await ws.close(code=1000, reason="Shell exited")

    output_task = asyncio.create_task(pump_output())
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            if msg["type"] == "input":
                await term.send_input(msg["data"].encode())
            elif msg["type"] == "resize":
                await term.resize(int(msg["cols"]), int(msg["rows"]))
    except WebSocketDisconnect:
        pass
    finally:
        output_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await output_task
        await term.close()
