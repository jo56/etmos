/**
 * D3 force simulation configuration constants
 * Controls the physics and layout behavior of the language graph
 */

/**
 * Link force configuration
 * Controls the connection strength and distance between linked nodes
 */
export const LINK_FORCE_CONFIG = {
  /** Target distance between linked nodes */
  distance: 180,
  /** Strength of the link force (0-1) */
  strength: 0.2
} as const;

/**
 * Charge force configuration
 * Controls node repulsion to prevent overlap
 */
export const CHARGE_FORCE_CONFIG = {
  /** Negative value creates repulsion between nodes */
  strength: -300,
  /** Maximum distance at which repulsion is applied */
  distanceMax: 400
} as const;

/**
 * Center force configuration
 * Pulls the graph toward the center of the viewport
 */
export const CENTER_FORCE_CONFIG = {
  /** Strength of the centering force (0-1) */
  strength: 0.005
} as const;

/**
 * Collision force configuration
 * Prevents nodes from overlapping
 */
export const COLLISION_FORCE_CONFIG = {
  /** Additional padding around each node for collision detection */
  radiusPadding: 20,
  /** Strength of the collision prevention (0-1) */
  strength: 0.8
} as const;

/**
 * Position force configuration
 * Weak forces that gently pull nodes toward center on each axis
 */
export const POSITION_FORCE_CONFIG = {
  /** Strength of X-axis centering (0-1) */
  xStrength: 0.005,
  /** Strength of Y-axis centering (0-1) */
  yStrength: 0.005
} as const;

/**
 * Simulation behavior configuration
 */
export const SIMULATION_BEHAVIOR_CONFIG = {
  /** Alpha decay rate - controls simulation cooldown speed */
  alphaDecay: 0.01,
  /** Velocity decay rate - controls momentum damping */
  velocityDecay: 0.3,
  /** Alpha target after drag ends */
  dragAlphaTarget: 0.3,
  /** Alpha restart value for minor adjustments */
  restartAlpha: 0.02,
  /** Delay before releasing fixed position after drag (ms) */
  dragReleaseDelay: 1000,
  /** Minimum drag distance for visual feedback (pixels) */
  minDragDistance: 5
} as const;

/**
 * Notification configuration
 */
export const NOTIFICATION_CONFIG = {
  /** Duration to show notifications (ms) */
  duration: 3000
} as const;
