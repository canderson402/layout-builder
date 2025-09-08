// Utility functions for handling images in the layout builder

// Dynamically discover all images in the public/images directory
let availableImages: string[] = [];

// Function to dynamically discover images by testing common files
export const loadAvailableImages = async (): Promise<string[]> => {
  try {
    // List of potential image files to check for
    // Add any new images you place in public/images/ to this list
    const potentialImages = [
      'universal-stub.png',
      'face.png', 
      'clock-node.png',
      'test_score.png',
      'logo.png',
      'background.jpg',
      'team-logo.png',
      'sponsor.png',
      'banner.png',
      'header.jpg'
    ];
    
    // Test each potential image to see if it exists
    const imagePromises = potentialImages.map(async (filename) => {
      try {
        const response = await fetch(`/images/${filename}`, { method: 'HEAD' });
        if (response.ok) {
          return filename;
        }
      } catch (error) {
        // Image doesn't exist
      }
      return null;
    });
    
    const results = await Promise.all(imagePromises);
    const foundImages = results.filter((filename): filename is string => filename !== null);
    
    availableImages = foundImages;
    console.log(`Found ${foundImages.length} images:`, foundImages);
    return foundImages;
  } catch (error) {
    console.error('Failed to load available images:', error);
    // Fallback to known existing images
    const fallbackImages = ['universal-stub.png', 'face.png', 'clock-node.png', 'test_score.png'];
    availableImages = fallbackImages;
    return fallbackImages;
  }
};

// Get cached available images (call loadAvailableImages first)
export const getAvailableImages = (): string[] => {
  return availableImages;
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