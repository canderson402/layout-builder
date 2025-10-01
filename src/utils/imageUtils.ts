// Utility functions for handling images in the layout builder

// Sport-based image organization
export const AVAILABLE_SPORTS = ['general', 'basketball', 'break', 'volleyball'] as const;
export type Sport = typeof AVAILABLE_SPORTS[number];

// Cache for sport-specific images
let sportImages: Record<Sport, string[]> = {
  general: [],
  basketball: [],
  break: [],
  volleyball: []
};

// Function to dynamically discover images by sport
export const loadAvailableImages = async (sport: Sport = 'general'): Promise<string[]> => {
  try {
    if (sport === 'general') {
      // List of potential image files to check for in root images directory
      const potentialImages = [
        'universal-stub.png',
        'face.png',
        'clock-node.png',
        'test_score.png',
        'wrapper-16x9-ATV.jpg',
        'bb-sb-standard-frames-universal.png'
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

      sportImages.general = foundImages;
      console.log(`Found ${foundImages.length} general images:`, foundImages);
      return foundImages;

    } else if (sport === 'basketball') {
      // Basketball-specific images
      const basketballImages = [
        'bb-full-tall-arrow-left.png',
        'bb-full-tall-arrow-right.png',
        'bb-full-tall-bonus-l-b-off.png',
        'bb-full-tall-bonus-l-b-on.png',
        'bb-full-tall-bonus-l-t-off.png',
        'bb-full-tall-bonus-l-t-on.png',
        'bb-full-tall-bonus-r-b-off.png',
        'bb-full-tall-bonus-r-b-on.png',
        'bb-full-tall-bonus-r-t-off.png',
        'bb-full-tall-bonus-r-t-on.png',
        'bb-full-tall-clock-bg.png',
        'bb-full-tall-clock-stopped.png',
        'bb-full-tall-frame.png',
        'bb-full-tall-overtime-bg.png',
        'bb-full-tall-period-bg.png',
        'bb-full-tall-team-color-left.png',
        'bb-full-tall-team-color-right.png'
      ];

      // Test each basketball image to see if it exists
      const imagePromises = basketballImages.map(async (filename) => {
        try {
          const response = await fetch(`/images/basketball/${filename}`, { method: 'HEAD' });
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

      sportImages.basketball = foundImages;
      console.log(`Found ${foundImages.length} basketball images:`, foundImages);
      return foundImages;
    } else if (sport === 'break') {
      // Break-specific images
      const breakImages = [
        '16x9-cd-ind-timeout.png',
        '16x9-cd-score-base.png',
        '16x9-cd-time-base.png',
        '16x9-cd-time-tab.png'
      ];

      // Test each break image to see if it exists
      const imagePromises = breakImages.map(async (filename) => {
        try {
          const response = await fetch(`/images/break/${filename}`, { method: 'HEAD' });
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

      sportImages.break = foundImages;
      console.log(`Found ${foundImages.length} break images:`, foundImages);
      return foundImages;
    } else if (sport === 'volleyball') {
      // Volleyball-specific images
      const volleyballImages = [
        'vb-full-frames.png',
        'vb-full-period-bg.png'
      ];

      // Test each volleyball image to see if it exists
      const imagePromises = volleyballImages.map(async (filename) => {
        try {
          const response = await fetch(`/images/volleyball/${filename}`, { method: 'HEAD' });
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

      sportImages.volleyball = foundImages;
      console.log(`Found ${foundImages.length} volleyball images:`, foundImages);
      return foundImages;
    }

    return [];
  } catch (error) {
    console.error(`Failed to load available images for ${sport}:`, error);
    // Fallback to known existing images
    if (sport === 'general') {
      const fallbackImages = ['universal-stub.png', 'face.png', 'clock-node.png', 'test_score.png'];
      sportImages.general = fallbackImages;
      return fallbackImages;
    }
    return [];
  }
};

// Get cached available images for a specific sport
export const getAvailableImages = (sport: Sport = 'general'): string[] => {
  return sportImages[sport] || [];
};

// Helper function to get the full path for a local image
export const getImagePath = (filename: string, sport: Sport = 'general'): string => {
  if (sport === 'general') {
    return `/images/${filename}`;
  }
  return `/images/${sport}/${filename}`;
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