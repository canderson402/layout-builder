import React, { useState, useMemo } from 'react';
import { LayoutConfig } from '../types';
import './ExportModal.css';

interface ExportModalProps {
  layout: LayoutConfig;
  onClose: () => void;
}

export default function ExportModal({ layout, onClose }: ExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'react-native' | 'json'>('react-native');
  const [copied, setCopied] = useState(false);

  const exportedCode = useMemo(() => {
    if (exportFormat === 'json') {
      return JSON.stringify(layout, null, 2);
    }

    // Generate React Native layout with pixel values
    return `export const ${layout.sport}Layout = {
  name: '${layout.name}',
  sport: '${layout.sport}',
  backgroundColor: '${layout.backgroundColor}',
  dimensions: { width: ${layout.dimensions.width}, height: ${layout.dimensions.height} },
  components: [
${layout.components.map((comp, index) => {
  const propsStr = JSON.stringify(comp.props, null, 2).replace(/^/gm, '      ').trim();
  return `    // ${comp.type}${comp.team ? ` (${comp.team})` : ''} - Layer ${comp.layer || 0}
    {
      type: '${comp.type}',${comp.team ? `\n      team: '${comp.team}',` : ''}
      position: { x: ${comp.position.x}, y: ${comp.position.y} }, // ${comp.position.x}px x, ${comp.position.y}px y
      size: { width: ${comp.size.width}, height: ${comp.size.height} }, // ${comp.size.width}px width, ${comp.size.height}px height${comp.layer !== undefined ? `,\n      layer: ${comp.layer},` : ','}
      props: ${propsStr},
      id: '${comp.id || comp.type + '_' + (comp.team || 'main')}'
    }${index < layout.components.length - 1 ? ',' : ''}`;
}).join('\n')}
  ]
};`;
  }, [layout, exportFormat]);

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
    const filename = exportFormat === 'json' 
      ? `${layout.name.toLowerCase().replace(/\s+/g, '-')}.json`
      : `${layout.sport}Layout.ts`;
    
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
          <div className="export-options">
            <label>
              <input
                type="radio"
                value="react-native"
                checked={exportFormat === 'react-native'}
                onChange={(e) => setExportFormat(e.target.value as 'react-native')}
              />
              React Native Layout
            </label>
            <label>
              <input
                type="radio"
                value="json"
                checked={exportFormat === 'json'}
                onChange={(e) => setExportFormat(e.target.value as 'json')}
              />
              JSON Format
            </label>
          </div>

          <div className="code-container">
            <div className="code-header">
              <span className="code-title">
                {exportFormat === 'react-native' ? 'TypeScript Code' : 'JSON Data'}
              </span>
              <div className="code-actions">
                <button 
                  onClick={copyToClipboard}
                  className={`copy-button ${copied ? 'copied' : ''}`}
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
                <button onClick={downloadFile} className="download-button">
                  💾 Download
                </button>
              </div>
            </div>
            <pre className="code-block">
              <code>{exportedCode}</code>
            </pre>
          </div>

          <div className="export-instructions">
            <h3>Instructions:</h3>
            <ol>
              <li>Copy the generated code above</li>
              <li>
                {exportFormat === 'react-native' 
                  ? 'Add it to your React Native app\'s scoreboardLayouts.ts file'
                  : 'Save as a JSON file and import into your app'
                }
              </li>
              <li>Use the layout with the DynamicScoreboard component</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}