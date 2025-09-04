// Utility functions for handling images in the layout builder

// For now, we'll maintain a static list of available images
// In a real application, this could be dynamically loaded from the server
export const getAvailableImages = (): string[] => {
  return [
    'universal-stub.png'
  ];
};

// Helper function to get the full path for a local image
export const getImagePath = (filename: string): string => {
  return `/images/${filename}`;
};

// Helper function to validate image URLs
export const isValidImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};