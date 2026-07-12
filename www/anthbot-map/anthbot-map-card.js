import { AnthbotMapRenderer } from "./renderer.js?v=77";
import {
  adjustCalibration,
  cardToYaml,
  readCalibration,
  readDecodedBoundaryCalibration,
  readRobotCalibration,
  resetCalibration,
} from "./calibration.js?v=77";

const ENTITY_MAP = {
  battery: ["sensor", ["battery_level"]],
  status: ["sensor", ["mower_status"]],
  charging: ["binary_sensor", ["charging"]],
  connection: ["binary_sensor", ["connection"]],
  cuttingHeight: ["sensor", ["cutting_height"]],
  mowingArea: ["sensor", ["mowing_area_session", "mowing_area"]],
  mowingTime: ["sensor", ["mowing_time_session", "mowing_time"]],
  rtkFix: ["sensor", ["rtk_fix_state"]],
  totalArea: ["sensor", ["total_mapped_area"]],
  errorDescription: ["sensor", ["error_description"]],
  cuttingComponentsLife: ["sensor", ["cutting_components_life"]],
  cuttingLineLife: ["sensor", ["cutting_line_life"]],
  rechargeContactLife: ["sensor", ["recharge_contact_life"]],
  wifi: ["binary_sensor", ["wifi_connected"]],
  bluetooth: ["binary_sensor", ["bluetooth_active"]],
  firmware: ["sensor", ["firmware_version"]],
  gpsLatitude: ["sensor", ["gps_latitude"]],
  gpsLongitude: ["sensor", ["gps_longitude"]],
  poseYaw: ["sensor", ["pose_yaw"]],
  shadowUpdated: ["sensor", ["shadow_last_updated"]],
};

const NUMBER_MAP = {
  mowHeight: ["mow_height", "mow_height_setting", "mow height"],
  mowDirection: ["custom_mowing_direction", "custom_mowing_direction_setting", "custom mowing direction"],
  rainContinue: ["rain_continue_time", "rain_continue_time_setting", "rain continue time"],
  voiceVolume: ["voice_volume", "voice_volume_setting", "voice volume"],
};

const SWITCH_MAP = {
  rain: ["rain_perception", "rain_perception_enabled", "rain perception"],
  customDirection: ["custom_mowing_direction_enabled", "custom mowing direction"],
};

class AnthbotMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.config = {};
    this.entity = null;
    this.calibration = resetCalibration();
    this.robotCalibration = resetCalibration();
    this.decodedBoundaryCalibration = resetCalibration();
    this.renderer = null;
    this.activePanel = "control";
    this.refreshTimer = null;
    this.refreshInFlight = false;
    this.mapExpanded = false;
    this.showDecodedBoundary = true;
    this.showZones = true;
    this.optimisticSettings = new Map();
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error("Az Anthbot terkep kartyahoz meg kell adni egy entity-t");
    }

    this.config = config;
    this.stopRefreshTimer();
    window.clearTimeout(this.pendingRefreshTimer);
    this.calibration = readCalibration(config);
    this.robotCalibration = readRobotCalibration(config);
    this.decodedBoundaryCalibration = readDecodedBoundaryCalibration(config);
    this.showDecodedBoundary = config.show_decoded_boundary !== false && config.showDecodedBoundary !== false;
    this.showZones = config.show_zones !== false && config.showZones !== false;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.entity = hass.states[this.config.entity];
    this.startRefreshTimer();
    this.updateRenderer();
  }

  disconnectedCallback() {
    this.stopRefreshTimer();
    window.clearTimeout(this.pendingRefreshTimer);
    this.resizeObserver?.disconnect();
    this.renderer?.destroy();
    this.renderer = null;
  }

  getCardSize() {
    return 8;
  }

  render() {
    const root = this.shadowRoot;
    root.innerHTML = `
      <ha-card>
        <link rel="stylesheet" href="${this.resolveAsset("styles.css?v=77")}">
        <section class="app-shell">
          <div class="top-menu">
            <div>
              <div class="menu-title">${this.config.name || "Anthbot Map"}</div>
              <div class="menu-subtitle" data-role="state">Varakozas a terkep entity-re</div>
            </div>
            <div class="mini-status">
              <div class="battery-ring" data-role="battery-ring">
                <span data-role="battery-value">--</span>
              </div>
              <div class="status-copy">
                <span class="status-label">Allapot</span>
                <strong data-role="mower-status">-</strong>
              </div>
            </div>
          </div>
          <div class="panel-tabs">
            <button type="button" data-panel="control">Vezerles</button>
            <button type="button" data-panel="settings">Beallitasok</button>
            <button type="button" data-panel="status">Allapot</button>
            <button type="button" data-panel="diagnostics">Diagnosztika</button>
          </div>
        </section>
        <div class="canvas-wrap">
          <canvas></canvas>
          <div class="map-overlay map-title">
            <div class="name">${this.config.name || "Anthbot Map"}</div>
            <div class="state" data-role="map-state">Varakozas a terkep entity-re</div>
          </div>
          <div class="map-overlay preview-hint">
            <strong>Terkep</strong>
            <span>Kattints a nagy nezethez</span>
          </div>
          <div class="map-overlay map-actions">
            <button type="button" data-action="close-map" title="Bezaras">&times;</button>
            <button type="button" data-action="zoom-in" title="Nagyitas">+</button>
            <button type="button" data-action="zoom-out" title="Kicsinyites">-</button>
          </div>
          <div class="map-overlay map-badges">
            <span data-role="zone-count">Zonak: -</span>
            <span data-role="pose">Pozicio: -</span>
            <span data-role="heading">Irány: -</span>
          </div>
          <div class="map-overlay command-dock">
            <div class="zone-strip" data-role="zone-controls"></div>
            <div class="mower-controls">
              <button class="command start" type="button" data-command="start">
                <span class="command-icon">START</span>
                <span>Inditas</span>
              </button>
              <button class="command stop" type="button" data-command="stop">
                <span class="command-icon">STOP</span>
                <span>Stop</span>
              </button>
              <button class="command dock" type="button" data-command="dock">
                <span class="command-icon">HOME</span>
                <span>Tolto</span>
              </button>
            </div>
          </div>
        </div>
        <section class="app-panel">
          <div class="panel-body" data-role="panel-body"></div>
        </section>
        <details class="calibration">
          <summary>Kalibralas</summary>
          <div class="calibration-title">Terkep illesztese</div>
          <div class="calibration-grid">
            <button type="button" data-calibration="up">Fel</button>
            <button type="button" data-calibration="left">Balra</button>
            <button type="button" data-calibration="right">Jobbra</button>
            <button type="button" data-calibration="down">Le</button>
            <button type="button" data-calibration="narrower">Keskenyebb</button>
            <button type="button" data-calibration="wider">Szelesebb</button>
            <button type="button" data-calibration="shorter">Alacsonyabb</button>
            <button type="button" data-calibration="taller">Magasabb</button>
            <button type="button" data-calibration="rotate-left">Forgatas -</button>
            <button type="button" data-calibration="rotate-right">Forgatas +</button>
          </div>
          <div class="calibration-title">Robot illesztese</div>
          <div class="calibration-grid">
            <button type="button" data-robot-calibration="up">Robot fel</button>
            <button type="button" data-robot-calibration="left">Robot balra</button>
            <button type="button" data-robot-calibration="right">Robot jobbra</button>
            <button type="button" data-robot-calibration="down">Robot le</button>
            <button type="button" data-robot-calibration="narrower">Robot kisebb</button>
            <button type="button" data-robot-calibration="wider">Robot nagyobb</button>
            <button type="button" data-robot-calibration="rotate-left">Robot forgatas -</button>
            <button type="button" data-robot-calibration="rotate-right">Robot forgatas +</button>
            <button type="button" data-robot-calibration="rotate-left-large">Robot irany -15</button>
            <button type="button" data-robot-calibration="rotate-right-large">Robot irany +15</button>
            <button type="button" data-robot-calibration="rotate-around">Robot irany 180</button>
            <button type="button" data-action="reset-robot">Robot alaphelyzet</button>
          </div>
          <div class="calibration-title">Hatarvonal illesztese</div>
          <div class="calibration-grid">
            <button type="button" data-boundary-calibration="up">Hatar fel</button>
            <button type="button" data-boundary-calibration="left">Hatar balra</button>
            <button type="button" data-boundary-calibration="right">Hatar jobbra</button>
            <button type="button" data-boundary-calibration="down">Hatar le</button>
            <button type="button" data-boundary-calibration="narrower">Hatar keskenyebb</button>
            <button type="button" data-boundary-calibration="wider">Hatar szelesebb</button>
            <button type="button" data-boundary-calibration="shorter">Hatar alacsonyabb</button>
            <button type="button" data-boundary-calibration="taller">Hatar magasabb</button>
            <button type="button" data-boundary-calibration="rotate-left">Hatar forgatas -</button>
            <button type="button" data-boundary-calibration="rotate-right">Hatar forgatas +</button>
            <button type="button" data-action="reset-boundary">Hatar alaphelyzet</button>
          </div>
          <div class="yaml-row">
            <textarea readonly data-role="yaml"></textarea>
            <button type="button" data-action="copy-yaml">YAML masolasa</button>
          </div>
        </details>
      </ha-card>
    `;

    root.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleAction(button.dataset.action));
    });
    root.querySelectorAll("button[data-command]").forEach((button) => {
      button.addEventListener("click", () => this.handleCommand(button.dataset.command));
    });
    root.querySelectorAll("button[data-panel]").forEach((button) => {
      button.addEventListener("click", () => this.setPanel(button.dataset.panel));
    });
    root.querySelectorAll("button[data-calibration]").forEach((button) => {
      button.addEventListener("click", () => this.handleCalibration(button.dataset.calibration));
    });
    root.querySelectorAll("button[data-robot-calibration]").forEach((button) => {
      button.addEventListener("click", () => this.handleRobotCalibration(button.dataset.robotCalibration));
    });
    root.querySelectorAll("button[data-boundary-calibration]").forEach((button) => {
      button.addEventListener("click", () => this.handleBoundaryCalibration(button.dataset.boundaryCalibration));
    });

    const canvas = root.querySelector("canvas");
    const canvasWrap = root.querySelector(".canvas-wrap");
    canvasWrap?.style.setProperty("--anthbot-map-height", `${Number(this.config.height) || 720}px`);
    canvasWrap?.addEventListener("click", (event) => {
      if (!this.mapExpanded && !event.target.closest("button")) {
        this.setMapExpanded(true);
      }
    });

    this.renderer?.destroy();
    this.renderer = new AnthbotMapRenderer(canvas, this.rendererOptions());
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.renderer?.resize());
    this.resizeObserver.observe(canvas);
    requestAnimationFrame(() => this.renderer?.resize());
    this.setMapExpanded(this.mapExpanded);
    this.updateRenderer();
  }

  updateRenderer() {
    if (!this.renderer || !this.entity) {
      return;
    }

    const attributes = this.entity.attributes || {};
    const rawPose = attributes.pose && typeof attributes.pose === "object" ? attributes.pose : {};
    const coordinatePose = [attributes.cur_pose, attributes.map_scan_pose, rawPose].find((candidate) =>
      Number.isFinite(Number(candidate?.x)) && Number.isFinite(Number(candidate?.y)),
    );
    const poseYawEntity = this.getRelatedEntity("poseYaw");
    const fallbackYaw = [
      coordinatePose?.yaw,
      coordinatePose?.heading,
      rawPose.yaw,
      rawPose.heading,
      poseYawEntity?.state,
    ].find((value) => Number.isFinite(Number(value)));
    const pose = coordinatePose
      ? { ...rawPose, ...coordinatePose, yaw: fallbackYaw }
      : { ...rawPose, yaw: fallbackYaw };
    this.renderer.setOptions(this.rendererOptions());
    this.renderer.setState({
      pose,
      raw_pose: rawPose,
      cur_pose: attributes.cur_pose,
      map_scan_pose: attributes.map_scan_pose,
      path: attributes.path,
      map_raster: attributes.map_raster,
      map_definition: attributes.map_definition,
      path_definition: attributes.path_definition,
      map_binary_paths: attributes.map_binary_paths,
      path_binary_paths: attributes.path_binary_paths,
      mower_status: this.getRelatedEntity("status")?.state || attributes.mower_status || this.entity.state,
      area_definition: attributes.area_definition,
    });

    const state = this.shadowRoot.querySelector('[data-role="state"]');
    if (state) {
      state.textContent = `${this.entity.entity_id} - ${this.entity.state}`;
    }
    const mapState = this.shadowRoot.querySelector('[data-role="map-state"]');
    if (mapState) {
      mapState.textContent = `${this.entity.entity_id} - ${this.entity.state}`;
    }

    this.updateMapBadges(attributes);
    this.updateBatteryAndStatus();
    this.renderZoneControls(attributes.area_definition);
    this.renderAppPanel();
    this.updateYaml();
  }

  updateMapBadges(attributes) {
    const customAreas = Array.isArray(attributes.area_definition?.custom_areas)
      ? attributes.area_definition.custom_areas.length
      : 0;
    const noGoAreas =
      (Array.isArray(attributes.area_definition?.forbid_areas)
        ? attributes.area_definition.forbid_areas.length
        : 0) +
      (Array.isArray(attributes.area_definition?.remote_forbid_areas)
        ? attributes.area_definition.remote_forbid_areas.length
        : 0);

    const zoneCount = this.shadowRoot.querySelector('[data-role="zone-count"]');
    if (zoneCount) {
      zoneCount.textContent = `Zonak: ${customAreas} / Tiltott: ${noGoAreas}`;
    }

    const poseBadge = this.shadowRoot.querySelector('[data-role="pose"]');
    if (poseBadge) {
      const x = Number(attributes.pose?.x);
      const y = Number(attributes.pose?.y);
      poseBadge.textContent =
        Number.isFinite(x) && Number.isFinite(y)
          ? `Pozicio: ${Math.round(x)}, ${Math.round(y)}`
          : "Pozicio: -";
    }

    const headingBadge = this.shadowRoot.querySelector('[data-role="heading"]');
    if (headingBadge) {
      const headingValue = [
        attributes.cur_pose?.heading,
        attributes.map_scan_pose?.heading,
        attributes.pose?.heading,
      ].find((value) => Number.isFinite(Number(value)));
      const yawValue = [
        attributes.cur_pose?.yaw,
        attributes.map_scan_pose?.yaw,
        attributes.pose?.yaw,
        this.getRelatedEntity("poseYaw")?.state,
      ].find((value) => Number.isFinite(Number(value)));
      const heading = Number.isFinite(Number(headingValue))
        ? normalizeHeadingDegrees(headingValue)
        : Number.isFinite(Number(yawValue))
          ? milliRadiansToDegrees(yawValue)
          : null;
      headingBadge.textContent = Number.isFinite(heading)
        ? `Irány: ${Math.round(normalizeSignedDegrees(heading))}°`
        : "Irány: -";
    }
  }

  updateBatteryAndStatus() {
    const batteryRing = this.shadowRoot.querySelector('[data-role="battery-ring"]');
    const batteryValue = this.shadowRoot.querySelector('[data-role="battery-value"]');
    const batteryEntity = this.getRelatedEntity("battery");
    const batteryPercent = Number(batteryEntity?.state);

    if (batteryValue) {
      batteryValue.textContent = Number.isFinite(batteryPercent) ? `${batteryPercent}` : "--";
    }
    if (batteryRing) {
      const percent = Number.isFinite(batteryPercent) ? Math.max(0, Math.min(100, batteryPercent)) : 0;
      batteryRing.style.setProperty("--battery", `${percent * 3.6}deg`);
      batteryRing.classList.toggle("low", percent > 0 && percent < 25);
      batteryRing.classList.toggle("charging", this.getRelatedEntity("charging")?.state === "on");
    }

    const mowerStatus = this.shadowRoot.querySelector('[data-role="mower-status"]');
    if (mowerStatus) {
      const statusEntity = this.getRelatedEntity("status");
      mowerStatus.textContent = statusEntity ? this.translateStatus(statusEntity.state) : "-";
    }
  }

  setPanel(panel) {
    this.activePanel = panel;
    this.renderAppPanel();
  }

  renderAppPanel() {
    const body = this.shadowRoot.querySelector('[data-role="panel-body"]');
    if (!body || !this._hass) {
      return;
    }

    this.shadowRoot.querySelectorAll("button[data-panel]").forEach((button) => {
      button.classList.toggle("active", button.dataset.panel === this.activePanel);
    });

    if (this.activePanel === "settings") {
      this.renderSettingsPanel(body);
    } else if (this.activePanel === "status") {
      this.renderStatusPanel(body);
    } else if (this.activePanel === "diagnostics") {
      this.renderDiagnosticsPanel(body);
    } else {
      this.renderControlPanel(body);
    }
  }

  renderControlPanel(body) {
    body.innerHTML = "";
    const grid = this.createPanelGrid();
    grid.append(
      this.createCommandTile("Inditas", "Teljes terulet nyirasa", "start"),
      this.createCommandTile("Stop", "Minden feladat leallitasa", "stop"),
      this.createCommandTile("Tolto", "Vissza a toltore", "dock"),
    );

    for (const zone of this.currentZones()) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "panel-tile zone-tile";
      tile.innerHTML = `<strong>${zone.name || `Zone ${zone.id}`}</strong><span>Zonavagas inditasa</span>`;
      tile.addEventListener("click", () => this.startZone(zone));
      grid.appendChild(tile);
    }

    body.appendChild(grid);
  }

  renderSettingsPanel(body) {
    body.innerHTML = "";
    const grid = this.createPanelGrid();
    grid.append(
      this.createCommandTile("Cloud csatlakozas", "Adatok es parancsok frissitese", "connect"),
      this.createMowHeightControl(),
      this.createNumberControl("Egyedi irany", "mowDirection", 0, 180, 1, "deg"),
      this.createNumberControl("Eso utani varakozas", "rainContinue", 0, 8, 1, "h"),
      this.createNumberControl("Hangero", "voiceVolume", 0, 100, 1, "%"),
      this.createSwitchControl("Esoerzekeles", "rain"),
      this.createSwitchControl("Egyedi vagasi irany", "customDirection"),
      this.createMapOverlaySwitch("Zonak megjelenitese", "showZones"),
      this.createMapOverlaySwitch("Hatarvonal megjelenitese", "showDecodedBoundary"),
    );
    body.appendChild(grid);
  }

  renderStatusPanel(body) {
    body.innerHTML = "";
    const grid = this.createPanelGrid();
    for (const item of [
      ["Akku", "battery"],
      ["Allapot", "status"],
      ["Toltes", "charging"],
      ["Kapcsolat", "connection"],
      ["Vagasi magassag", "cuttingHeight"],
      ["Nyirt terulet", "mowingArea"],
      ["Nyirasi ido", "mowingTime"],
      ["RTK", "rtkFix"],
      ["Osszterulet", "totalArea"],
      ["Hiba", "errorDescription"],
    ]) {
      grid.appendChild(this.createInfoTile(item[0], item[1]));
    }
    body.appendChild(grid);
  }

  renderDiagnosticsPanel(body) {
    body.innerHTML = "";
    const grid = this.createPanelGrid();
    for (const item of [
      ["Vagokes elet", "cuttingComponentsLife"],
      ["Damilszal elet", "cuttingLineLife"],
      ["Tolto kontakt", "rechargeContactLife"],
      ["WiFi", "wifi"],
      ["Bluetooth", "bluetooth"],
      ["Firmware", "firmware"],
      ["GPS lat", "gpsLatitude"],
      ["GPS lon", "gpsLongitude"],
      ["Utolso frissites", "shadowUpdated"],
    ]) {
      grid.appendChild(this.createInfoTile(item[0], item[1]));
    }
    body.appendChild(grid);
  }

  createPanelGrid() {
    const grid = document.createElement("div");
    grid.className = "panel-grid";
    return grid;
  }

  createCommandTile(title, subtitle, command) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `panel-tile command-tile ${command}`;
    tile.innerHTML = `<strong>${title}</strong><span>${subtitle}</span>`;
    tile.addEventListener("click", () => this.handleCommand(command));
    return tile;
  }

  createInfoTile(label, key) {
    const entity = this.getRelatedEntity(key);
    const tile = document.createElement("div");
    tile.className = "panel-tile info-tile";
    tile.innerHTML = `<span>${label}</span><strong>${this.formatEntity(entity)}</strong>`;
    return tile;
  }

  createMowHeightControl() {
    const key = "mowHeight";
    const entityId = this.getNumberEntity(key);
    const entity = entityId ? this._hass.states[entityId] : null;
    const value = this.displayedNumberValue(key, Number(entity?.state));
    const selected = Number.isFinite(value) ? Math.max(30, Math.min(70, Math.round(value / 5) * 5)) : 50;
    const tile = document.createElement("div");
    tile.className = "panel-tile control-tile mow-height-tile";
    tile.innerHTML = `
      <div class="control-head">
        <span>Vagasi magassag</span>
        <strong>${selected} mm</strong>
      </div>
      <div class="height-options" role="group" aria-label="Vagasi magassag"></div>
    `;
    const options = tile.querySelector(".height-options");
    for (let height = 30; height <= 70; height += 5) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "height-option";
      button.textContent = String(height);
      button.classList.toggle("active", height === selected);
      button.disabled = !(entityId || this.hasSettingFallback(key));
      button.addEventListener("click", () => {
        options.querySelectorAll(".height-option").forEach((item) => item.classList.toggle("active", item === button));
        this.applyOptimisticNumber(key, height, button);
        this.setNumberEntity(key, entityId, height, button);
      });
      options.appendChild(button);
    }
    return tile;
  }

  createNumberControl(label, key, min, max, step, unit) {
    const entityId = this.getNumberEntity(key);
    const entity = entityId ? this._hass.states[entityId] : null;
    const value = this.displayedNumberValue(key, Number(entity?.state));
    const tile = document.createElement("div");
    tile.className = "panel-tile control-tile";
    tile.innerHTML = `
      <div class="control-head">
        <span>${label}</span>
        <strong>${Number.isFinite(value) ? value : "-"} ${unit}</strong>
      </div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(value) ? value : min}" ${entityId || this.hasSettingFallback(key) ? "" : "disabled"}>
    `;
    const input = tile.querySelector("input");
    input.addEventListener("input", () => this.applyOptimisticNumber(key, Number(input.value), input));
    input.addEventListener("change", () => this.setNumberEntity(key, entityId, Number(input.value), input));
    return tile;
  }

  createSwitchControl(label, key) {
    const entityId = this.getSwitchEntity(key);
    const entity = entityId ? this._hass.states[entityId] : null;
    const checked = entity?.state === "on";
    const tile = document.createElement("label");
    tile.className = "panel-tile switch-tile";
    tile.title = entityId || "Nem talalt switch entity";
    tile.innerHTML = `
      <span>${label}</span>
      <input type="checkbox" ${checked ? "checked" : ""} ${entityId ? "" : "disabled"}>
    `;
    const input = tile.querySelector("input");
    input.addEventListener("change", () => this.toggleSwitchEntity(key, entityId, input.checked, input));
    return tile;
  }

  createMapOverlaySwitch(label, key) {
    const checked = Boolean(this[key]);
    const tile = document.createElement("label");
    tile.className = "panel-tile switch-tile";
    tile.innerHTML = `
      <span>${label}</span>
      <input type="checkbox" ${checked ? "checked" : ""}>
    `;
    const input = tile.querySelector("input");
    input.addEventListener("change", () => this.setMapOverlayVisibility(key, input.checked));
    return tile;
  }

  renderZoneControls(areaDefinition = {}) {
    const container = this.shadowRoot.querySelector('[data-role="zone-controls"]');
    if (!container) {
      return;
    }

    container.innerHTML = "";
    for (const zone of this.currentZones(areaDefinition)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = zone.name || `Zone ${zone.id}`;
      button.addEventListener("click", () => this.startZone(zone));
      container.appendChild(button);
    }
  }

  currentZones(areaDefinition = this.entity?.attributes?.area_definition || {}) {
    const zones = Array.isArray(areaDefinition?.custom_areas) ? areaDefinition.custom_areas : [];
    return zones.filter((zone) => zone?.id !== undefined && zone?.id !== null);
  }

  rendererOptions() {
    return {
      image: this.config.image,
      bounds: this.config.bounds,
      fit: this.config.fit || "cover",
      rotation: degreesToRadians(Number(this.config.rotation) || 0),
      calibration: this.calibration,
      robotCalibration: this.robotCalibration,
      decodedBoundaryCalibration: this.decodedBoundaryCalibration,
      robotImage: this.config.robot_image || this.config.robotImage || this.resolveAsset("robot.png?v=77"),
      robotSize: this.config.robot_size ?? this.config.robotSize,
      robotImageRotation: this.config.robot_image_rotation ?? this.config.robotImageRotation,
      robotHeadingSource: this.config.robot_heading_source || this.config.robotHeadingSource,
      robotHeadingOffset: this.config.robot_heading_offset ?? this.config.robotHeadingOffset,
      robotMowingHeadingOffset: this.config.robot_mowing_heading_offset ?? this.config.robotMowingHeadingOffset,
      showMowedPath: this.config.show_mowed_path !== false,
      mowedPathSource: this.config.mowed_path_source || this.config.mowedPathSource,
      mowedPathColor: this.config.mowed_path_color || this.config.mowedPathColor,
      mowedPathWidth: this.config.mowed_path_width ?? this.config.mowedPathWidth,
      showBoundary: this.config.show_boundary !== false,
      showLegacyBoundary: this.config.show_legacy_boundary === true || this.config.showLegacyBoundary === true,
      showDecodedBoundary: this.showDecodedBoundary,
      showZones: this.showZones,
      boundaryColor: this.config.boundary_color || this.config.boundaryColor,
      boundaryWidth: this.config.boundary_width ?? this.config.boundaryWidth,
      charger: this.config.charger,
    };
  }

  startRefreshTimer() {
    if (!this._hass || this.refreshTimer || this.config.refresh_interval === 0) {
      return;
    }

    const interval = Math.max(1, Number(this.config.refresh_interval ?? this.config.refreshInterval ?? 2)) * 1000;
    this.refreshTimer = window.setInterval(() => this.refreshEntities(), interval);
  }

  stopRefreshTimer() {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refreshEntities() {
    if (!this._hass || this.refreshInFlight || !this.config.entity) {
      return;
    }

    this.refreshInFlight = true;
    try {
      await this._hass.callService("homeassistant", "update_entity", {
        entity_id: this.refreshEntityIds(),
      });
    } catch (error) {
      console.warn("Anthbot map refresh failed", error);
    } finally {
      this.refreshInFlight = false;
    }
  }

  refreshEntityIds() {
    return [
      this.config.entity,
      this.getRelatedEntity("status")?.entity_id,
      this.getRelatedEntity("battery")?.entity_id,
      this.getRelatedEntity("charging")?.entity_id,
      this.getRelatedEntity("mowingArea")?.entity_id,
      this.getRelatedEntity("mowingTime")?.entity_id,
      this.getRelatedEntity("poseYaw")?.entity_id,
    ].filter(Boolean);
  }

  async handleCommand(command) {
    const serviceByCommand = {
      connect: "connect_cloud",
      start: "start_full_mow",
      stop: "stop_mow",
      dock: "return_to_dock",
    };
    const service = serviceByCommand[command];
    if (service) {
      await this.callAnthbotService(service);
    }
  }

  async startZone(zone) {
    await this.callAnthbotService("start_zone_mow", { zones: String(zone.id ?? zone.name) });
  }

  async callAnthbotService(service, data = {}) {
    try {
      await this._hass.callService("anthbot_genie_plus", service, {
        ...data,
        entity_id: this.config.entity,
      });
    } catch (error) {
      this.notify(`A muvelet hibat jelzett: ${service}`);
      throw error;
    }
  }

  async setNumberEntity(kind, entityId, value, input) {
    if (!Number.isFinite(value)) {
      return;
    }
    this.applyOptimisticNumber(kind, value, input);
    try {
      if (this.hasSettingFallback(kind)) {
        await this.callSettingFallback(kind, value);
      } else if (entityId) {
        await this._hass.callService("number", "set_value", { entity_id: entityId, value });
        this.scheduleRefresh();
      } else {
        throw new Error(`No setting target found for ${kind}`);
      }
    } catch (error) {
      if (input) {
        const previous = this.getNumberEntity(kind);
        const state = previous ? this._hass.states[previous] : null;
        if (state) {
          input.value = Number(state.state);
        }
      }
      this.notify(`A beallitas nem sikerult: ${entityId || kind}`);
      throw error;
    }
  }

  async toggleSwitchEntity(kind, entityId, checked, input) {
    if (!entityId && !this.hasSwitchFallback(kind)) {
      this.notify(`Nem talaltam kapcsolot: ${kind}`);
      return;
    }
    try {
      if (this.hasSwitchFallback(kind)) {
        await this.callSwitchFallback(kind, checked);
      } else {
        await this._hass.callService("switch", checked ? "turn_on" : "turn_off", { entity_id: entityId });
        this.scheduleRefresh();
      }
    } catch (error) {
      if (input) {
        input.checked = !checked;
      }
      this.notify(`A kapcsolo nem sikerult: ${entityId}`);
      throw error;
    }
  }

  hasSettingFallback(kind) {
    return ["mowHeight", "mowDirection", "rainContinue", "voiceVolume"].includes(kind);
  }

  async callSettingFallback(kind, value) {
    const fallback = {
      mowHeight: ["set_mow_height", { mow_height: value }],
      mowDirection: ["set_custom_mowing_direction", { mow_direction: value, enable_custom_direction: true }],
      rainContinue: ["set_rain_continue_time", { rain_continue_time: value }],
      voiceVolume: ["set_voice_volume", { voice_volume: value }],
    }[kind];
    if (!fallback) {
      throw new Error(`No fallback service for ${kind}`);
    }
    await this.callAnthbotService(fallback[0], fallback[1]);
    this.scheduleRefresh();
  }

  hasSwitchFallback(kind) {
    return ["rain", "customDirection"].includes(kind);
  }

  async callSwitchFallback(kind, checked) {
    const fallback = {
      rain: ["set_rain_perception", { enable_rain_perception: checked }],
      customDirection: ["set_custom_mowing_direction", {
        mow_direction: Number(this.getNumberEntity("mowDirection") ? this._hass.states[this.getNumberEntity("mowDirection")]?.state : 0) || 0,
        enable_custom_direction: checked,
      }],
    }[kind];
    if (!fallback) {
      throw new Error(`No fallback service for ${kind}`);
    }
    await this.callAnthbotService(fallback[0], fallback[1]);
    this.scheduleRefresh();
  }

  applyOptimisticNumber(kind, value, input) {
    if (Number.isFinite(value)) {
      this.optimisticSettings.set(kind, { value, until: Date.now() + 10000 });
    }
    const tile = input?.closest(".control-tile");
    const valueLabel = tile?.querySelector(".control-head strong");
    const units = {
      mowHeight: "mm",
      mowDirection: "deg",
      rainContinue: "h",
      voiceVolume: "%",
    };
    if (valueLabel) {
      valueLabel.textContent = `${value} ${units[kind] || ""}`.trim();
    }
  }

  displayedNumberValue(kind, entityValue) {
    const optimistic = this.optimisticSettings.get(kind);
    if (optimistic && optimistic.until > Date.now()) {
      return optimistic.value;
    }
    this.optimisticSettings.delete(kind);
    return entityValue;
  }

  scheduleRefresh(delay = 1200) {
    window.clearTimeout(this.pendingRefreshTimer);
    this.pendingRefreshTimer = window.setTimeout(() => this.refreshEntities(), delay);
  }

  async connectCloudQuietly() {
    try {
      await this._hass.callService("anthbot_genie_plus", "connect_cloud", {
        entity_id: this.config.entity,
      });
    } catch (error) {
      console.warn("Anthbot cloud connect failed before setting update", error);
    }
  }

  handleAction(action) {
    if (action === "zoom-in") {
      this.renderer.view.zoom = Math.min(8, this.renderer.view.zoom * 1.15);
      this.renderer.draw();
    } else if (action === "zoom-out") {
      this.renderer.view.zoom = Math.max(0.2, this.renderer.view.zoom / 1.15);
      this.renderer.draw();
    } else if (action === "rotate-left") {
      this.renderer.rotate(-Math.PI / 18);
    } else if (action === "rotate-right") {
      this.renderer.rotate(Math.PI / 18);
    } else if (action === "reset") {
      this.calibration = resetCalibration();
      this.robotCalibration = resetCalibration();
      this.renderer.setCalibration(this.calibration);
      this.renderer.setRobotCalibration(this.robotCalibration);
      this.renderer.resetView();
      this.updateYaml();
    } else if (action === "reset-robot") {
      this.robotCalibration = resetCalibration();
      this.renderer.setRobotCalibration(this.robotCalibration);
      this.updateYaml();
    } else if (action === "reset-boundary") {
      this.decodedBoundaryCalibration = resetCalibration();
      this.renderer?.setDecodedBoundaryCalibration(this.decodedBoundaryCalibration);
      this.updateYaml();
    } else if (action === "copy-yaml") {
      this.copyYaml();
    } else if (action === "close-map") {
      this.setMapExpanded(false);
    }
  }

  setMapOverlayVisibility(key, visible) {
    this[key] = Boolean(visible);
    this.renderer?.setOptions({
      showDecodedBoundary: this.showDecodedBoundary,
      showZones: this.showZones,
    });
    this.updateYaml();
  }

  setMapExpanded(expanded) {
    this.mapExpanded = Boolean(expanded);
    this.shadowRoot?.querySelector("ha-card")?.classList.toggle("map-expanded", this.mapExpanded);
    requestAnimationFrame(() => this.renderer?.resize());
  }

  handleCalibration(action) {
    this.calibration = adjustCalibration(this.calibration, action, 1);
    this.renderer.setCalibration(this.calibration);
    this.updateYaml();
  }

  handleRobotCalibration(action) {
    this.robotCalibration = adjustCalibration(this.robotCalibration, action, 1);
    this.renderer.setRobotCalibration(this.robotCalibration);
    this.updateYaml();
  }

  handleBoundaryCalibration(action) {
    this.decodedBoundaryCalibration = adjustCalibration(this.decodedBoundaryCalibration, action, 1);
    this.renderer?.setDecodedBoundaryCalibration(this.decodedBoundaryCalibration);
    this.updateYaml();
  }

  updateYaml() {
    const yaml = this.shadowRoot?.querySelector('[data-role="yaml"]');
    if (yaml) {
      yaml.value = cardToYaml(
        this.configForYaml(),
        this.calibration,
        this.robotCalibration,
        this.decodedBoundaryCalibration,
      );
    }
  }

  async copyYaml() {
    const yaml = cardToYaml(
      this.configForYaml(),
      this.calibration,
      this.robotCalibration,
      this.decodedBoundaryCalibration,
    );
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(yaml);
      return;
    }

    const input = this.shadowRoot?.querySelector('[data-role="yaml"]');
    input?.select();
    document.execCommand("copy");
  }

  configForYaml() {
    return {
      ...this.config,
      show_decoded_boundary: this.showDecodedBoundary,
      show_zones: this.showZones,
    };
  }

  getControlEntity(command) {
    const configured = this.config.controls?.[command];
    if (configured && this._hass.states[configured]) {
      return configured;
    }

    const suffixByCommand = {
      start: ["start_full_mow"],
      stop: ["stop_mow"],
      dock: ["return_to_dock"],
    };
    return this.findEntity("button", suffixByCommand[command] || []);
  }

  getZoneButtonEntity(zone) {
    const configured = this.config.zoneButtons?.[zone.id] || this.config.zoneButtons?.[zone.name];
    if (configured && this._hass.states[configured]) {
      return configured;
    }

    const zoneId = zone.id === undefined || zone.id === null ? null : String(zone.id);
    const zoneName = String(zone.name || "").trim();
    const normalizedName = slugify(zoneName);

    for (const [entityId, state] of Object.entries(this._hass.states || {})) {
      if (!entityId.startsWith("button.")) {
        continue;
      }
      const attrs = state.attributes || {};
      if (attrs.zone_type && zoneId !== null && String(attrs.id) === zoneId) {
        return entityId;
      }
      if (attrs.zone_type && normalizedName && slugify(attrs.name) === normalizedName) {
        return entityId;
      }
    }

    const base = this.entityBase();
    const visibleNumber = zoneName.match(/\d+/)?.[0];
    const suffixes = [
      zoneId ? `manual_zone_${zoneId}` : "",
      zoneId ? `auto_zone_${zoneId}` : "",
      zoneId ? `zone_${zoneId}` : "",
      normalizedName ? `zone_${normalizedName}` : "",
      normalizedName ? normalizedName : "",
      visibleNumber ? `zone_zone_${visibleNumber}` : "",
      visibleNumber ? `zone_${visibleNumber}` : "",
    ].filter(Boolean);

    for (const suffix of suffixes) {
      for (const candidate of [`button.${base}_${suffix}`, `button.${base}_${suffix}_2`]) {
        if (this._hass.states[candidate]) {
          return candidate;
        }
      }
    }

    for (const [entityId, state] of Object.entries(this._hass.states || {})) {
      if (!entityId.startsWith("button.") || !entityId.includes(base)) {
        continue;
      }
      const friendlyName = slugify(state.attributes?.friendly_name);
      if (normalizedName && friendlyName.includes(normalizedName)) {
        return entityId;
      }
    }

    return null;
  }

  getRelatedEntity(kind) {
    const configured = this.config.entities?.[kind];
    if (configured && this._hass.states[configured]) {
      return this._hass.states[configured];
    }

    const mapped = ENTITY_MAP[kind];
    if (!mapped) {
      return null;
    }
    const entityId = this.findEntity(mapped[0], mapped[1]);
    return entityId ? this._hass.states[entityId] : null;
  }

  getNumberEntity(kind) {
    const configured = this.config.numbers?.[kind];
    if (configured && this._hass.states[configured]) {
      return configured;
    }
    return this.findEntity("number", NUMBER_MAP[kind] || []);
  }

  getSwitchEntity(kind) {
    const configured = this.config.switches?.[kind];
    if (configured && this._hass.states[configured]) {
      return configured;
    }

    return this.findEntity("switch", SWITCH_MAP[kind] || []);
  }

  findEntity(domain, suffixes) {
    const base = this.entityBase();
    for (const suffix of suffixes) {
      for (const candidate of [
        `${domain}.${base}_${suffix}`,
        `${domain}.${base}_${suffix}_2`,
      ]) {
        if (this._hass.states[candidate]) {
          return candidate;
        }
      }
    }

    for (const suffix of suffixes) {
      const wanted = slugify(`${base}_${suffix}`);
      for (const [entityId, state] of Object.entries(this._hass.states || {})) {
        if (!entityId.startsWith(`${domain}.`)) {
          continue;
        }
        const entitySlug = slugify(entityId.slice(domain.length + 1));
        const friendlySlug = slugify(state.attributes?.friendly_name);
        const suffixSlug = slugify(suffix);
        if (entitySlug === wanted || entitySlug.endsWith(`_${suffixSlug}`) || friendlySlug.includes(suffixSlug)) {
          return entityId;
        }
      }
    }
    return null;
  }

  entityBase() {
    return String(this.config.entity || "")
      .replace(/^sensor\./, "")
      .replace(/_map$/, "");
  }

  formatEntity(entity) {
    if (!entity) {
      return "-";
    }
    const unit = entity.attributes?.unit_of_measurement;
    const value = this.translateStatus(entity.state);
    return unit ? `${value} ${unit}` : value;
  }

  translateStatus(status) {
    const labels = {
      on: "be",
      off: "ki",
      standby: "keszenlet",
      paused: "szunet",
      charging: "toltes",
      mowing: "nyiras",
      returning_to_dock: "vissza a toltore",
      mapping: "terkepezes",
      positioning: "pozicionalas",
      sleeping: "alvas",
      unknown: "ismeretlen",
    };
    return labels[status] || status;
  }

  resolveAsset(fileName) {
    const script = document.currentScript?.src || import.meta.url;
    return new URL(fileName, script).toString();
  }

  notify(message) {
    this.dispatchEvent(
      new CustomEvent("hass-notification", {
        detail: { message },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function milliRadiansToDegrees(value) {
  return (Number(value) * 180) / (Math.PI * 1000);
}

function normalizeHeadingDegrees(value) {
  const heading = Number(value) || 0;
  return Math.abs(heading) > 360 ? heading / 100 : heading;
}

function normalizeSignedDegrees(value) {
  return ((Number(value) + 180) % 360 + 360) % 360 - 180;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

customElements.define("anthbot-map-card", AnthbotMapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "anthbot-map-card",
  name: "Anthbot terkep kartya",
  description: "Canvas terkepmegjelenito Anthbot map sensorokhoz",
});





