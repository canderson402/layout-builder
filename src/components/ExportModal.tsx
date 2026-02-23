import React, { useState, useMemo, useEffect } from 'react';
import { LayoutConfig, ComponentConfig } from '../types';
import { expandLayoutForExport } from '../utils/slotTemplates';
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
  const hasImage = props.imageSource && props.imageSource !== 'none' && props.imagePath;
  const hasTextDataPath = props.dataPath && props.dataPath !== 'none' && props.dataPath !== '';
  const isImageOnly = hasImage && !hasTextDataPath;

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
    if (!props.state1Props || Object.keys(props.state1Props).length === 0) delete props.state1Props;
    if (!props.state2Props || Object.keys(props.state2Props).length === 0) delete props.state2Props;
  }

  return { ...roundedComponent, props };
}

// Clean the entire layout for export
function cleanLayoutForExport(layout: LayoutConfig): LayoutConfig {
  // First expand any slotList components into concrete components
  const expandedComponents = expandLayoutForExport(layout.components);

  return {
    ...layout,
    components: expandedComponents.map(cleanComponentProps)
  };
}

interface ExportModalProps {
  layout: LayoutConfig;
  onClose: () => void;
}

export default function ExportModal({ layout, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const exportedCode = useMemo(() => {
    const cleanedLayout = cleanLayoutForExport(layout);
    return JSON.stringify(cleanedLayout, null, 2);
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
              <span className="code-title">JSON Layout Data</span>
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
            <h3>How to use this JSON:</h3>
            <ol>
              <li>Copy the JSON layout data above</li>
              <li>Use it in the "Load JSON" tab of the preset manager to reload this layout</li>
              <li>Send it to your TV using the "Send to TV" button</li>
              <li>Save as a JSON file for backup or sharing</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}