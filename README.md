# 🏗️ Scoreboard Layout Builder

A web-based visual layout builder for creating custom scoreboard layouts for your React Native sports display app.

## 🚀 Quick Start

### Installation
```bash
cd layout-builder-web
npm install
npm run dev
```

The app will open at `http://localhost:3000`

### Development
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 🎨 Features

### Visual Layout Designer
- **Drag & Drop**: Click and drag components around the canvas
- **Real-time Preview**: See your layout update live as you design
- **Component Library**: Add team names, scores, clocks, periods, fouls, timeouts, and more
- **Property Editor**: Fine-tune position, size, styling, and behavior
- **Multi-sport Support**: Create layouts for basketball, volleyball, soccer, etc.

### Export Options
- **React Native Code**: Generate TypeScript code ready for your RN app
- **JSON Format**: Export as JSON for custom implementations
- **Copy & Download**: Copy to clipboard or download as file

### Professional Tools
- **Grid Snapping**: Precise component positioning
- **Keyboard Shortcuts**: Delete (Del/Backspace), Duplicate (Cmd/Ctrl+D)
- **Component Controls**: Duplicate, delete, center, and move to origin
- **Team Assignment**: Assign components to home/away teams

## 🎯 How to Use

### 1. Design Your Layout
1. Open the layout builder in your web browser
2. Select components from the toolbar (Team Name, Score, Clock, etc.)
3. Drag components to position them on the canvas
4. Use the property panel to adjust sizes, colors, and settings
5. Assign components to home/away teams as needed

### 2. Export Your Layout
1. Click "Export Layout" in the top-right corner
2. Choose "React Native Layout" format
3. Copy the generated code
4. Paste it into your React Native app's `scoreboardLayouts.ts` file

### 3. Use in Your App
```tsx
import { yourNewLayout } from './layouts/scoreboardLayouts';

<DynamicScoreboard 
  layout={yourNewLayout} 
  gameData={gameData} 
/>
```

## 📋 Component Types

| Component | Description | Teams |
|-----------|-------------|--------|
| **Team Name** | Display team name with colors | Home/Away |
| **Score** | Large score display | Home/Away |
| **Clock** | Game clock/timer | Neutral |
| **Period** | Period/quarter with possession arrows | Neutral |
| **Fouls** | Foul count display | Home/Away |
| **Timeouts** | Visual timeout indicators | Home/Away |
| **Bonus** | Bonus situation indicators | Home/Away |
| **Custom** | Generic custom component | Configurable |

## ⚡ Tips & Tricks

### Keyboard Shortcuts
- **Delete**: Remove selected component
- **Cmd/Ctrl + D**: Duplicate selected component
- **Click Canvas**: Deselect all components

### Best Practices
- Start with team names and scores as your foundation
- Use consistent spacing and alignment
- Test different screen sizes/orientations
- Keep component sizes proportional to screen size
- Use the center and move-to-origin buttons for precise alignment

### Sport-Specific Layouts
- **Basketball**: Include possession arrows, bonus indicators, fouls
- **Volleyball**: Focus on sets instead of periods, fewer timeouts
- **Soccer**: Emphasize clock, minimal foul tracking
- **Custom Sports**: Mix and match components as needed

## 🔧 Technical Notes

### Viewport Units
The builder automatically converts pixel coordinates to viewport width (vw) units for responsive React Native layouts.

### Component Props
Each component type has specific properties:
- **Font sizes**: Automatically scaled
- **Labels**: Customizable text (PERIOD, QUARTER, SET, etc.)
- **Max timeouts**: Configurable per sport
- **Possession arrows**: Can be enabled/disabled

### Export Formats
- **React Native**: Ready-to-use TypeScript with proper imports
- **JSON**: Raw data format for custom parsers

## 🐛 Troubleshooting

**Components not dragging smoothly?**
- Make sure you're clicking on the component, not the canvas
- Try refreshing the page if performance degrades

**Export not working?**
- Check that your layout has a valid name and sport
- Ensure all components have valid positions and sizes

**Layout looks different in React Native?**
- Viewport units may scale differently on device
- Test on your target device and adjust as needed

## 🎨 Customization

The layout builder is fully customizable. You can:
- Add new component types
- Modify export formats
- Add custom styling options
- Integrate with your own design system

Happy designing! 🏆