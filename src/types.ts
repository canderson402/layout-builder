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
}

export interface LayoutConfig {
  name: string;
  sport: string;
  components: ComponentConfig[];
  backgroundColor?: string;
  dimensions: {
    width: number;
    height: number;
  };
}