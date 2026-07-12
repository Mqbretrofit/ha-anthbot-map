export const DEFAULT_CALIBRATION = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
});

export function readCalibration(config = {}) {
  return {
    ...DEFAULT_CALIBRATION,
    ...(config.calibration || {}),
  };
}

export function readRobotCalibration(config = {}) {
  return {
    ...DEFAULT_CALIBRATION,
    ...(config.robotCalibration || {}),
  };
}

export function readDecodedBoundaryCalibration(config = {}) {
  return {
    ...DEFAULT_CALIBRATION,
    ...(config.decodedBoundaryCalibration || config.decoded_boundary_calibration || {}),
  };
}

export function resetCalibration() {
  return { ...DEFAULT_CALIBRATION };
}

export function adjustCalibration(calibration, action, amount = 1) {
  const next = { ...DEFAULT_CALIBRATION, ...(calibration || {}) };
  const move = 0.01 * amount;
  const scale = 0.02 * amount;
  const rotate = (Math.PI / 180) * amount;
  const rotateLarge = (Math.PI / 12) * amount;

  switch (action) {
    case "left":
      next.offsetX -= move;
      break;
    case "right":
      next.offsetX += move;
      break;
    case "up":
      next.offsetY -= move;
      break;
    case "down":
      next.offsetY += move;
      break;
    case "wider":
      next.scaleX += scale;
      break;
    case "narrower":
      next.scaleX = Math.max(0.1, next.scaleX - scale);
      break;
    case "taller":
      next.scaleY += scale;
      break;
    case "shorter":
      next.scaleY = Math.max(0.1, next.scaleY - scale);
      break;
    case "rotate-left":
      next.rotation -= rotate;
      break;
    case "rotate-right":
      next.rotation += rotate;
      break;
    case "rotate-left-large":
      next.rotation -= rotateLarge;
      break;
    case "rotate-right-large":
      next.rotation += rotateLarge;
      break;
    case "rotate-around":
      next.rotation += Math.PI;
      break;
    default:
      break;
  }

  return next;
}

export function calibrationToYaml(calibration) {
  const next = { ...DEFAULT_CALIBRATION, ...(calibration || {}) };

  return [
    "calibration:",
    `  offsetX: ${formatNumber(next.offsetX)}`,
    `  offsetY: ${formatNumber(next.offsetY)}`,
    `  scaleX: ${formatNumber(next.scaleX)}`,
    `  scaleY: ${formatNumber(next.scaleY)}`,
    `  rotation: ${formatNumber(next.rotation)}`,
  ].join("\n");
}

export function robotCalibrationToYaml(robotCalibration) {
  const next = { ...DEFAULT_CALIBRATION, ...(robotCalibration || {}) };

  return [
    "robotCalibration:",
    `  offsetX: ${formatNumber(next.offsetX)}`,
    `  offsetY: ${formatNumber(next.offsetY)}`,
    `  scaleX: ${formatNumber(next.scaleX)}`,
    `  rotation: ${formatNumber(next.rotation)}`,
  ].join("\n");
}

export function decodedBoundaryCalibrationToYaml(decodedBoundaryCalibration) {
  const next = { ...DEFAULT_CALIBRATION, ...(decodedBoundaryCalibration || {}) };

  return [
    "decodedBoundaryCalibration:",
    `  offsetX: ${formatNumber(next.offsetX)}`,
    `  offsetY: ${formatNumber(next.offsetY)}`,
    `  scaleX: ${formatNumber(next.scaleX)}`,
    `  scaleY: ${formatNumber(next.scaleY)}`,
    `  rotation: ${formatNumber(next.rotation)}`,
  ].join("\n");
}

export function cardToYaml(config = {}, calibration, robotCalibration, decodedBoundaryCalibration) {
  const lines = [
    "type: custom:anthbot-map-card",
    `entity: ${config.entity || ""}`,
  ];

  if (config.name) {
    lines.push(`name: ${quoteYaml(config.name)}`);
  }

  if (config.image) {
    lines.push(`image: ${quoteYaml(config.image)}`);
  }

  if (config.robot_image || config.robotImage) {
    lines.push(`robot_image: ${quoteYaml(config.robot_image || config.robotImage)}`);
  }

  if (Number.isFinite(Number(config.robot_size || config.robotSize))) {
    lines.push(`robot_size: ${formatNumber(config.robot_size || config.robotSize)}`);
  }

  if (Number.isFinite(Number(config.robot_image_rotation ?? config.robotImageRotation))) {
    lines.push(`robot_image_rotation: ${formatNumber(config.robot_image_rotation ?? config.robotImageRotation)}`);
  }

  if (config.robot_heading_source || config.robotHeadingSource) {
    lines.push(`robot_heading_source: ${quoteYaml(config.robot_heading_source || config.robotHeadingSource)}`);
  }

  if (Number.isFinite(Number(config.robot_heading_offset ?? config.robotHeadingOffset))) {
    lines.push(`robot_heading_offset: ${formatNumber(config.robot_heading_offset ?? config.robotHeadingOffset)}`);
  }

  if (Number.isFinite(Number(config.robot_mowing_heading_offset ?? config.robotMowingHeadingOffset))) {
    lines.push(
      `robot_mowing_heading_offset: ${formatNumber(
        config.robot_mowing_heading_offset ?? config.robotMowingHeadingOffset,
      )}`,
    );
  }

  if (config.show_mowed_path === false) {
    lines.push("show_mowed_path: false");
  }

  if (config.show_decoded_boundary === false || config.showDecodedBoundary === false) {
    lines.push("show_decoded_boundary: false");
  }

  if (config.show_zones === false || config.showZones === false) {
    lines.push("show_zones: false");
  }

  if (config.show_legacy_boundary === true || config.showLegacyBoundary === true) {
    lines.push("show_legacy_boundary: true");
  }

  if (config.mowed_path_color || config.mowedPathColor) {
    lines.push(`mowed_path_color: ${quoteYaml(config.mowed_path_color || config.mowedPathColor)}`);
  }

  if (config.mowed_path_source || config.mowedPathSource) {
    lines.push(`mowed_path_source: ${quoteYaml(config.mowed_path_source || config.mowedPathSource)}`);
  }

  if (Number.isFinite(Number(config.mowed_path_width ?? config.mowedPathWidth))) {
    lines.push(`mowed_path_width: ${formatNumber(config.mowed_path_width ?? config.mowedPathWidth)}`);
  }

  if (config.fit) {
    lines.push(`fit: ${quoteYaml(config.fit)}`);
  }

  if (Number.isFinite(Number(config.rotation)) && Number(config.rotation) !== 0) {
    lines.push(`rotation: ${formatNumber(config.rotation)}`);
  }

  if (Number.isFinite(Number(config.height))) {
    lines.push(`height: ${formatNumber(config.height)}`);
  }

  if (Number.isFinite(Number(config.refresh_interval ?? config.refreshInterval))) {
    lines.push(`refresh_interval: ${formatNumber(config.refresh_interval ?? config.refreshInterval)}`);
  }

  if (
    config.charger &&
    Number.isFinite(Number(config.charger.x)) &&
    Number.isFinite(Number(config.charger.y))
  ) {
    lines.push("charger:");
    lines.push(`  x: ${formatNumber(config.charger.x)}`);
    lines.push(`  y: ${formatNumber(config.charger.y)}`);
  }

  if (config.entities && typeof config.entities === "object") {
    lines.push("entities:");
    for (const key of ["battery", "status", "charging"]) {
      if (config.entities[key]) {
        lines.push(`  ${key}: ${config.entities[key]}`);
      }
    }
  }

  if (config.controls && typeof config.controls === "object") {
    lines.push("controls:");
    for (const key of ["start", "stop", "dock"]) {
      if (config.controls[key]) {
        lines.push(`  ${key}: ${config.controls[key]}`);
      }
    }
  }

  lines.push(calibrationToYaml(calibration));
  lines.push(robotCalibrationToYaml(robotCalibration));
  lines.push(decodedBoundaryCalibrationToYaml(decodedBoundaryCalibration));

  return lines.join("\n");
}

function formatNumber(value) {
  return Number(value).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}
