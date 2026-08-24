import React, { useState, useMemo } from 'react';
import { OverlayConfig } from '../shared/utils/overlayTimeline';
import { cleanOverlayForExport } from '../utils/overlayExport';
import './ExportModal.css';

interface OverlayExportModalProps {
  overlay: OverlayConfig;
  onClose: () => void;
}

export default function OverlayExportModal({ overlay, onClose }: OverlayExportModalProps) {
  const [copied, setCopied] = useState(false);

  const exportedCode = useMemo(() => {
    return JSON.stringify(cleanOverlayForExport(overlay), null, 2);
  }, [overlay]);

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
    const filename = `${overlay.name.toLowerCase().replace(/\s+/g, '-')}.json`;
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
          <h2>Export Overlay</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="code-container">
            <div className="code-header">
              <span className="code-title">Overlay JSON (components baked, tracks validated)</span>
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
            <h3>Overlay export</h3>
            <ol>
              <li>Shape components are baked to pixel-space paths, transforms sanitized, and props cleaned identically to a layout export.</li>
              <li>Animation tracks are validated: keyframes sorted with unique frames, non-finite keyframes dropped, and tracks for missing components or left empty are removed.</li>
              <li>Drop the downloaded file into the TV app's <code>src/overlays/</code> directory.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
