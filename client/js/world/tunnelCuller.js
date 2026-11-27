import { gameState } from "../core/gameState.js";
import { RoadLayer } from "./roadConstants.js";

/* ================================================================
   TUNNEL CULLER & ATMOSPHERE CONTROLLER
   When the player drives inside an underground tunnel:
   - Reduces effective camera.far (380m -> 130m) so GPU frustum skips
     far city skyline geometry.
   - Tightens atmospheric fog for realistic underground depth.
   - Restores open daylight frustum cleanly before exiting the portal.
================================================================ */

let _wasInTunnel = false;
const OPEN_CAMERA_FAR = 380;
const TUNNEL_CAMERA_FAR = 145;

export function updateTunnelCulling(isInTunnel) {
  const { camera, scene } = gameState;
  if (!camera || !scene) return;

  if (isInTunnel === _wasInTunnel) return;
  _wasInTunnel = isInTunnel;

  // Adjust camera frustum far clip plane for performance boost inside tunnel
  const targetFar = isInTunnel ? TUNNEL_CAMERA_FAR : OPEN_CAMERA_FAR;
  if (camera.far !== targetFar) {
    camera.far = targetFar;
    camera.updateProjectionMatrix();
  }

  // Tighten fog inside tunnel for deep enclosed underground ambiance
  if (scene.fog) {
    if (isInTunnel) {
      scene.fog.near = 18;
      scene.fog.far = 92;
    } else {
      scene.fog.near = 35;
      scene.fog.far = 115;
    }
  }
}

export function resetTunnelCulling() {
  _wasInTunnel = false;
  if (gameState.camera && gameState.camera.far !== OPEN_CAMERA_FAR) {
    gameState.camera.far = OPEN_CAMERA_FAR;
    gameState.camera.updateProjectionMatrix();
  }
  if (gameState.scene?.fog) {
    gameState.scene.fog.near = 35;
    gameState.scene.fog.far = 115;
  }
}

export function isLayerUnderground(layer) {
  return layer === RoadLayer.UNDERGROUND;
}
