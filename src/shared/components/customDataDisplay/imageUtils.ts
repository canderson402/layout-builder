/**
 * Image utilities for CustomDataDisplay.
 * Handles image path resolution, source detection, and anchor alignment.
 */

// Base URL for assets (handles GitHub Pages base path)
const BASE_URL = import.meta.env.BASE_URL || '/';

/**
 * Resolves local image paths with the base URL for GitHub Pages compatibility.
 */
export const resolveImagePath = (path: string): string => {
  if (!path) return path;
  // If path already starts with http/https or data:, return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // If path starts with /, remove it and prepend BASE_URL
  if (path.startsWith('/')) {
    return `${BASE_URL}${path.slice(1)}`;
  }
  // Otherwise prepend BASE_URL directly
  return `${BASE_URL}${path}`;
};

/**
 * Checks if a data path refers to an image URL field.
 */
export const isImageDataPath = (dataPath: string): boolean => {
  return dataPath && (
    dataPath.endsWith('.imageUrl') ||
    dataPath.endsWith('.image') ||
    dataPath === 'imageUrl' ||
    dataPath === 'image'
  );
};

/**
 * Gets the image source object based on component configuration.
 */
export const getImageSource = (
  imageSource: 'none' | 'local' | 'url',
  imagePath: string | undefined,
  imageUrl: string | undefined,
  dataPath: string,
  rawValue: any,
  mockBannerData: any,
  currentBannerIndex: number
): { uri: string } | null => {
  // If user has explicitly set a local or URL image, use that for preview
  if (imageSource === 'local' && imagePath) {
    return { uri: resolveImagePath(imagePath) };
  }
  if (imageSource === 'url' && imageUrl) {
    return { uri: imageUrl };
  }

  // If dataPath points to an image URL, use the value from game data
  if (isImageDataPath(dataPath) && rawValue) {
    const imageUrlValue = String(rawValue);
    // Only use if it looks like a valid URL or path
    if (imageUrlValue && imageUrlValue !== '--' && (
      imageUrlValue.startsWith('http://') ||
      imageUrlValue.startsWith('https://') ||
      imageUrlValue.startsWith('/') ||
      imageUrlValue.startsWith('data:')
    )) {
      return { uri: resolveImagePath(imageUrlValue) };
    }
  }

  // Handle banner ads with mock data (only if no image explicitly set)
  if (dataPath === 'user_sequences.banner') {
    const bannerEntries = mockBannerData.entries;
    if (bannerEntries.length > 0) {
      const currentEntry = bannerEntries[currentBannerIndex] || bannerEntries[0];
      return { uri: currentEntry.image?.url };
    }
    return null;
  }

  return null;
};

export type ImageAnchor = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

/**
 * Converts anchor point to flexbox alignment properties.
 */
export const getAnchorAlignment = (imageAnchor: ImageAnchor): {
  justifyContent: string;
  alignItems: string;
} => {
  switch (imageAnchor) {
    case 'top-left':
      return { justifyContent: 'flex-start', alignItems: 'flex-start' };
    case 'top-right':
      return { justifyContent: 'flex-start', alignItems: 'flex-end' };
    case 'bottom-left':
      return { justifyContent: 'flex-end', alignItems: 'flex-start' };
    case 'bottom-right':
      return { justifyContent: 'flex-end', alignItems: 'flex-end' };
    case 'center':
    default:
      return { justifyContent: 'center', alignItems: 'center' };
  }
};
