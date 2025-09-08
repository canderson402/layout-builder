import React, { useState, useMemo } from 'react';
import { LayoutConfig } from '../types';
import './ExportModal.css';

interface ExportModalProps {
  layout: LayoutConfig;
  onClose: () => void;
}

export default function ExportModal({ layout, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const exportedCode = useMemo(() => {
    return JSON.stringify(layout, null, 2);
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