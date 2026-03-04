// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Run `npm run sync-images` from the project root to regenerate
//
// Generated: 2026-03-04T18:53:41.607Z

// Available sports (auto-detected from folder structure)
export const AVAILABLE_SPORTS = ["Baseball","Basketball","Football","Generic","Lacrosse-Hockey-Waterpolo","Leaderboard","Rugby","Sequence","Soccer","Tennis","Universal","Volleyball","Wrestling","mocks","test_leaderboard"] as const;
export type Sport = typeof AVAILABLE_SPORTS[number];

// Sport data structure with subsections
export interface SportImageData {
  rootImages: string[];
  subsections: Record<string, string[]>;
  hasSubsections: boolean;
}

// Complete sport data with subsections
export const SPORT_IMAGE_DATA: Record<Sport, SportImageData> = {
  "Baseball": {
    rootImages: ["baseball-base.png","baseball-bases-1-filled.png","baseball-bases-1.png","baseball-bases-2-filled.png","baseball-bases-2.png","baseball-bases-3-filled.png","baseball-bases-3.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Basketball": {
    rootImages: ["basketball-base.png","basketball-bonus-left_bottom-active.png","basketball-bonus-left_bottom.png","basketball-bonus-left_top-active.png","basketball-bonus-left_top.png","basketball-bonus-right_bottom-active.png","basketball-bonus-right_bottom.png","basketball-bonus-right_top-active.png","basketball-bonus-right_top.png","basketball-clock-bg-paused.png","basketball-clock-bg.png","basketball-overtime-overlay.png","basketball-posession-left.png","basketball-posession-right.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Football": {
    rootImages: ["football-base.png","football-clock-bg-paused.png","football-clock-bg.png","football-overtime-overlay.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Generic": {
    rootImages: [],
    subsections: {"Utility":["background_test.jpeg"]},
    hasSubsections: true,
  },
  "Lacrosse-Hockey-Waterpolo": {
    rootImages: ["lacrosse_hockey_waterpolo-base.png","lacrosse_hockey_waterpolo-left-penalty_1.png","lacrosse_hockey_waterpolo-left-penalty_2.png","lacrosse_hockey_waterpolo-left-penalty_3.png","lacrosse_hockey_waterpolo-overtime-overlay.png","lacrosse_hockey_waterpolo-right-penalty_1.png","lacrosse_hockey_waterpolo-right-penalty_2.png","lacrosse_hockey_waterpolo-right-penalty_3.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Leaderboard": {
    rootImages: [],
    subsections: {"Basketball":["leaderboard-basketball-base.png","leaderboard-basketball-stats-row-left.png","leaderboard-basketball-stats-row-right.png"]},
    hasSubsections: true,
  },
  "Rugby": {
    rootImages: ["rugby-base.png","rugby-overtime-overlay.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Sequence": {
    rootImages: ["banner-mockup.png","block-mockup.png","cinema-mockup.png","double-block-mockup.png","panel-mockup.png","scorebug-framed-mockup.png","scorebug-mockup.png","sequence-scorebug-frames.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Soccer": {
    rootImages: ["soccer-base.png","soccer-clock-bg-paused.png","soccer-clock-bg.png","soccer-overtime-overlay.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Tennis": {
    rootImages: ["tennis-base.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Universal": {
    rootImages: ["universal-base.png","universal-clock-bg-paused.png","universal-clock-bg.png","universal-no_clock-bg.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Volleyball": {
    rootImages: ["volleyball-base.png","volleyball-posession-left.png","volleyball-posession-right.png"],
    subsections: {},
    hasSubsections: false,
  },
  "Wrestling": {
    rootImages: ["wrestling-base.png","wrestling-clock-bg-paused.png","wrestling-clock-bg.png","wrestling-no_clock-bg.png"],
    subsections: {},
    hasSubsections: false,
  },
  "mocks": {
    rootImages: [],
    subsections: {"baseball":["lineup/overlay.png","lineup/realistic.png","lineup/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png","vb/overlay.png","vb/realistic.png","vb/stylized.png"],"basketball":["lb/overlay.png","lb/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png","sb+lb/overlay.png","sb+lb/realistic.png","sb+lb/stylized.png","scorebug/overlay.png","scorebug/realistic.png","scorebug/stylized.png","vb/overlay.png"],"equestrian":["player_card/overlay.png","player_card/realistic.png","player_card/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png"],"football":["sb/overlay.png","sb/realistic.png","sb/stylized.png","stadium/overlay.png","stadium/realistic.png","stadium/stylized.png"],"general":["countdown_indoor/overlay.png","countdown_indoor/realistic.png","countdown_indoor/stylized.png","countdown_outdoor/overlay.png","countdown_outdoor/realistic.png","countdown_outdoor/stylized.png"],"hockey":["sb/overlay.png","sb/realistic.png","sb/stylized.png","scorebug/overlay.png","scorebug/realistic.png","scorebug/stylized.png","vb/overlay.png","vb/realistic.png","vb/stylized.png"],"universal":["sb/overlay.png","sb/realistic.png","sb/stylized.png"],"volleyball":["lb/overlay.png","lb/realistic.png","lb/stylized.png","sb/overlay.png","sb/realistic.png","sb/stylized.png","sb+lb/overlay.png","sb+lb/realistic.png","sb+lb/stylized.png","scorebug/overlay.png","scorebug/realistic.png","scorebug/stylized.png","vb/overlay.png","vb/realistic.png","vb/stylized.png"],"water_polo":["sb+sc/overlay.png","sb+sc/realistic.png","sb+sc/stylized.png"],"wrestling":["sb/overlay.png","sb/realistic.png","sb/stylized.png"]},
    hasSubsections: true,
  },
  "test_leaderboard": {
    rootImages: ["lb_arrow_border.png","lb_arrow_border_away.png","lb_arrow_border_home.png","lb_arrow_fill.png","lb_arrow_fill_away.png","lb_arrow_fill_home.png","lb_bb_away_highlight_border.png","lb_bb_away_slot.png","lb_bb_home_highlight_border.png","lb_bb_home_slot.png"],
    subsections: {},
    hasSubsections: false,
  },
};

// Legacy flat manifest (root images only, for backwards compatibility)
export const KNOWN_IMAGES: Record<Sport, string[]> = {
  "Baseball": ["baseball-base.png","baseball-bases-1-filled.png","baseball-bases-1.png","baseball-bases-2-filled.png","baseball-bases-2.png","baseball-bases-3-filled.png","baseball-bases-3.png"],
  "Basketball": ["basketball-base.png","basketball-bonus-left_bottom-active.png","basketball-bonus-left_bottom.png","basketball-bonus-left_top-active.png","basketball-bonus-left_top.png","basketball-bonus-right_bottom-active.png","basketball-bonus-right_bottom.png","basketball-bonus-right_top-active.png","basketball-bonus-right_top.png","basketball-clock-bg-paused.png","basketball-clock-bg.png","basketball-overtime-overlay.png","basketball-posession-left.png","basketball-posession-right.png"],
  "Football": ["football-base.png","football-clock-bg-paused.png","football-clock-bg.png","football-overtime-overlay.png"],
  "Generic": [],
  "Lacrosse-Hockey-Waterpolo": ["lacrosse_hockey_waterpolo-base.png","lacrosse_hockey_waterpolo-left-penalty_1.png","lacrosse_hockey_waterpolo-left-penalty_2.png","lacrosse_hockey_waterpolo-left-penalty_3.png","lacrosse_hockey_waterpolo-overtime-overlay.png","lacrosse_hockey_waterpolo-right-penalty_1.png","lacrosse_hockey_waterpolo-right-penalty_2.png","lacrosse_hockey_waterpolo-right-penalty_3.png"],
  "Leaderboard": [],
  "Rugby": ["rugby-base.png","rugby-overtime-overlay.png"],
  "Sequence": ["banner-mockup.png","block-mockup.png","cinema-mockup.png","double-block-mockup.png","panel-mockup.png","scorebug-framed-mockup.png","scorebug-mockup.png","sequence-scorebug-frames.png"],
  "Soccer": ["soccer-base.png","soccer-clock-bg-paused.png","soccer-clock-bg.png","soccer-overtime-overlay.png"],
  "Tennis": ["tennis-base.png"],
  "Universal": ["universal-base.png","universal-clock-bg-paused.png","universal-clock-bg.png","universal-no_clock-bg.png"],
  "Volleyball": ["volleyball-base.png","volleyball-posession-left.png","volleyball-posession-right.png"],
  "Wrestling": ["wrestling-base.png","wrestling-clock-bg-paused.png","wrestling-clock-bg.png","wrestling-no_clock-bg.png"],
  "mocks": [],
  "test_leaderboard": ["lb_arrow_border.png","lb_arrow_border_away.png","lb_arrow_border_home.png","lb_arrow_fill.png","lb_arrow_fill_away.png","lb_arrow_fill_home.png","lb_bb_away_highlight_border.png","lb_bb_away_slot.png","lb_bb_home_highlight_border.png","lb_bb_home_slot.png"],
};

/**
 * Get the relative path to an image
 * @param filename - The image filename
 * @param sport - The sport category
 * @param subsection - Optional subsection within the sport
 * @returns Path like '/images/basketball/frame.png' or '/images/basketball/Full/frame.png'
 */
export function getImagePath(filename: string, sport: Sport = 'Generic', subsection?: string): string {
  if (subsection) {
    return `/images/${sport}/${subsection}/${filename}`;
  }
  return `/images/${sport}/${filename}`;
}

/**
 * Get all root images for a sport (always shown when sport is selected)
 */
export function getRootImages(sport: Sport): string[] {
  return SPORT_IMAGE_DATA[sport]?.rootImages || [];
}

/**
 * Get all images for a sport (legacy, returns only root images)
 */
export function getImagesForSport(sport: Sport): string[] {
  return getRootImages(sport);
}

/**
 * Get subsection names for a sport
 */
export function getSubsections(sport: Sport): string[] {
  const data = SPORT_IMAGE_DATA[sport];
  return data ? Object.keys(data.subsections) : [];
}

/**
 * Get images for a specific subsection
 */
export function getSubsectionImages(sport: Sport, subsection: string): string[] {
  return SPORT_IMAGE_DATA[sport]?.subsections[subsection] || [];
}

/**
 * Check if a sport has subsections
 */
export function hasSubsections(sport: Sport): boolean {
  return SPORT_IMAGE_DATA[sport]?.hasSubsections || false;
}

/**
 * Get all available images for a sport (root + selected subsection)
 * @param sport - The sport category
 * @param subsection - Optional subsection to include
 * @returns Combined array of root images and subsection images
 */
export function getAvailableImagesForSport(sport: Sport, subsection?: string): string[] {
  const data = SPORT_IMAGE_DATA[sport];
  if (!data) return [];

  const images = [...data.rootImages];

  if (subsection && data.subsections[subsection]) {
    images.push(...data.subsections[subsection]);
  }

  return images;
}

/**
 * Check if an image exists in a sport category
 */
export function hasImage(filename: string, sport: Sport): boolean {
  const data = SPORT_IMAGE_DATA[sport];
  if (!data) return false;

  // Check root images
  if (data.rootImages.includes(filename)) return true;

  // Check all subsections
  for (const images of Object.values(data.subsections)) {
    if (images.includes(filename)) return true;
  }

  return false;
}

/**
 * Find which sport an image belongs to
 */
export function findImageSport(filename: string): Sport | null {
  for (const sport of AVAILABLE_SPORTS) {
    if (hasImage(filename, sport)) {
      return sport;
    }
  }
  return null;
}
