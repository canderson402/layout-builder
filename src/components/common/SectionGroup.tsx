import React from 'react';
import './SectionGroup.css';

/**
 * Non-interactive visual grouping for CollapsibleSections. Renders a small
 * uppercase title above a cluster of sections. Pair with CollapsibleSection
 * to organize a tall panel into scannable bands.
 *
 *   <SectionGroup title="General">
 *     <CollapsibleSection ...>...</CollapsibleSection>
 *     <CollapsibleSection ...>...</CollapsibleSection>
 *   </SectionGroup>
 */

interface SectionGroupProps {
  title: string;
  children: React.ReactNode;
}

const SectionGroup: React.FC<SectionGroupProps> = ({ title, children }) => (
  <div className="section-group">
    <div className="section-group__title" role="heading" aria-level={3}>{title}</div>
    <div className="section-group__body">{children}</div>
  </div>
);

export default SectionGroup;
