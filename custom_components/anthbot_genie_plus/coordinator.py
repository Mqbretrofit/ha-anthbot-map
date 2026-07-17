"""Data coordinator for Anthbot Genie."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
import time
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
_LIVE_HISTORY_REFRESH_SECONDS = 5.0

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
    "working",
    "cutting",
    "edgecutting",
    "nyiras",
    "nyir",
    "munka",
    "vagas",
}

_HISTORY_PATH_URL_KEYS = {
    "hisPathUrl",
    "his_path_url",
    "recordPathUrl",
    "record_path_url",
    "historyPathUrl",
    "history_path_url",
    "pathUrl",
    "path_url",
}

_HISTORY_INFO_KEYS = {
    "history_path_info",
    "historyPathInfo",
    "hisPathUrl",
    "recordPathUrl",
    "cleanedCode",
    "CleanedCode",
    "cleanCode",
}


def _is_live_position_state(data: dict[str, Any]) -> bool:
    robot_sta = data.get("robot_sta")
    if isinstance(robot_sta, dict):
        value = robot_sta.get("value")
        if isinstance(value, str):
            return _normalize_status(value) in _LIVE_STATUS_VALUES
    elif isinstance(robot_sta, str):
        return _normalize_status(robot_sta) in _LIVE_STATUS_VALUES
    status = data.get("mower_status")
    return isinstance(status, str) and _normalize_status(status) in _LIVE_STATUS_VALUES


def _normalize_status(value: str) -> str:
    return value.lower().replace("-", "").replace("_", "").replace(" ", "")


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
        self._history_path_info: Any = None
        self._history_path_source: str | None = None
        self._last_area_time: str | None = None
        self._last_map_time: str | None = None
        self._last_path_time: str | None = None
        self._last_history_path_request: str | None = None
        self._last_history_path_request_monotonic = 0.0
        self._last_path_download_monotonic = 0.0
        self._consecutive_cloud_failures = 0

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
            now = time.monotonic()
            is_live = _is_live_position_state(property_state)

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

            should_refresh_path = (
                self._path_definition is None
                or (path_time is not None and path_time != self._last_path_time)
                or (
                    is_live
                    and now - self._last_path_download_monotonic
                    >= _LIVE_HISTORY_REFRESH_SECONDS
                )
            )
            if should_refresh_path:
                try:
                    await self._async_request_history_path(path_time, force=is_live)
                    try:
                        service_state = await self.client.async_get_service_reported_state()
                    except AnthbotGenieApiError:
                        service_state = service_state or {}
                    self._history_path_info = _find_history_info(property_state, service_state)
                    history_url = _find_history_path_url(property_state, service_state)
                    if history_url:
                        self._path_definition = (
                            await self.account_client.async_get_device_file_url(
                                history_url,
                                label="history_path",
                            )
                        )
                        self._history_path_source = "url"
                    else:
                        self._path_definition = (
                            await self.account_client.async_get_device_path_definition(
                                self.client.serial_number
                            )
                        )
                        self._history_path_source = "presigned"
                    _LOGGER.warning(
                        "ANTHBOT PATH DEFINITION:\n%s",
                        self._path_definition,
                    )
                    self._path_definition_error = None
                    self._last_path_time = path_time
                    self._last_path_download_monotonic = time.monotonic()
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
                    self._last_path_download_monotonic = time.monotonic()

            merged_state = dict(property_state)
            merged_state["_service_reported"] = service_state
            merged_state["_area_definition"] = self._area_definition
            merged_state["_map_definition"] = self._map_definition
            merged_state["_path_definition"] = self._path_definition
            merged_state["_history_path_info"] = self._history_path_info
            merged_state["_history_path_source"] = self._history_path_source
            merged_state["_history_path_live_refresh"] = is_live
            merged_state["_history_path_refresh_interval"] = _LIVE_HISTORY_REFRESH_SECONDS
            merged_state["_history_path_last_download_monotonic"] = self._last_path_download_monotonic
            merged_state["_map_definition_error"] = self._map_definition_error
            merged_state["_path_definition_error"] = self._path_definition_error
            self._consecutive_cloud_failures = 0
            return merged_state
        except AnthbotGenieApiError as err:
            self._consecutive_cloud_failures += 1
            if self.reported_state and self._consecutive_cloud_failures <= 3:
                _LOGGER.warning(
                    "Temporary Anthbot cloud failure for %s (%s/3), keeping last state: %s",
                    self.client.serial_number,
                    self._consecutive_cloud_failures,
                    err,
                )
                return self.reported_state
            raise UpdateFailed(str(err)) from err

    async def _async_request_history_path(self, path_time: str | None, *, force: bool = False) -> None:
        """Ask the mower to refresh the app-style history path before download."""
        request_key = path_time or "latest"
        now = time.monotonic()
        if (
            not force
            and self._last_history_path_request == request_key
            and now - self._last_history_path_request_monotonic
            < _LIVE_HISTORY_REFRESH_SECONDS
        ):
            return

        for cmd in ("req_history_mapping_path", "getHisPath", "ReqHisPath"):
            try:
                await self.client.async_publish_service_command(
                    cmd=cmd,
                    data={} if path_time is None else {"path_time": path_time},
                )
                await asyncio.sleep(0.8)
                self._last_history_path_request = request_key
                self._last_history_path_request_monotonic = time.monotonic()
                _LOGGER.debug(
                    "Requested Anthbot history path refresh for %s using %s",
                    self.client.serial_number,
                    cmd,
                )
                return
            except AnthbotGenieApiError as err:
                _LOGGER.debug(
                    "Anthbot history path request failed for %s using %s: %s",
                    self.client.serial_number,
                    cmd,
                    err,
                )


def _find_history_path_url(*values: Any) -> str | None:
    for value in values:
        found = _walk_for_history_url(value)
        if found:
            return found
    return None


def _walk_for_history_url(value: Any) -> str | None:
    if isinstance(value, dict):
        for key, item in value.items():
            if (
                key in _HISTORY_PATH_URL_KEYS
                and isinstance(item, str)
                and item.startswith(("http://", "https://"))
            ):
                return item
            if key in _HISTORY_INFO_KEYS:
                nested = _walk_for_history_url(item)
                if nested:
                    return nested
        for item in value.values():
            nested = _walk_for_history_url(item)
            if nested:
                return nested
    elif isinstance(value, list):
        for item in value:
            nested = _walk_for_history_url(item)
            if nested:
                return nested
    elif isinstance(value, str) and value.startswith(("http://", "https://")):
        if any(part in value.lower() for part in ("path", "history", "record")):
            return value
    return None


def _find_history_info(*values: Any) -> Any:
    for value in values:
        found = _walk_for_history_info(value)
        if found is not None:
            return found
    return None


def _walk_for_history_info(value: Any) -> Any:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in _HISTORY_INFO_KEYS:
                return item
        for item in value.values():
            found = _walk_for_history_info(item)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _walk_for_history_info(item)
            if found is not None:
                return found
    return None
