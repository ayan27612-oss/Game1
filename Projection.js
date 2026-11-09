export const CAM_TILT = 0.72;

export const CAMERA_ZOOM = 0.92;

export function projectAngle(angle, tilt = CAM_TILT) {
  return Math.atan2(Math.sin(angle) * tilt, Math.cos(angle));
}

export function screenDirToWorld(x, y, tilt = CAM_TILT) {
  const wy = y / tilt;
  const m = Math.hypot(x, wy) || 1;
  return { x: x / m, y: wy / m };
}
