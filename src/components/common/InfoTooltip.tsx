import React from 'react';
import './InfoTooltip.css';

/**
 * Small inline "ⓘ" hover tooltip. Pure CSS — no JS positioning, no portals.
 * Use for one-liner contextual info next to a label. Pass JSX into `content`
 * for multi-line formatted detail.
 *
 *   <InfoTooltip content={<>5 components<br/>120 × 80 px</>} />
 */

interface InfoTooltipProps {
  content: React.ReactNode;
  /** Optional aria-label fallback when content isn't a string. */
  label?: string;
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, label = 'More info', className = '' }) => {
  return (
    <span
      className={`info-tooltip ${className}`.trim()}
      role="img"
      aria-label={label}
      tabIndex={0}
    >
      <svg
        className="info-tooltip__icon"
        width="14"
        height="14"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1" fill="none" />
        <circle cx="6" cy="3.4" r="0.7" fill="currentColor" />
        <rect x="5.35" y="5" width="1.3" height="4.2" rx="0.4" fill="currentColor" />
      </svg>
      <span className="info-tooltip__bubble" role="tooltip">{content}</span>
    </span>
  );
};

export default InfoTooltip;
