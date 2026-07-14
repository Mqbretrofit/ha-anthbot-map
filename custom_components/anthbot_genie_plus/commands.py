"""Reliable Anthbot command sequences."""

from __future__ import annotations

import asyncio
import logging

from .coordinator import AnthbotGenieDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_start_mowing(
    coordinator: AnthbotGenieDataUpdateCoordinator,
    *,
    app_state: int = 1,
    expected_modes: set[str] | None = None,
) -> bool:
    """Wake the mower, start it, verify the mode and retry once if needed."""
    expected = expected_modes or {"globalmowing", "mowing", "gototarget"}

    for attempt in range(2):
        await coordinator.client.async_publish_service_command(
            cmd="app_state", data=app_state
        )
        await asyncio.sleep(1.5)
        await coordinator.client.async_publish_service_command(cmd="mow_start", data=1)

        for _ in range(4):
            await asyncio.sleep(2)
            try:
                state = await coordinator.client.async_get_shadow_reported_state()
            except Exception:  # noqa: BLE001 - verification is retried below.
                continue
            robot_sta = state.get("robot_sta")
            mode = robot_sta.get("value") if isinstance(robot_sta, dict) else None
            mode = str(mode or state.get("mower_status") or "").lower()
            if mode in expected:
                await coordinator.async_request_refresh()
                return True

        _LOGGER.warning(
            "Anthbot start was not confirmed for %s (attempt %s/2)",
            coordinator.client.serial_number,
            attempt + 1,
        )

    await coordinator.async_request_refresh()
    return False
