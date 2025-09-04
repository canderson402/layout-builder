export interface ComponentConfig {
  type: 'teamName' | 'score' | 'clock' | 'period' | 'fouls' | 'timeouts' | 'bonus' | 'custom';
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
  id: string;
  name?: string; // Custom name for the component
  visible?: boolean; // Whether the component is visible (default: true)
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