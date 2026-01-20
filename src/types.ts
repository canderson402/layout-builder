export interface ComponentConfig {
  type: 'teamName' | 'score' | 'clock' | 'period' | 'fouls' | 'timeouts' | 'bonus' | 'custom' | 'dynamicList' | 'group';
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
  scaleAnchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // Anchor point for scaling (default: corner being dragged)
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
  // Special layouts
  { value: 'universal', label: 'Universal' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'activity-timer', label: 'Activity Timer' },
  { value: 'playlist', label: 'Playlist' },
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