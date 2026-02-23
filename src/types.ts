export interface ComponentConfig {
  type: 'teamName' | 'score' | 'clock' | 'period' | 'fouls' | 'timeouts' | 'bonus' | 'custom' | 'dynamicList' | 'leaderboardList' | 'slotList' | 'group';
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  layer?: number; // z-index for stacking order (higher values appear on top)
  props?: any;
  team?: 'home' | 'away' | 'both';
  id: string; // Hidden UUID identifier
  displayName?: string; // Human-readable name shown in UI
  visible?: boolean; // Whether the component is visible (default: true)
  useTeamColor?: boolean; // Whether to use team colors instead of custom colors
  teamColorSide?: 'home' | 'away'; // Which team's color to use
  parentId?: string; // ID of parent component (children move with parent)
  originalAspectRatio?: number; // Stored aspect ratio (width/height) for precise scaling
  originalSize?: { width: number; height: number }; // Original/base dimensions for percentage-based scaling
  scaleAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // Anchor point for scaling (default: corner being dragged)
  slot?: number; // Slot index (0-4) for leaderboard/slot components - used by TV app for cycling animation
}

// Slot template for reusable slot designs (leaderboard rows, penalty boxes, etc.)
export interface SlotTemplate {
  id: string;
  name: string;
  description?: string;
  isPreset?: boolean; // True for built-in preset templates
  // The template components with relative data paths (e.g., 'jersey', 'name', 'points')
  components: ComponentConfig[];
  // Template dimensions (the size of one slot)
  slotSize: {
    width: number;
    height: number;
  };
  // Original slot size for percentage-based scaling (set when template is created)
  originalSlotSize?: {
    width: number;
    height: number;
  };
  createdAt: number;
  updatedAt: number;
}

// SlotList component props
export interface SlotListProps {
  templateId: string; // Reference to saved SlotTemplate
  team: 'home' | 'away';
  slotCount: number; // How many slots to render (1-10)
  slotSpacing: number; // Gap between slots in pixels
  direction: 'vertical' | 'horizontal'; // Stack direction
  dataPathPrefix: string; // e.g., 'leaderboardSlots' or 'penaltySlots'
}

// Component group template for reusable component groups (team names, score displays, etc.)
export interface ComponentGroupTemplate {
  id: string;
  name: string;
  description?: string;
  // The components with positions normalized to (0,0) origin
  components: ComponentConfig[];
  // Bounding box of all components
  boundingBox: {
    width: number;
    height: number;
  };
  createdAt: number;
  updatedAt: number;
}

// Predefined layout types that the TV app can load
export const LAYOUT_TYPES = [
  // Sports (alphabetical)
  { value: 'badminton', label: 'Badminton' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'football', label: 'Football' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'lacrosse', label: 'Lacrosse' },
  { value: 'rugby', label: 'Rugby' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'waterpolo', label: 'Water Polo' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'wrestlingTeamScore', label: 'Wrestling Team Score' },
  // Special layouts
  { value: 'universal', label: 'Universal' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'timeout-no-game-time', label: 'Timeout (No Game Time)' },
  { value: 'activity-timer', label: 'Activity Timer' },
  { value: 'playlist', label: 'Playlist' },
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'basketball-leaderboard', label: 'Basketball Leaderboard' },
  { value: 'pre-game', label: 'Pre-Game' },
  { value: 'halftime', label: 'Halftime' },
  { value: 'period-break', label: 'Period Break' },
] as const;

export type LayoutType = typeof LAYOUT_TYPES[number]['value'];

export interface LayoutConfig {
  name: string; // Layout type identifier (e.g., 'basketball', 'volleyball') - used by TV app to load correct layout
  components: ComponentConfig[];
  backgroundColor?: string;
  dimensions: {
    width: number;
    height: number;
  };
}