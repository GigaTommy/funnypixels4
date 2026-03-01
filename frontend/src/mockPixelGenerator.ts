/**
 * mockPixelGenerator.ts - Generate mock MapPixel data for development
 *
 * Purpose: Provides test data for Point + SDF architecture without backend.
 * Used during local development to validate rendering pipeline.
 */

import { MapPixel, PixelType } from './types';

/**
 * Generate grid of evenly-spaced mock pixels
 *
 * @param count - Total number of pixels to generate
 * @param center - Center point [lng, lat] in WGS84
 * @param spacing - Distance between pixels in degrees (~0.00012° ≈ 13m)
 * @returns Array of MapPixel with random types
 *
 * Distribution:
 * - 70% color pixels (solid colors)
 * - 20% emoji pixels (Unicode symbols)
 * - 10% complex pixels (custom images)
 */
export function generateMockPixels(
  count: number = 5000,
  center: [number, number] = [-122.42, 37.77], // San Francisco default
  spacing: number = 0.00012
): MapPixel[] {
  const [lng0, lat0] = center;
  const pixels: MapPixel[] = [];
  const side = Math.ceil(Math.sqrt(count));

  // Predefined color palette (web-safe colors for testing)
  const colors = [
    '#FF0000', '#00FF00', '#0000FF', // RGB primaries
    '#FFFF00', '#FF00FF', '#00FFFF', // CMY secondaries
    '#FF8800', '#8800FF', '#00FF88', // Intermediate hues
    '#888888', '#CCCCCC', '#333333'  // Grays
  ];

  // Predefined emoji set (ensure broad Unicode coverage)
  const emojis = [
    '🔥', '🌳', '🏢', '🚗', '⭐', '💎',
    '🎨', '🎯', '🎪', '🎭', '🎮', '🎲',
    '🌈', '🌊', '🌙', '☀️', '⚡', '❄️'
  ];

  // Mock image URLs (simulate backend composition service)
  const mockImages = Array.from({ length: 10 }, (_, i) =>
    `/mock-images/pattern-${i}.png`
  );

  for (let i = 0; i < count; i++) {
    const x = i % side;
    const y = Math.floor(i / side);

    // Calculate center point for this pixel
    const lng = lng0 + (x - side / 2) * spacing;
    const lat = lat0 + (y - side / 2) * spacing;

    // Random type selection with weighted distribution
    const r = Math.random();
    let type: PixelType;
    let color: string | undefined;
    let emoji: string | undefined;
    let imageUrl: string | undefined;

    if (r < 0.7) {
      // 70% color pixels
      type = 'color';
      color = colors[Math.floor(Math.random() * colors.length)];
    } else if (r < 0.9) {
      // 20% emoji pixels
      type = 'emoji';
      emoji = emojis[Math.floor(Math.random() * emojis.length)];
    } else {
      // 10% complex pixels
      type = 'complex';
      imageUrl = mockImages[Math.floor(Math.random() * mockImages.length)];
    }

    pixels.push({
      id: `mock-${i}-${Date.now()}`,
      type,
      lng,
      lat,
      color,
      emoji,
      imageUrl,
      updatedAt: new Date().toISOString()
    });
  }

  return pixels;
}

/**
 * Generate pixels for specific geographic region
 *
 * Helper for testing different locations:
 * - generateRegionPixels('sanfrancisco') - SF downtown
 * - generateRegionPixels('newyork') - NYC Manhattan
 * - generateRegionPixels('hangzhou') - Hangzhou West Lake
 */
export function generateRegionPixels(
  region: 'sanfrancisco' | 'newyork' | 'hangzhou' | 'custom',
  count: number = 5000,
  customCenter?: [number, number]
): MapPixel[] {
  const centers: Record<string, [number, number]> = {
    sanfrancisco: [-122.4194, 37.7749],
    newyork: [-74.0060, 40.7128],
    hangzhou: [120.1551, 30.2741],
    custom: customCenter || [0, 0]
  };

  const center = centers[region];
  return generateMockPixels(count, center);
}

/**
 * Initialize mock data and expose globally for debugging
 *
 * Call this in App.tsx during development mode to populate window.__MOCK_PIXELS__
 * This allows browser console access for manual testing:
 *
 * ```js
 * // In browser console:
 * window.__MOCK_PIXELS__
 * window.__MOCK_PIXELS__.filter(p => p.type === 'emoji')
 * ```
 */
export function initMockPixels(
  region: 'sanfrancisco' | 'newyork' | 'hangzhou' = 'sanfrancisco',
  count: number = 5000
): MapPixel[] {
  const pixels = generateRegionPixels(region, count);

  // Expose globally for debugging
  (window as any).__MOCK_PIXELS__ = pixels;

  // Log summary for developer
  const summary = {
    total: pixels.length,
    color: pixels.filter(p => p.type === 'color').length,
    emoji: pixels.filter(p => p.type === 'emoji').length,
    complex: pixels.filter(p => p.type === 'complex').length
  };

  console.log('🎨 Mock pixels initialized:', summary);
  console.log('📍 Access via: window.__MOCK_PIXELS__');

  return pixels;
}

/**
 * Generate single pixel at specific location (for testing hotpatch)
 */
export function generateSinglePixel(
  lng: number,
  lat: number,
  type?: PixelType
): MapPixel {
  const pixelType = type || (['color', 'emoji', 'complex'][Math.floor(Math.random() * 3)] as PixelType);

  const pixel: MapPixel = {
    id: `single-${Date.now()}-${Math.random()}`,
    type: pixelType,
    lng,
    lat,
    updatedAt: new Date().toISOString()
  };

  // Assign type-specific properties
  if (pixelType === 'color') {
    pixel.color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  } else if (pixelType === 'emoji') {
    const emojis = ['🔥', '🌳', '🏢', '⭐', '💎', '🎨'];
    pixel.emoji = emojis[Math.floor(Math.random() * emojis.length)];
  } else {
    pixel.imageUrl = `/mock-images/pattern-${Math.floor(Math.random() * 10)}.png`;
  }

  return pixel;
}
