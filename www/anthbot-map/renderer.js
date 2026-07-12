import { createGeometry, getBoundaryPaths, getWorldBounds, getZonePoints, getZones, normalizePoints } from "./geometry.js?v=77";

const COLORS = Object.freeze({
  background: "#18202a",
  grid: "rgba(255, 255, 255, 0.09)",
  zoneFill: "rgba(67, 160, 71, 0.28)",
  zoneStroke: "rgba(129, 199, 132, 0.95)",
  noGoFill: "rgba(244, 67, 54, 0.38)",
  noGoStroke: "rgba(255, 82, 82, 1)",
  boundaryStroke: "rgba(74, 101, 255, 0.9)",
  boundaryGlow: "rgba(168, 179, 255, 0.38)",
  mowedPath: "rgba(82, 94, 245, 0.62)",
  mowedPathStroke: "rgba(220, 226, 255, 0.72)",
  robot: "#ffcc33",
  robotStroke: "#1b1b1b",
});

export class AnthbotMapRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = { ...options };
    this.state = {};
    this.image = null;
    this.imageUrl = null;
    this.rasterCanvas = null;
    this.rasterBoundaryCanvas = null;
    this.rasterKey = null;
    this.rasterBoundaryKey = null;
    this.robotImage = null;
    this.robotImageUrl = null;
    this.robotHeading = null;
    this.cloudHeading = null;
    this.liveMowedPath = [];
    this.lastTrailPoint = null;
    this.dpr = 1;
    this.view = {
      panX: 0,
      panY: 0,
      zoom: 1,
      rotation: Number(options.rotation) || 0,
    };
    this.drag = null;
    this.decodedBoundaryCalibration = options.decodedBoundaryCalibration || {};

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }

  setOptions(options = {}) {
    this.options = { ...this.options, ...options };
    if (options.decodedBoundaryCalibration) {
      this.decodedBoundaryCalibration = options.decodedBoundaryCalibration;
    }
    if (Number.isFinite(Number(options.rotation))) {
      this.view.rotation = Number(options.rotation);
    }
    this.loadImage(this.options.image);
    this.loadRobotImage(this.options.robotImage);
    this.draw();
  }

  setState(state = {}) {
    this.state = state;
    this.updateLiveMowedPath(state);
    this.loadImage(this.options.image);
    this.loadRobotImage(this.options.robotImage);
    this.draw();
  }

  setCalibration(calibration) {
    this.options.calibration = calibration;
    this.draw();
  }

  setRobotCalibration(robotCalibration) {
    this.options.robotCalibration = robotCalibration;
    this.draw();
  }

  setDecodedBoundaryCalibration(decodedBoundaryCalibration) {
    this.decodedBoundaryCalibration = decodedBoundaryCalibration || {};
    this.options.decodedBoundaryCalibration = this.decodedBoundaryCalibration;
    this.draw();
  }

  resetView() {
    this.view.panX = 0;
    this.view.panY = 0;
    this.view.zoom = 1;
    this.view.rotation = Number(this.options.rotation) || 0;
    this.draw();
  }

  rotate(delta) {
    this.view.rotation += delta;
    this.draw();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.draw();
  }

  draw() {
    if (!this.ctx || !this.canvas.width || !this.canvas.height) {
      return;
    }

    const ctx = this.ctx;
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    const areaDefinition = this.state.area_definition || {};
    const mapSource = {
      ...areaDefinition,
      map_raster: this.state.map_raster,
      map_definition: this.state.map_definition,
      path_definition: this.state.path_definition,
      map_binary_paths: this.state.map_binary_paths,
      path_binary_paths: this.state.path_binary_paths,
    };
    const pose = this.state.pose || {};
    const bounds = this.options.bounds || getWorldBounds(mapSource, pose);
    const baseGeometry = createGeometry({
      width,
      height,
      bounds,
      view: this.view,
      calibration: {},
      aspectRatio: this.image ? this.image.width / this.image.height : undefined,
      fit: this.options.fit,
    });
    const geometry = createGeometry({
      width,
      height,
      bounds,
      view: this.view,
      calibration: this.options.calibration,
      aspectRatio: this.image ? this.image.width / this.image.height : undefined,
      fit: this.options.fit,
    });

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    this.drawBackground(ctx, this.image ? baseGeometry : geometry, width, height);
    if (this.options.showZones !== false) {
      this.drawZones(ctx, geometry, getZones(areaDefinition, ["custom_areas", "zones", "customAreas"]), "zone");
    }
    this.drawZones(
      ctx,
      geometry,
      getZones(areaDefinition, [
        "forbid_areas",
        "forbidAreas",
        "remote_forbid_areas",
        "remoteForbidAreas",
        "no_go_areas",
        "noGoAreas",
      ]),
      "no-go",
    );
    if (this.options.showLegacyBoundary === true) {
      this.drawBoundary(ctx, geometry, getBoundaryPaths(mapSource));
    }
    this.drawDecodedBoundary(ctx, geometry);
    this.drawMowedPath(ctx, geometry);
    this.drawCharger(ctx, geometry);
    this.drawRobot(ctx, geometry, pose);

    ctx.restore();
  }

  drawMowedPath(ctx, geometry) {
    if (this.options.showMowedPath === false) {
      return;
    }

    const pathSource = String(this.options.mowedPathSource || "live").toLowerCase();
    const points = pathSource === "cloud" ? extractPathPoints(this.state.path) : [];
    const trail = points.length >= 2 ? points : this.liveMowedPath;
    if (!trail || trail.length < 1) {
      return;
    }

    const screenPoints = trail.map((point) => this.robotPositionToScreen(geometry, point));
    const zoomWidthFactor = Math.sqrt(Math.max(0.25, Number(this.view.zoom) || 1));
    const width = clamp(
      (Number(this.options.mowedPathWidth) || 7) * zoomWidthFactor,
      3,
      22,
    );

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = this.options.mowedPathColor || COLORS.mowedPath;
    ctx.lineWidth = width;

    if (screenPoints.length === 1) {
      ctx.fillStyle = this.options.mowedPathColor || COLORS.mowedPath;
      ctx.beginPath();
      ctx.arc(screenPoints[0].x, screenPoints[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (const point of screenPoints.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    ctx.strokeStyle = COLORS.mowedPathStroke;
    ctx.lineWidth = Math.max(1.5, width * 0.08);
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (const point of screenPoints.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawBoundary(ctx, geometry, paths) {
    if (this.options.showBoundary === false || !Array.isArray(paths) || !paths.length) {
      return;
    }

    const color = this.options.boundaryColor || COLORS.boundaryStroke;
    const width = clamp(
      Number(this.options.boundaryWidth) || 3,
      1,
      12,
    );

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const path of paths) {
      if (!Array.isArray(path) || path.length < 2) {
        continue;
      }

      const screenPoints = path.map((point) => geometry.worldToScreen(point));
      ctx.strokeStyle = COLORS.boundaryGlow;
      ctx.lineWidth = width + 4;
      drawPolyline(ctx, screenPoints, true);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      drawPolyline(ctx, screenPoints, true);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawBackground(ctx, geometry, width, height) {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    if (this.image) {
      drawImageOnMap(ctx, geometry, this.image, {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 1, y: 0 },
        bottomLeft: { x: 0, y: 1 },
        dpr: this.dpr,
        smoothing: true,
        stroke: "rgba(255, 255, 255, 0.12)",
      });
      return;
    }

    if (this.drawMapRaster(ctx, geometry)) {
      return;
    }

    this.drawGrid(ctx, geometry);
  }

  drawDecodedBoundary(ctx, geometry) {
    if (this.options.showBoundary === false || this.options.showDecodedBoundary === false) {
      return false;
    }

    const raster = this.state.map_raster;
    const bounds = raster?.bounds;
    if (!raster || !bounds || !Array.isArray(raster.runs)) {
      return false;
    }

    const boundaryCanvas = this.getRasterBoundaryCanvas(raster);
    if (!boundaryCanvas) {
      return false;
    }

    const minX = Number(bounds.min_x ?? bounds.minX);
    const maxX = Number(bounds.max_x ?? bounds.maxX);
    const minY = Number(bounds.min_y ?? bounds.minY);
    const maxY = Number(bounds.max_y ?? bounds.maxY);
    if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
      return false;
    }

    const boundaryGeometry = applyMapCalibration(geometry, this.decodedBoundaryCalibration);
    drawImageFromWorldRect(ctx, boundaryGeometry, boundaryCanvas, {
      minX,
      maxX,
      minY,
      maxY,
      dpr: this.dpr,
      smoothing: false,
    });
    return true;
  }

  drawMapRaster(ctx, geometry) {
    const raster = this.state.map_raster;
    const bounds = raster?.bounds;
    if (!raster || !bounds || !Array.isArray(raster.runs)) {
      return false;
    }

    const rasterCanvas = this.getRasterCanvas(raster);
    if (!rasterCanvas) {
      return false;
    }

    const minX = Number(bounds.min_x ?? bounds.minX);
    const maxX = Number(bounds.max_x ?? bounds.maxX);
    const minY = Number(bounds.min_y ?? bounds.minY);
    const maxY = Number(bounds.max_y ?? bounds.maxY);
    if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
      return false;
    }

    drawImageFromWorldRect(ctx, geometry, rasterCanvas, {
      minX,
      maxX,
      minY,
      maxY,
      dpr: this.dpr,
      smoothing: false,
    });
    return true;
  }

  getRasterCanvas(raster) {
    const width = Number(raster.width);
    const height = Number(raster.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return null;
    }

    const key = `${width}x${height}:${raster.runs.length}:${raster.runs[0]}:${raster.runs[raster.runs.length - 1]}`;
    if (this.rasterCanvas && this.rasterKey === key) {
      return this.rasterCanvas;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const imageData = ctx.createImageData(width, height);
    let pixel = 0;
    for (let index = 0; index < raster.runs.length - 1; index += 2) {
      const value = Number(raster.runs[index]);
      const count = Number(raster.runs[index + 1]);
      if (!Number.isFinite(value) || !Number.isFinite(count) || count <= 0) {
        continue;
      }
      const color = rasterColor(value);
      for (let step = 0; step < count && pixel < width * height; step += 1, pixel += 1) {
        const sourceX = pixel % width;
        const sourceY = Math.floor(pixel / width);
        const target = ((height - 1 - sourceY) * width + sourceX) * 4;
        imageData.data[target] = color[0];
        imageData.data[target + 1] = color[1];
        imageData.data[target + 2] = color[2];
        imageData.data[target + 3] = color[3];
      }
    }
    ctx.putImageData(imageData, 0, 0);

    this.rasterCanvas = canvas;
    this.rasterKey = key;
    return canvas;
  }

  getRasterBoundaryCanvas(raster) {
    const width = Number(raster.width);
    const height = Number(raster.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return null;
    }

    const key = `boundary:${width}x${height}:${raster.runs.length}:${raster.runs[0]}:${raster.runs[raster.runs.length - 1]}`;
    if (this.rasterBoundaryCanvas && this.rasterBoundaryKey === key) {
      return this.rasterBoundaryCanvas;
    }

    const pixels = decodeRasterRuns(raster, width, height);
    if (!pixels) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const value = pixels[index];
        const solid = value !== 0;
        const edge =
          solid &&
          (value !== 255 ||
            x === 0 ||
            y === 0 ||
            x === width - 1 ||
            y === height - 1 ||
            pixels[index - 1] === 0 ||
            pixels[index + 1] === 0 ||
            pixels[index - width] === 0 ||
            pixels[index + width] === 0);

        if (!edge) {
          continue;
        }

        const target = ((height - 1 - y) * width + x) * 4;
        imageData.data[target] = 55;
        imageData.data[target + 1] = 95;
        imageData.data[target + 2] = 255;
        imageData.data[target + 3] = value === 255 ? 210 : 245;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    this.rasterBoundaryCanvas = canvas;
    this.rasterBoundaryKey = key;
    return canvas;
  }

  drawGrid(ctx, geometry) {
    ctx.save();
    ctx.translate(geometry.map.centerX, geometry.map.centerY);
    ctx.rotate(geometry.map.rotation);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    for (let step = -0.5; step <= 0.5; step += 0.1) {
      ctx.beginPath();
      ctx.moveTo(step * geometry.map.width, -geometry.map.height / 2);
      ctx.lineTo(step * geometry.map.width, geometry.map.height / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-geometry.map.width / 2, step * geometry.map.height);
      ctx.lineTo(geometry.map.width / 2, step * geometry.map.height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.strokeRect(-geometry.map.width / 2, -geometry.map.height / 2, geometry.map.width, geometry.map.height);
    ctx.restore();
  }

  drawZones(ctx, geometry, zones, type) {
    const isNoGo = type === "no-go";
    ctx.fillStyle = isNoGo ? COLORS.noGoFill : COLORS.zoneFill;
    ctx.strokeStyle = isNoGo ? COLORS.noGoStroke : COLORS.zoneStroke;
    ctx.lineWidth = 2;

    for (const zone of zones) {
      const points = getZonePoints(zone);
      if (points.length < 2) {
        continue;
      }

      const screenPoints = points.map((point) => geometry.worldToScreen(point));
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (const point of screenPoints.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      this.drawZoneLabel(ctx, screenPoints, zoneLabel(zone, isNoGo));
    }
  }

  drawZoneLabel(ctx, points, label) {
    if (!label || !points.length) {
      return;
    }

    const center = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    center.x /= points.length;
    center.y /= points.length;

    ctx.save();
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(label).width + 14;
    ctx.fillStyle = "rgba(12, 18, 24, 0.72)";
    roundRect(ctx, center.x - width / 2, center.y - 13, width, 26, 13);
    ctx.fill();
    ctx.fillStyle = "rgba(232, 255, 237, 0.96)";
    ctx.fillText(label, center.x, center.y);
    ctx.restore();
  }

  drawCharger(ctx, geometry) {
    const charger = this.options.charger;
    if (!charger || !Number.isFinite(Number(charger.x)) || !Number.isFinite(Number(charger.y))) {
      return;
    }

    const point = geometry.mapToScreen({ x: Number(charger.x), y: Number(charger.y) });

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.fillStyle = "rgba(13, 148, 136, 0.92)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", 0, 0);
    ctx.restore();
  }

  drawRobot(ctx, geometry, pose) {
    if (!pose || !Number.isFinite(Number(pose.x)) || !Number.isFinite(Number(pose.y))) {
      return;
    }

    const robotCalibration = this.options.robotCalibration || {};
    const point = this.robotPositionToScreen(geometry, pose);
    const mowingHeadingOffset = this.isMowingState()
      ? Number(this.options.robotMowingHeadingOffset ?? this.options.robot_mowing_heading_offset ?? 0) || 0
      : 0;
    const cloudYaw =
      degreesToRadians(this.cloudHeadingDegrees(pose)) +
      geometry.map.rotation +
      degreesToRadians(Number(this.options.robotHeadingOffset ?? this.options.robot_heading_offset) || 0) +
      degreesToRadians(mowingHeadingOffset) +
      (Number(robotCalibration.rotation) || 0);
    const headingSource = String(this.options.robotHeadingSource || "cloud").toLowerCase();
    const movementYaw =
      headingSource === "movement" || headingSource === "auto"
        ? this.movementHeading(geometry)
        : null;
    this.cloudHeading =
      this.cloudHeading === null ? cloudYaw : smoothAngle(this.cloudHeading, cloudYaw, 0.45);
    const yaw = headingSource === "movement"
      ? movementYaw ?? this.cloudHeading
      : headingSource === "cloud"
        ? this.cloudHeading
        : movementYaw ?? this.cloudHeading;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(yaw);
    if (this.robotImage) {
      const size = clamp(
        (Number(this.options.robotSize) || 42) *
          (Number(robotCalibration.scaleX) || 1) *
          (Number(this.view.zoom) || 1),
        8,
        260,
      );
      const aspect = this.robotImage.width / this.robotImage.height || 1;
      const imageRotation =
        this.options.robotImageRotation === undefined
          ? Math.PI / 2
          : degreesToRadians(Number(this.options.robotImageRotation) || 0);

      ctx.rotate(imageRotation);
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(this.robotImage, (-size * aspect) / 2, -size / 2, size * aspect, size);
      ctx.restore();
      return;
    }

    const radius = clamp(9 * (Number(this.view.zoom) || 1), 4, 64);
    ctx.fillStyle = COLORS.robot;
    ctx.strokeStyle = COLORS.robotStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radius + 5, 0);
    ctx.lineTo(-radius, -radius * 0.75);
    ctx.lineTo(-radius * 0.55, 0);
    ctx.lineTo(-radius, radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  loadImage(url) {
    if (!url || url === this.imageUrl) {
      return;
    }

    this.imageUrl = url;
    this.image = null;
    const image = new Image();
    image.onload = () => {
      this.image = image;
      this.draw();
    };
    image.src = url;
  }

  loadRobotImage(url) {
    if (!url) {
      this.robotImageUrl = null;
      this.robotImage = null;
      return;
    }
    if (url === this.robotImageUrl) {
      return;
    }

    this.robotImageUrl = url;
    this.robotImage = null;
    const image = new Image();
    image.onload = () => {
      this.robotImage = image;
      this.draw();
    };
    image.src = url;
  }

  updateLiveMowedPath(state = {}) {
    const pose = state.pose || {};
    if (!Number.isFinite(Number(pose.x)) || !Number.isFinite(Number(pose.y))) {
      return;
    }

    const point = { x: Number(pose.x), y: Number(pose.y) };
    if (!this.lastTrailPoint) {
      this.liveMowedPath.push(point);
      this.lastTrailPoint = point;
      return;
    }

    if (this.lastTrailPoint) {
      const distance = Math.hypot(point.x - this.lastTrailPoint.x, point.y - this.lastTrailPoint.y);
      if (distance < 1) {
        return;
      }
    }

    this.liveMowedPath.push(point);
    this.lastTrailPoint = point;
    if (this.liveMowedPath.length > 3000) {
      this.liveMowedPath.splice(0, this.liveMowedPath.length - 3000);
    }
  }

  movementHeading(geometry) {
    const trail = this.liveMowedPath;
    if (!trail || trail.length < 2) {
      return null;
    }

    const last = this.robotPositionToScreen(geometry, trail[trail.length - 1]);
    const previous = this.robotPositionToScreen(geometry, trail[trail.length - 2]);
    const dx = last.x - previous.x;
    const dy = last.y - previous.y;
    if (Math.hypot(dx, dy) < 6) {
      return this.robotHeading;
    }

    const nextHeading =
      Math.atan2(dy, dx) + (Number(this.options.robotCalibration?.rotation) || 0);
    this.robotHeading =
      this.robotHeading === null ? nextHeading : smoothAngle(this.robotHeading, nextHeading, 0.35);
    return this.robotHeading;
  }

  cloudHeadingDegrees(pose) {
    const headingCandidates = [
      this.state.cur_pose?.heading,
      this.state.curPose?.heading,
      this.state.map_scan_pose?.heading,
      this.state.mapScanPose?.heading,
      this.state.raw_pose?.heading,
      pose?.heading,
    ];
    for (const value of headingCandidates) {
      const heading = Number(value);
      if (Number.isFinite(heading)) {
        return normalizeHeadingDegrees(heading);
      }
    }

    const yawCandidates = [
      this.state.cur_pose?.yaw,
      this.state.curPose?.yaw,
      this.state.map_scan_pose?.yaw,
      this.state.mapScanPose?.yaw,
      this.state.raw_pose?.yaw,
      pose?.yaw,
    ];
    for (const value of yawCandidates) {
      const yaw = Number(value);
      if (Number.isFinite(yaw)) {
        return milliRadiansToDegrees(yaw);
      }
    }
    return 0;
  }

  robotPositionToScreen(geometry, point) {
    const robotCalibration = this.options.robotCalibration || {};
    const mapPoint = geometry.worldToMap({ x: Number(point.x), y: Number(point.y) });
    return geometry.mapToScreen({
      x: mapPoint.x + (Number(robotCalibration.offsetX) || 0),
      y: mapPoint.y + (Number(robotCalibration.offsetY) || 0),
    });
  }

  isMowingState() {
    const status = String(this.state.mower_status || "").toLowerCase();
    return [
      "mowing",
      "working",
      "cutting",
      "edge_cutting",
      "zone_mowing",
      "zonemowing",
      "nyiras",
      "nyĂ­rĂˇs",
      "nyir",
      "nyĂ­r",
      "munka",
      "vagas",
      "vĂˇgĂˇs",
    ].some((item) => status.includes(item));
  }

  onPointerDown(event) {
    this.canvas.setPointerCapture(event.pointerId);
    this.drag = {
      x: event.clientX,
      y: event.clientY,
      panX: this.view.panX,
      panY: this.view.panY,
    };
  }

  onPointerMove(event) {
    if (!this.drag) {
      return;
    }

    this.view.panX = this.drag.panX + event.clientX - this.drag.x;
    this.view.panY = this.drag.panY + event.clientY - this.drag.y;
    this.draw();
  }

  onPointerUp(event) {
    if (this.drag) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.drag = null;
  }

  onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    this.view.zoom = clamp(this.view.zoom * factor, 0.2, 8);
    this.draw();
  }
}

function fitAspect(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

function rotateAround(point, center, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle) {
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

function smoothAngle(current, next, amount) {
  return current + normalizeAngle(next - current) * amount;
}

function drawPolyline(ctx, points, close = false) {
  if (!points.length) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  if (close) {
    ctx.closePath();
  }
}

function drawImageOnMap(ctx, geometry, source, options = {}) {
  const topLeft = geometry.mapToScreen(options.topLeft);
  const topRight = geometry.mapToScreen(options.topRight);
  const bottomLeft = geometry.mapToScreen(options.bottomLeft);
  drawImageToScreenRect(ctx, source, topLeft, topRight, bottomLeft, options);
}

function drawImageFromWorldRect(ctx, geometry, source, options = {}) {
  const topLeft = geometry.worldToScreen({ x: options.minX, y: options.maxY });
  const topRight = geometry.worldToScreen({ x: options.maxX, y: options.maxY });
  const bottomLeft = geometry.worldToScreen({ x: options.minX, y: options.minY });
  drawImageToScreenRect(ctx, source, topLeft, topRight, bottomLeft, options);
}

function drawImageToScreenRect(ctx, source, topLeft, topRight, bottomLeft, options = {}) {
  const sourceWidth = Number(source.width) || 1;
  const sourceHeight = Number(source.height) || 1;
  const dpr = Number(options.dpr) || 1;
  const a = (topRight.x - topLeft.x) / sourceWidth;
  const b = (topRight.y - topLeft.y) / sourceWidth;
  const c = (bottomLeft.x - topLeft.x) / sourceHeight;
  const d = (bottomLeft.y - topLeft.y) / sourceHeight;

  ctx.save();
  ctx.imageSmoothingEnabled = options.smoothing !== false;
  ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, topLeft.x * dpr, topLeft.y * dpr);
  ctx.drawImage(source, 0, 0);
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, sourceWidth, sourceHeight);
  }
  ctx.restore();
}

function extractPathPoints(value) {
  const direct = normalizePoints(value);
  if (direct.length) {
    return direct;
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractPathPoints(item));
  }

  if (value && typeof value === "object") {
    if (Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))) {
      return [{ x: Number(value.x), y: Number(value.y) }];
    }

    for (const key of ["points", "path", "track", "tracks", "trajectory", "mowed_path", "mowedPath"]) {
      const points = extractPathPoints(value[key]);
      if (points.length) {
        return points;
      }
    }
  }

  return [];
}

function rasterColor(value) {
  if (value === 255) {
    return [248, 250, 252, 255];
  }
  if (value === 160) {
    return [158, 166, 174, 255];
  }
  if (value === 128) {
    return [117, 125, 133, 255];
  }
  if (value === 0) {
    return [25, 32, 42, 255];
  }

  const shade = clamp(Number(value) || 0, 0, 255);
  return [shade, shade, shade, 255];
}

function applyMapCalibration(geometry, calibration = {}) {
  const next = {
    offsetX: Number(calibration.offsetX) || 0,
    offsetY: Number(calibration.offsetY) || 0,
    scaleX: Number(calibration.scaleX) || 1,
    scaleY: Number(calibration.scaleY) || 1,
    rotation: Number(calibration.rotation) || 0,
  };

  return {
    worldToScreen(point) {
      const mapPoint = geometry.worldToMap(point);
      const centered = {
        x: (Number(mapPoint.x) - 0.5) * next.scaleX,
        y: (Number(mapPoint.y) - 0.5) * next.scaleY,
      };
      const cos = Math.cos(next.rotation);
      const sin = Math.sin(next.rotation);
      const calibrated = {
        x: centered.x * cos - centered.y * sin + 0.5 + next.offsetX,
        y: centered.x * sin + centered.y * cos + 0.5 + next.offsetY,
      };
      return geometry.mapToScreen(calibrated);
    },
  };
}

function decodeRasterRuns(raster, width, height) {
  if (!Array.isArray(raster?.runs)) {
    return null;
  }

  const pixels = new Uint8Array(width * height);
  let offset = 0;
  for (let index = 0; index < raster.runs.length - 1; index += 2) {
    const value = clamp(Number(raster.runs[index]) || 0, 0, 255);
    const count = Number(raster.runs[index + 1]);
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }
    pixels.fill(value, offset, Math.min(width * height, offset + count));
    offset += count;
    if (offset >= width * height) {
      break;
    }
  }
  return pixels;
}

function zoneLabel(zone, isNoGo) {
  if (isNoGo) {
    const name = String(zone?.name || zone?.label || "").trim();
    return name && !/^zone\s*\d+$/i.test(name) ? name : "Tiltott";
  }

  const name = String(zone?.name || zone?.label || "").trim();
  if (name) {
    return name;
  }

  return zone?.id === undefined || zone?.id === null ? "Zone" : `Zone ${zone.id}`;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}





