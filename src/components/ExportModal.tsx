import React, { useState, useMemo, useEffect } from 'react';
import { LayoutConfig, ComponentConfig } from '../types';
import { expandLayoutForRuntime } from '../utils/slotTemplates';
import { measureTextBearings, getSampleTextForBearing } from '../utils/textBearings';
import './ExportModal.css';

// Clean up component props to remove unnecessary/default values
function cleanComponentProps(component: ComponentConfig): ComponentConfig {
  // Round position and size values to prevent sub-pixel rendering differences
  const roundedComponent = {
    ...component,
    position: {
      x: Math.round(component.position.x),
      y: Math.round(component.position.y),
    },
    size: {
      width: Math.round(component.size.width),
      height: Math.round(component.size.height),
    },
  };

  if (!roundedComponent.props) return roundedComponent;

  const props = { ...roundedComponent.props };

  // Set imageSource based on what's available:
  // - If imageUrl is set -> 'url'
  // - If imagePath is set -> 'local'
  // - Otherwise -> 'none'
  if (props.imageUrl) {
    props.imageSource = 'url';
  } else if (props.imagePath) {
    props.imageSource = 'local';
  } else if (!props.imageSource) {
    props.imageSource = 'none';
  }

  const hasImage = props.imageSource && props.imageSource !== 'none' && (props.imagePath || props.imageUrl);
  const hasTextDataPath = props.dataPath && props.dataPath !== 'none' && props.dataPath !== '';
  const isImageOnly = hasImage && !hasTextDataPath;

  // Measure and add text bearings for non-center aligned text components
  // This allows the TV app to position text identically without its own measurement API
  const textAlign = props.textAlign || 'center';
  const hasTextContent = props.dataPath || props.customText;

  if (!isImageOnly && hasTextContent && (textAlign === 'left' || textAlign === 'right')) {
    const fontSize = props.fontSize || 24;
    const fontFamily = props.fontFamily || 'Score-Regular';
    const sampleText = getSampleTextForBearing(props);

    const bearings = measureTextBearings(sampleText, fontFamily, fontSize);

    // Add measured bearings to props (TV app will use these directly)
    props.measuredLeftBearing = bearings.leftBearing;
    props.measuredRightBearing = bearings.rightBearing;
  }

  // Remove empty strings
  const emptyStringProps = ['label', 'prefix', 'suffix', 'imagePath', 'imageUrl'];
  emptyStringProps.forEach(key => {
    if (props[key] === '') delete props[key];
  });

  // Remove zero padding if all are zero
  const paddingProps = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  const allPaddingZero = paddingProps.every(key => !props[key] || props[key] === 0);
  if (allPaddingZero) {
    paddingProps.forEach(key => delete props[key]);
  }

  // Remove zero border radius if all are zero
  const radiusProps = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];
  const allRadiusZero = radiusProps.every(key => !props[key] || props[key] === 0);
  if (allRadiusZero) {
    radiusProps.forEach(key => delete props[key]);
  }

  // Remove border-related props when borderWidth is 0
  if (!props.borderWidth || props.borderWidth === 0) {
    delete props.borderWidth;
    delete props.borderColor;
    delete props.borderStyle;
    delete props.borderTopWidth;
    delete props.borderRightWidth;
    delete props.borderBottomWidth;
    delete props.borderLeftWidth;
  }

  // Remove text-related props for image-only components
  if (isImageOnly) {
    const textProps = ['fontSize', 'textColor', 'textAlign', 'format', 'label', 'prefix', 'suffix', 'fontFamily', 'autoFitText'];
    textProps.forEach(key => delete props[key]);
  }

  // Remove default values that don't need to be specified
  if (props.format === 'text') delete props.format;
  if (props.textAlign === 'center') delete props.textAlign;
  if (props.objectFit === 'cover') delete props.objectFit;
  if (props.imageAnchor === 'center') delete props.imageAnchor;
  if (props.borderStyle === 'solid') delete props.borderStyle;
  if (props.useImageTint === false) delete props.useImageTint;
  if (props.useTeamColor === false) delete props.useTeamColor;
  if (props.canToggle === false) delete props.canToggle;
  if (props.autoToggle === true) delete props.autoToggle;
  if (props.toggleState === false) delete props.toggleState;
  if (props.autoFitText === false) delete props.autoFitText;

  // Remove transparent/none background (it's effectively the default)
  // Also check for rgba with 0 alpha (e.g., "rgba(155, 89, 181, 0)")
  const isTransparentBg = (color: string | undefined) => {
    if (!color) return true;
    if (color === 'transparent' || color === 'none') return true;
    // Check for rgba with 0 alpha
    const rgbaMatch = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/i);
    if (rgbaMatch) return true;
    return false;
  };
  if (isTransparentBg(props.backgroundColor)) delete props.backgroundColor;

  // Clean up empty state props
  if (props.state1Props && Object.keys(props.state1Props).length === 0) delete props.state1Props;
  if (props.state2Props && Object.keys(props.state2Props).length === 0) delete props.state2Props;

  // If canToggle was removed, also remove toggle-related props
  if (!props.canToggle) {
    delete props.toggleState;
    delete props.autoToggle;
    delete props.toggleCondition;
    if (!props.state1Props || Object.keys(props.state1Props).length === 0) delete props.state1Props;
    if (!props.state2Props || Object.keys(props.state2Props).length === 0) delete props.state2Props;
  }

  // Clean up conditional logic props
  const isEmptyConditionGroup = (group: any) =>
    !group || !Array.isArray(group.conditions) || group.conditions.length === 0;
  if (isEmptyConditionGroup(props.visibilityCondition)) delete props.visibilityCondition;
  if (isEmptyConditionGroup(props.toggleCondition)) delete props.toggleCondition;
  if (!Array.isArray(props.states) || props.states.length === 0) delete props.states;
  if (!Array.isArray(props.visibleInStates) || props.visibleInStates.length === 0) delete props.visibleInStates;
  // previewStateId is editor-only — the runtime always resolves states live
  delete props.previewStateId;

  return { ...roundedComponent, props };
}

// Normalize layer values so siblings have unique values reflecting their visual order
// This ensures the TV app renders components in the same z-order as the Layout Builder
function normalizeLayerValues(components: ComponentConfig[]): ComponentConfig[] {
  // Group components by parentId
  const byParent = new Map<string | undefined, ComponentConfig[]>();

  components.forEach(comp => {
    const parentId = comp.parentId;
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId)!.push(comp);
  });

  // For each group of siblings, normalize their layer values
  const layerUpdates = new Map<string, number>();

  byParent.forEach((siblings) => {
    if (siblings.length <= 1) return; // No normalization needed for single components

    // Sort siblings by layer (descending) - higher layer = renders on top = first in list
    // For equal layers, maintain original array order (which is the order they appear in components array)
    const sortedSiblings = [...siblings].sort((a, b) => {
      const layerDiff = (b.layer ?? 0) - (a.layer ?? 0);
      if (layerDiff !== 0) return layerDiff;
      // For equal layers, use original array position
      return components.indexOf(a) - components.indexOf(b);
    });

    // Assign unique layer values: first gets highest (length-1), last gets 0
    sortedSiblings.forEach((comp, index) => {
      const newLayer = sortedSiblings.length - 1 - index;
      layerUpdates.set(comp.id, newLayer);
    });
  });

  // Apply layer updates to components
  return components.map(comp => {
    const newLayer = layerUpdates.get(comp.id);
    if (newLayer !== undefined && newLayer !== comp.layer) {
      return { ...comp, layer: newLayer };
    }
    return comp;
  });
}

// Clean the layout for export. Single unified mode: slotList containers are
// preserved (so the TV runtime can dynamically size the row count from
// gameData), and ONE copy of each template is inlined as a slot:0 component
// with short paths. The TV-side slot expansion auto-prefixes paths and clones
// per row. Same export works for re-importing into the builder because
// templates are inlined rather than referenced by id.
function cleanLayoutForExport(layout: LayoutConfig): LayoutConfig {
  const inlinedComponents = expandLayoutForRuntime(layout.components);
  const normalizedComponents = normalizeLayerValues(inlinedComponents);
  return {
    ...layout,
    components: normalizedComponents.map(cleanComponentProps)
  };
}

interface ExportModalProps {
  layout: LayoutConfig;
  onClose: () => void;
}

export default function ExportModal({ layout, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const exportedCode = useMemo(() => {
    return JSON.stringify(cleanLayoutForExport(layout), null, 2);
  }, [layout]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadFile = () => {
    const filename = `${layout.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    const blob = new Blob([exportedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Layout</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="code-container">
            <div className="code-header">
              <span className="code-title">Layout JSON (slotLists preserved, templates inlined)</span>
              <div className="code-actions">
                <button
                  onClick={copyToClipboard}
                  className={`copy-button ${copied ? 'copied' : ''}`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={downloadFile} className="download-button">
                  Download
                </button>
              </div>
            </div>
            <pre className="code-block">
              <code>{exportedCode}</code>
            </pre>
          </div>

          <div className="export-instructions">
            <h3>Layout export</h3>
            <ol>
              <li>SlotList containers and their slot:0 templates are preserved together — runtime sizes the row count dynamically and auto-prefixes paths per row.</li>
              <li>Static (non-slotList) components export as-is.</li>
              <li>Same JSON can be re-imported into the Layout Builder for further editing.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}