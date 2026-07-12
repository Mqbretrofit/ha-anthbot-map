"""Data coordinator for Anthbot Genie."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import (
    AnthbotBoundDevice,
    AnthbotCloudApiClient,
    AnthbotGenieApiError,
    AnthbotShadowApiClient,
)
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

_LIVE_STATUS_VALUES = {
    "globalmowing",
    "zonemowing",
    "pointmowing",
    "bordermowing",
    "regionmowing",
    "nestmowing",
    "mowing",
    "gototarget",
    "remotectrl",
}


def _is_live_position_state(data: dict[str, Any]) -> bool:
    robot_sta = data.get("robot_sta")
    if isinstance(robot_sta, dict):
        value = robot_sta.get("value")
        if isinstance(value, str):
            return value.lower() in _LIVE_STATUS_VALUES
    status = data.get("mower_status")
    return isinstance(status, str) and status.lower() in _LIVE_STATUS_VALUES


class AnthbotGenieDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to fetch and cache Anthbot shadow state."""

    def __init__(
        self,
        hass: HomeAssistant,
        *,
        account_client: AnthbotCloudApiClient,
        client: AnthbotShadowApiClient,
        device: AnthbotBoundDevice,
        update_interval: timedelta,
    ) -> None:
        super().__init__(
            hass,
            logger=logging.getLogger(__name__),
            name=DOMAIN,
            update_interval=update_interval,
        )
        self.account_client = account_client
        self.client = client
        self.device = device
        self._area_definition: dict[str, Any] = {}
        self._map_definition: dict[str, Any] | list[Any] | None = None
        self._path_definition: dict[str, Any] | list[Any] | None = None
        self._map_definition_error: str | None = None
        self._path_definition_error: str | None = None
        self._last_area_time: str | None = None
        self._last_map_time: str | None = None
        self._last_path_time: str | None = None

    @property
    def reported_state(self) -> dict[str, Any]:
        """Return the latest reported state."""
        return self.data if isinstance(self.data, dict) else {}

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch the latest state from the cloud endpoint."""
        try:
            property_state = await self.client.async_get_shadow_reported_state()
            if _is_live_position_state(property_state):
                try:
                    await self.client.async_request_all_properties()
                    await asyncio.sleep(0.5)
                    property_state = await self.client.async_get_shadow_reported_state()
                except AnthbotGenieApiError as err:
                    _LOGGER.debug(
                        "Live Anthbot property request failed for %s: %s",
                        self.client.serial_number,
                        err,
                    )
            try:
                service_state = await self.client.async_get_service_reported_state()
            except AnthbotGenieApiError:
                service_state = {}

            area_time = property_state.get("area_time")
            if not isinstance(area_time, str):
                area_time = None
            map_time = property_state.get("map_time")
            if not isinstance(map_time, str):
                map_time = None
            path_time = property_state.get("path_time")
            if not isinstance(path_time, str):
                path_time = None

            should_refresh_area = not self._area_definition or (
                area_time is not None and area_time != self._last_area_time
            )
            if should_refresh_area:
                try:
                    self._area_definition = (
                        await self.account_client.async_get_device_area_definition(
                            self.client.serial_number
                        )
                    )
                    
                    _LOGGER.warning(
                        "ANTHBOT AREA DEFINITION:\n%s",
                        self._area_definition,
                    )
                    self._last_area_time = area_time
                except AnthbotGenieApiError:
                    if not self._area_definition:
                        self._area_definition = {}

            should_refresh_map = self._map_definition is None or (
                map_time is not None and map_time != self._last_map_time
            )
            if should_refresh_map:
                try:
                    self._map_definition = (
                        await self.account_client.async_get_device_map_definition(
                            self.client.serial_number
                        )
                    )
                    _LOGGER.warning(
                        "ANTHBOT MAP DEFINITION:\n%s",
                        self._map_definition,
                    )
                    self._map_definition_error = None
                    self._last_map_time = map_time
                except Exception as err:  # noqa: BLE001 - discovery probe must never break polling.
                    _LOGGER.debug(
                        "Anthbot map definition unavailable for %s: %s",
                        self.client.serial_number,
                        err,
                    )
                    self._map_definition_error = str(err)
                    if self._map_definition is None:
                        self._map_definition = {}
                    self._last_map_time = map_time

            should_refresh_path = self._path_definition is None or (
                path_time is not None and path_time != self._last_path_time
            )
            if should_refresh_path:
                try:
                    self._path_definition = (
                        await self.account_client.async_get_device_path_definition(
                            self.client.serial_number
                        )
                    )
                    _LOGGER.warning(
                        "ANTHBOT PATH DEFINITION:\n%s",
                        self._path_definition,
                    )
                    self._path_definition_error = None
                    self._last_path_time = path_time
                except Exception as err:  # noqa: BLE001 - discovery probe must never break polling.
                    _LOGGER.debug(
                        "Anthbot path definition unavailable for %s: %s",
                        self.client.serial_number,
                        err,
                    )
                    self._path_definition_error = str(err)
                    if self._path_definition is None:
                        self._path_definition = {}
                    self._last_path_time = path_time

            merged_state = dict(property_state)
            merged_state["_service_reported"] = service_state
            merged_state["_area_definition"] = self._area_definition
            merged_state["_map_definition"] = self._map_definition
            merged_state["_path_definition"] = self._path_definition
            merged_state["_map_definition_error"] = self._map_definition_error
            merged_state["_path_definition_error"] = self._path_definition_error
            return merged_state
        except AnthbotGenieApiError as err:
            raise UpdateFailed(str(err)) from err
