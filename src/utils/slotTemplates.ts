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

// Get a single template by ID
export function getTemplate(id: string): SlotTemplate | undefined {
  return loadTemplates().find(t => t.id === id);
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
  const slotSpacing = props.slotSpacing || 5;
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
      const template = getTemplate(comp.props?.templateId);
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
