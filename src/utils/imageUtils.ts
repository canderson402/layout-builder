/**
 * Utility functions for handling images in the layout builder
 *
 * This file uses the auto-generated image manifest.
 * To add new images:
 *   1. Add images to Images/{sport}/ folder at project root
 *   2. Run `npm run sync-images` from the project root
 *
 * DO NOT manually edit the generated manifest file.
 */

// Import from auto-generated manifest
import {
  AVAILABLE_SPORTS as GENERATED_SPORTS,
  SPORT_IMAGE_DATA,
  KNOWN_IMAGES,
  type Sport as GeneratedSport,
  getImagePath as generatedGetImagePath,
  getRootImages,
  getSubsections,
  getSubsectionImages,
  hasSubsections,
  getAvailableImagesForSport,
  hasImage,
  findImageSport,
} from './imageManifest.generated';

// Re-export generated types and constants
export const AVAILABLE_SPORTS = GENERATED_SPORTS;
export type Sport = GeneratedSport;

// Cache for sport-specific images (initialized from manifest)
let sportImages: Record<Sport, string[]> = {} as Record<Sport, string[]>;

// Initialize cache from manifest
for (const sport of AVAILABLE_SPORTS) {
  sportImages[sport] = KNOWN_IMAGES[sport] || [];
}

/**
 * Load available images for a sport with optional subsection
 * Now synchronous since images come from generated manifest
 */
export const loadAvailableImages = async (
  sport: Sport = 'Basketball',
  subsection?: string
): Promise<string[]> => {
  return getAvailableImagesForSport(sport, subsection);
};

/**
 * Get cached available images for a specific sport
 */
export const getAvailableImages = (sport: Sport = 'Basketball'): string[] => {
  return sportImages[sport] || KNOWN_IMAGES[sport] || [];
};

/**
 * Get the path for a local image
 * Returns path in format '/images/{sport}/{filename}' or '/images/{sport}/{subsection}/{path}'
 */
export const getImagePath = (
  filename: string,
  sport: Sport = 'Basketball',
  subsection?: string
): string => {
  return generatedGetImagePath(filename, sport, subsection);
};

/**
 * Validate if a string is a valid image URL
 */
export const isValidImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Re-export additional utilities from generated manifest
export {
  SPORT_IMAGE_DATA,
  KNOWN_IMAGES,
  getRootImages,
  getSubsections,
  getSubsectionImages,
  hasSubsections,
  getAvailableImagesForSport,
  hasImage,
  findImageSport,
};
