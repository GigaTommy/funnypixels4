/**
 * types.ts - Point-centered pixel architecture
 *
 * Changed from polygon-based to point-centered representation for industrial-grade
 * SDF symbol rendering. Each pixel is now represented by its center lat/lng,
 * eliminating polygon complexity and enabling seamless tile-boundary rendering.
 */

/**
 * Pixel type determines rendering strategy:
 * - color: SDF icon with icon-color property
 * - emoji: Text symbol with native Unicode emoji
 * - complex: Raster tile reference for custom images
 */
export type PixelType = "color" | "emoji" | "complex";

/**
 * MapPixel - Point-centered pixel representation
 *
 * Uses center coordinates instead of polygon bounds for:
 * 1. Smaller MVT payload (1 point vs 5 polygon coords)
 * 2. No tile-boundary artifacts (symbols render atomically)
 * 3. Native MapLibre symbol clustering/collision detection
 */
export interface MapPixel {
  /** Unique pixel identifier (typically "x-y-timestamp" or UUID) */
  id: string;

  /** Rendering strategy selector */
  type: PixelType;

  /** Center longitude (WGS84) - used for Point geometry */
  lng: number;

  /** Center latitude (WGS84) - used for Point geometry */
  lat: number;

  /** Hex color (e.g., "#ff00aa") - required for type="color" */
  color?: string;

  /** Unicode emoji character (e.g., "🔥") - required for type="emoji" */
  emoji?: string;

  /**
   * Pattern ID - for type="complex" (e.g., user_avatar_{userId}, custom_flag_{id})
   * Used as sprite identifier in MapLibre
   */
  patternId?: string;

  /**
   * Complex image reference - for type="complex"
   * Can be backend composition URL or asset identifier
   * Rendered via separate raster tile layer
   */
  imageUrl?: string;

  /** ISO timestamp for last update (used for cache invalidation) */
  updatedAt?: string;
}

/**
 * GeoJSON Feature type for hotpatch layer
 * Used for instant updates before MVT tile refresh
 */
export interface PixelFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    type: PixelType;
    color?: string;
    emoji?: string;
    patternId?: string;  // 🆕 Pattern ID for complex types
    imageUrl?: string;
    updatedAt?: string;
  };
}

/**
 * GeoJSON FeatureCollection for hotpatch batching
 */
export interface PixelFeatureCollection {
  type: "FeatureCollection";
  features: PixelFeature[];
}

/**
 * Tile update event from WebSocket
 * The tileUpdateSubscriber sends these when pixels change
 */
export interface TileUpdateEvent {
  /** Tile coordinate in z/x/y format */
  tile: string;

  /** Updated pixels (already in Point format from backend) */
  pixels: MapPixel[];

  /** Update timestamp */
  timestamp: string;
}

/**
 * Convert MapPixel to GeoJSON Feature for hotpatch layer
 */
export function pixelToFeature(pixel: MapPixel): PixelFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [pixel.lng, pixel.lat]
    },
    properties: {
      id: pixel.id,
      type: pixel.type,
      color: pixel.color,
      emoji: pixel.emoji,
      patternId: pixel.patternId,  // 🆕 Pass pattern ID
      imageUrl: pixel.imageUrl,
      updatedAt: pixel.updatedAt
    }
  };
}

/**
 * Create empty FeatureCollection for initialization
 */
export function createEmptyFeatureCollection(): PixelFeatureCollection {
  return {
    type: "FeatureCollection",
    features: []
  };
}
