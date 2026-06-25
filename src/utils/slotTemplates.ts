import { SlotTemplate, ComponentConfig } from '../types';

const STORAGE_KEY = 'sv-slot-templates';

// Load all templates from localStorage (filters out old preset templates)
export function loadTemplates(): SlotTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const templates: SlotTemplate[] = JSON.parse(stored);
    // Filter out any old preset templates
    const filtered = templates.filter(t => !t.isPreset && !t.name.startsWith('[Preset]'));

    // If we filtered any out, save the cleaned list
    if (filtered.length !== templates.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch {
    return [];
  }
}

// Save templates to localStorage
export function saveTemplates(templates: SlotTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// Get a single template by ID, or by name as fallback
export function getTemplate(id: string, fallbackName?: string): SlotTemplate | undefined {
  const templates = loadTemplates();
  // First try exact ID match
  const byId = templates.find(t => t.id === id);
  if (byId) return byId;

  // Fallback: try matching by name if provided
  if (fallbackName) {
    return templates.find(t => t.name === fallbackName);
  }

  return undefined;
}

// Calculate bounding box of components
export function calculateBoundingBox(components: ComponentConfig[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  components.forEach(c => {
    minX = Math.min(minX, c.position.x);
    minY = Math.min(minY, c.position.y);
    maxX = Math.max(maxX, c.position.x + c.size.width);
    maxY = Math.max(maxY, c.position.y + c.size.height);
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Save a new template (from selected components) - replaces existing template with same name
// If customSlotSize is provided, it will be used instead of the calculated bounding box
export function createTemplate(
  name: string,
  components: ComponentConfig[],
  description?: string,
  customSlotSize?: { width: number; height: number }
): SlotTemplate {
  const templates = loadTemplates();

  // Check if template with same name already exists
  const existingIndex = templates.findIndex(t => t.name === name);

  // Calculate bounding box of components
  const bounds = calculateBoundingBox(components);

  // Normalize component positions relative to the bounding box origin
  const normalizedComponents = components.map(c => ({
    ...c,
    id: crypto.randomUUID(), // New IDs for template
    position: {
      x: c.position.x - bounds.minX,
      y: c.position.y - bounds.minY,
    },
    // Clear any parent references
    parentId: undefined,
  }));

  // Use custom size if provided, otherwise use bounding box
  const slotSize = customSlotSize || { width: bounds.width, height: bounds.height };

  const template: SlotTemplate = {
    // Keep existing ID if replacing, otherwise generate new one
    id: existingIndex !== -1 ? templates[existingIndex].id : crypto.randomUUID(),
    name,
    description,
    components: normalizedComponents,
    slotSize,
    // Set original size for percentage-based scaling
    originalSlotSize: { ...slotSize },
    createdAt: existingIndex !== -1 ? templates[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (existingIndex !== -1) {
    // Replace existing template
    templates[existingIndex] = template;
  } else {
    // Add new template
    templates.push(template);
  }
  saveTemplates(templates);

  return template;
}

// Update an existing template
export function updateTemplate(id: string, updates: Partial<SlotTemplate>): SlotTemplate | undefined {
  const templates = loadTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index === -1) return undefined;

  templates[index] = {
    ...templates[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveTemplates(templates);

  return templates[index];
}

// Delete a template
export function deleteTemplate(id: string): boolean {
  const templates = loadTemplates();
  const filtered = templates.filter(t => t.id !== id);
  if (filtered.length === templates.length) return false;

  saveTemplates(filtered);
  return true;
}

// Expand a slotList component into concrete components with full data paths
export function expandSlotList(
  slotListComponent: ComponentConfig,
  template: SlotTemplate
): ComponentConfig[] {
  const props = slotListComponent.props || {};
  const team = props.team || 'home';
  const slotCount = props.slotCount || 5;
  const slotSpacing = props.slotSpacing ?? 5;
  const direction = props.direction || 'vertical';
  const dataPathPrefix = props.dataPathPrefix || 'leaderboardSlots';
  const hideInactiveSlots = props.hideInactiveSlots || false;

  // Get the slotList bounding box size
  const boundingWidth = slotListComponent.size.width;
  const boundingHeight = slotListComponent.size.height;

  // Calculate natural size of all slots combined (same as WebPreview)
  const naturalWidth = direction === 'horizontal'
    ? slotCount * template.slotSize.width + (slotCount - 1) * slotSpacing
    : template.slotSize.width;
  const naturalHeight = direction === 'vertical'
    ? slotCount * template.slotSize.height + (slotCount - 1) * slotSpacing
    : template.slotSize.height;

  // Calculate scale to fit within the SlotList bounding box
  const scaleX = boundingWidth / naturalWidth;
  const scaleY = boundingHeight / naturalHeight;

  const expandedComponents: ComponentConfig[] = [];

  for (let i = 0; i < slotCount; i++) {
    // Calculate offset for this slot (in natural/unscaled coordinates)
    const offsetX = direction === 'horizontal' ? i * (template.slotSize.width + slotSpacing) : 0;
    const offsetY = direction === 'vertical' ? i * (template.slotSize.height + slotSpacing) : 0;

    // Clone each template component with prefixed data paths and scaled positions/sizes
    template.components.forEach(templateComp => {
      const clonedComp: ComponentConfig = {
        ...templateComp,
        id: crypto.randomUUID(),
        slot: i, // Tag with slot index for TV app cycling animation
        position: {
          x: slotListComponent.position.x + (templateComp.position.x + offsetX) * scaleX,
          y: slotListComponent.position.y + (templateComp.position.y + offsetY) * scaleY,
        },
        size: {
          width: templateComp.size.width * scaleX,
          height: templateComp.size.height * scaleY,
        },
        props: templateComp.props ? { ...templateComp.props } : {},
      };

      // Prefix data paths
      if (clonedComp.props?.dataPath && clonedComp.props.dataPath !== 'none') {
        clonedComp.props.dataPath = `${dataPathPrefix}.${team}.slot${i}.${clonedComp.props.dataPath}`;
      }

      // Prefix visibility paths (if template component has one)
      if (clonedComp.props?.visibilityPath) {
        clonedComp.props.visibilityPath = `${dataPathPrefix}.${team}.slot${i}.${clonedComp.props.visibilityPath}`;
      }
      // If hideInactiveSlots is enabled and component doesn't already have a visibilityPath,
      // add one that binds to the slot's active field
      else if (hideInactiveSlots) {
        clonedComp.props = clonedComp.props || {};
        clonedComp.props.visibilityPath = `${dataPathPrefix}.${team}.slot${i}.active`;
      }

      // Prefix toggle data paths (if template component has one)
      if (clonedComp.props?.toggleDataPath) {
        clonedComp.props.toggleDataPath = `${dataPathPrefix}.${team}.slot${i}.${clonedComp.props.toggleDataPath}`;
      }

      // Prefix paths inside condition groups (visibilityCondition / toggleCondition).
      // Slot templates gate on per-slot fields (active/exists/won) authored as
      // short, prefix-less paths on slot 0; without this they evaluate against
      // the root game data and never match.
      const prefixSlotPath = (p?: string): string | undefined => {
        if (!p || p === 'none') return p;
        // Only auto-prefix short, prefix-less names (e.g. 'active').
        if (!p.includes('.')) return `${dataPathPrefix}.${team}.slot${i}.${p}`;
        return p;
      };
      const prefixConditionGroup = (group: any): any => {
        if (!group || !Array.isArray(group.conditions)) return group;
        return {
          ...group,
          conditions: group.conditions.map((cond: any) => ({
            ...cond,
            leftPath: prefixSlotPath(cond.leftPath),
            rightPath: cond.rightType === 'path' ? prefixSlotPath(cond.rightPath) : cond.rightPath,
          })),
        };
      };
      if (clonedComp.props?.visibilityCondition) {
        clonedComp.props.visibilityCondition = prefixConditionGroup(clonedComp.props.visibilityCondition);
      }
      if (clonedComp.props?.toggleCondition) {
        clonedComp.props.toggleCondition = prefixConditionGroup(clonedComp.props.toggleCondition);
      }

      expandedComponents.push(clonedComp);
    });
  }

  return expandedComponents;
}

// Expand all slotList components in a layout for export
export function expandLayoutForExport(components: ComponentConfig[]): ComponentConfig[] {
  const expandedComponents: ComponentConfig[] = [];

  components.forEach(comp => {
    if (comp.type === 'slotList') {
      // Try to get template by ID first, then fallback to name for imported layouts
      const template = getTemplate(comp.props?.templateId, comp.props?.templateName);
      if (template) {
        expandedComponents.push(...expandSlotList(comp, template));
      }
      // If no template found, skip this component
    } else {
      expandedComponents.push(comp);
    }
  });

  return expandedComponents;
}

// Inline ONE copy (slot 0) of a slotList's template into the layout, preserving
// the slotList container itself. Short paths (e.g. `score`, `won`) stay short —
// the TV's runtime slot expansion auto-prefixes them per row. This is what the
// "Export for TV" mode now uses so RNDisplay can dynamically size the slot list
// against gameData.setSlots.home.count instead of getting a flattened layout.
export function expandLayoutForRuntime(components: ComponentConfig[]): ComponentConfig[] {
  const result: ComponentConfig[] = [];

  components.forEach(comp => {
    if (comp.type !== 'slotList') {
      result.push(comp);
      return;
    }

    // Always emit the slotList container itself — runtime expansion reads its
    // size, team, dataPathPrefix, slotCountPath, etc.
    result.push(comp);

    const template = getTemplate(comp.props?.templateId, comp.props?.templateName);
    if (!template) return;

    const props = comp.props || {};
    const slotCount = props.slotCount || 5;
    const slotSpacing = props.slotSpacing ?? 5;
    const direction = props.direction || 'vertical';

    const boundingWidth = comp.size.width;
    const boundingHeight = comp.size.height;

    const naturalWidth = direction === 'horizontal'
      ? slotCount * template.slotSize.width + (slotCount - 1) * slotSpacing
      : template.slotSize.width;
    const naturalHeight = direction === 'vertical'
      ? slotCount * template.slotSize.height + (slotCount - 1) * slotSpacing
      : template.slotSize.height;

    const scaleX = boundingWidth / naturalWidth;
    const scaleY = boundingHeight / naturalHeight;

    // Slot 0 only — runtime expansion clones this for slot1..slotN.
    template.components.forEach(templateComp => {
      const cloned: ComponentConfig = {
        ...templateComp,
        id: crypto.randomUUID(),
        slot: 0,
        // parentId is preserved from the original template component so
        // the existing layer hierarchy doesn't shift. Template-to-slotList
        // association is carried in props.slotListId instead, which the
        // runtime expansion reads without affecting layer ordering.
        position: {
          x: comp.position.x + templateComp.position.x * scaleX,
          y: comp.position.y + templateComp.position.y * scaleY,
        },
        size: {
          width: templateComp.size.width * scaleX,
          height: templateComp.size.height * scaleY,
        },
        props: {
          ...(templateComp.props || {}),
          // Bind this template to the slotList container by id. Used by the
          // runtime to disambiguate when multiple slotLists exist (e.g.
          // stacked home/away strips in a tennis layout).
          slotListId: comp.id,
        },
      };
      result.push(cloned);
    });
  });

  return result;
}

// Repair template references in a layout by matching by name when ID not found
// This helps when templates were imported separately with different UUIDs
export function repairTemplateReferences(components: ComponentConfig[]): {
  components: ComponentConfig[],
  repaired: number,
  brokenRefs: string[] // Component IDs with unfixable broken references
} {
  const templates = loadTemplates();
  let repaired = 0;
  const brokenRefs: string[] = [];

  const repairedComponents = components.map(comp => {
    if (comp.type === 'slotList' && comp.props?.templateId) {
      // Check if template exists by ID
      const existsById = templates.find(t => t.id === comp.props.templateId);
      if (!existsById) {
        // Try to find by name if templateName is stored
        if (comp.props.templateName) {
          const byName = templates.find(t => t.name === comp.props.templateName);
          if (byName) {
            repaired++;
            return {
              ...comp,
              props: {
                ...comp.props,
                templateId: byName.id,
              }
            };
          }
        }
        // If no templateName, try to find any template that might match by partial name match
        // This is a last resort for layouts that didn't store templateName
        const partialMatch = templates.find(t =>
          t.name.toLowerCase().includes('slot') ||
          t.name.toLowerCase().includes('leader') ||
          t.name.toLowerCase().includes('stat')
        );
        if (partialMatch && templates.length === 1) {
          // Only auto-match if there's exactly one template (to avoid wrong matches)
          repaired++;
          return {
            ...comp,
            props: {
              ...comp.props,
              templateId: partialMatch.id,
              templateName: partialMatch.name,
            }
          };
        }
        // If we get here, the reference is broken and couldn't be repaired
        brokenRefs.push(comp.id);
      } else {
        // Template exists by ID - make sure templateName is stored for future compatibility
        if (!comp.props.templateName) {
          return {
            ...comp,
            props: {
              ...comp.props,
              templateName: existsById.name,
            }
          };
        }
      }
    }
    return comp;
  });

  return { components: repairedComponents, repaired, brokenRefs };
}
