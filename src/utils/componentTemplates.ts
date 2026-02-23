import { ComponentGroupTemplate, ComponentConfig } from '../types';

const STORAGE_KEY = 'sv-component-templates';

// Load all component templates from localStorage
export function loadComponentTemplates(): ComponentGroupTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save templates to localStorage
export function saveComponentTemplates(templates: ComponentGroupTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// Get a single template by ID
export function getComponentTemplate(id: string): ComponentGroupTemplate | undefined {
  return loadComponentTemplates().find(t => t.id === id);
}

// Calculate bounding box of components
export function calculateBoundingBox(components: ComponentConfig[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  components.forEach(c => {
    minX = Math.min(minX, c.position.x);
    minY = Math.min(minY, c.position.y);
    maxX = Math.max(maxX, c.position.x + c.size.width);
    maxY = Math.max(maxY, c.position.y + c.size.height);
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Get all descendants of a component (children, grandchildren, etc.)
function getDescendants(componentId: string, allComponents: ComponentConfig[]): ComponentConfig[] {
  const descendants: ComponentConfig[] = [];
  const directChildren = allComponents.filter(c => c.parentId === componentId);

  for (const child of directChildren) {
    descendants.push(child);
    descendants.push(...getDescendants(child.id, allComponents));
  }

  return descendants;
}

// Create a new component template from selected components
export function createComponentTemplate(
  name: string,
  selectedIds: string[],
  allComponents: ComponentConfig[],
  description?: string
): ComponentGroupTemplate {
  const templates = loadComponentTemplates();

  // Check if template with same name already exists
  const existingIndex = templates.findIndex(t => t.name === name);

  // Get all selected components and their descendants
  const componentsToSave: ComponentConfig[] = [];
  const processedIds = new Set<string>();

  for (const id of selectedIds) {
    const component = allComponents.find(c => c.id === id);
    if (component && !processedIds.has(id)) {
      componentsToSave.push(component);
      processedIds.add(id);

      // Add all descendants
      const descendants = getDescendants(id, allComponents);
      for (const desc of descendants) {
        if (!processedIds.has(desc.id)) {
          componentsToSave.push(desc);
          processedIds.add(desc.id);
        }
      }
    }
  }

  // Calculate bounding box
  const bounds = calculateBoundingBox(componentsToSave);

  // Build a map of old IDs to new IDs
  const idMap = new Map<string, string>();
  componentsToSave.forEach(c => {
    idMap.set(c.id, crypto.randomUUID());
  });

  // Normalize component positions relative to the bounding box origin
  // and update IDs and parent references
  const normalizedComponents = componentsToSave.map(c => ({
    ...c,
    id: idMap.get(c.id)!,
    position: {
      x: c.position.x - bounds.minX,
      y: c.position.y - bounds.minY,
    },
    // Update parent reference to new ID, or remove if parent wasn't selected
    parentId: c.parentId && idMap.has(c.parentId) ? idMap.get(c.parentId) : undefined,
  }));

  const template: ComponentGroupTemplate = {
    id: existingIndex !== -1 ? templates[existingIndex].id : crypto.randomUUID(),
    name,
    description,
    components: normalizedComponents,
    boundingBox: { width: bounds.width, height: bounds.height },
    createdAt: existingIndex !== -1 ? templates[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (existingIndex !== -1) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }
  saveComponentTemplates(templates);

  return template;
}

// Delete a template
export function deleteComponentTemplate(id: string): boolean {
  const templates = loadComponentTemplates();
  const filtered = templates.filter(t => t.id !== id);
  if (filtered.length === templates.length) return false;

  saveComponentTemplates(filtered);
  return true;
}

// Instantiate a template into concrete components at a given position
export function instantiateTemplate(
  template: ComponentGroupTemplate,
  position: { x: number; y: number }
): ComponentConfig[] {
  // Build a map of template IDs to new IDs
  const idMap = new Map<string, string>();
  template.components.forEach(c => {
    idMap.set(c.id, crypto.randomUUID());
  });

  // Create new components with new IDs and offset positions
  return template.components.map(c => ({
    ...c,
    id: idMap.get(c.id)!,
    position: {
      x: c.position.x + position.x,
      y: c.position.y + position.y,
    },
    // Update parent reference to new ID
    parentId: c.parentId ? idMap.get(c.parentId) : undefined,
  }));
}
