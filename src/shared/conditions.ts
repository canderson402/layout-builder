/**
 * Conditional logic shared between the layout-builder preview and the TV
 * app runtime. This file exists in two identical copies that MUST stay in
 * sync (it's dependency-free on purpose):
 *
 *   - layout-builder-web/src/shared/conditions.ts  (builder + preview)
 *   - src/utils/conditions.ts                      (TV runtime)
 *
 * Three layout features are driven by this module:
 *
 *   1. `visibilityCondition` (any component / group)
 *      ConditionGroup — when present it overrides `visibilityPath`.
 *
 *   2. `toggleCondition` (toggle-enabled custom components)
 *      ConditionGroup — when present it overrides `toggleDataPath` and
 *      drives the state1/state2 flip.
 *
 *   3. `states` (multiState components)
 *      MultiStateDef[] — each state owns one child group (childId); the
 *      first state whose condition matches wins and only that container's
 *      components render.
 *
 * All values referenced by conditions are game-data paths (dot notation),
 * the same paths used by `dataPath` / `visibilityPath`. Either side of a
 * comparison can be a path, so `homeTeam.score > awayTeam.score` and
 * `setSlots.totalSets == 3` are both expressible.
 */

export type ConditionOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '==', label: '= equals' },
  { value: '!=', label: '≠ not equal' },
  { value: '>', label: '> greater than' },
  { value: '>=', label: '≥ greater or equal' },
  { value: '<', label: '< less than' },
  { value: '<=', label: '≤ less or equal' },
];

export interface Condition {
  /** Left side — always a game-data path (e.g. 'homeTeam.score'). */
  leftPath: string;
  op: ConditionOperator;
  /**
   * Right side kind: a literal value, another game-data path, or a
   * true/false boolean ('bool' stores 'true'/'false' in rightValue).
   */
  rightType: 'value' | 'path' | 'bool';
  /** Literal right side, stored as string and coerced at evaluation time. */
  rightValue?: string;
  /** Path right side (e.g. 'awayTeam.score'). */
  rightPath?: string;
}

export interface ConditionGroup {
  /** How multiple conditions combine. Defaults to 'and'. */
  logic: 'and' | 'or';
  conditions: Condition[];
}

/**
 * One state of a multi-state group. Each state owns one child group of the
 * multi-state parent (childId) — the parent shows exactly that child's
 * subtree while the state is active, so per-state layout (position, size,
 * everything) is just whatever lives inside that container.
 */
export interface MultiStateDef {
  /** Stable id. */
  id: string;
  /** Designer-facing name (e.g. 'Best of 3'). */
  name: string;
  /** The child group component that holds this state's content. */
  childId?: string;
  /**
   * Condition for this state to be active. States are checked in order and
   * the first match wins. A state without a condition acts as the fallback.
   */
  condition?: ConditionGroup;
}

// Same nested-path walk used by CustomDataDisplay / WebPreview.
export const getNestedValue = (obj: any, path: string): any => {
  if (!path) return null;
  return path.split('.').reduce((current: any, key: string) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
};

/**
 * Coerce a raw side of a comparison into a comparable primitive.
 * Numeric-looking strings become numbers; 'true'/'false' become booleans.
 */
const coerce = (raw: any): string | number | boolean | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    const lower = trimmed.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
    return trimmed;
  }
  return null;
};

/** Resolve a condition's right side (literal or path) against game data. */
const resolveRight = (cond: Condition, gameData: any): any => {
  if (cond.rightType === 'path') {
    return getNestedValue(gameData, cond.rightPath || '');
  }
  return cond.rightValue;
};

/** Evaluate one comparison. Missing data or type mismatches evaluate false. */
export const evaluateCondition = (cond: Condition, gameData: any): boolean => {
  if (!cond || !cond.leftPath) return false;

  const left = coerce(getNestedValue(gameData, cond.leftPath));
  const right = coerce(resolveRight(cond, gameData));

  switch (cond.op) {
    case '==':
      // Booleans compare against numbers loosely (true == 1) so paths like
      // gameSettings.display_clock ('1') match boolean expectations.
      if (typeof left === 'boolean' || typeof right === 'boolean') {
        return Boolean(left) === Boolean(right);
      }
      return left === right;
    case '!=':
      if (typeof left === 'boolean' || typeof right === 'boolean') {
        return Boolean(left) !== Boolean(right);
      }
      return left !== right;
    case '>':
    case '>=':
    case '<':
    case '<=': {
      // Ordering only makes sense numerically.
      if (typeof left !== 'number' || typeof right !== 'number') return false;
      if (cond.op === '>') return left > right;
      if (cond.op === '>=') return left >= right;
      if (cond.op === '<') return left < right;
      return left <= right;
    }
    default:
      return false;
  }
};

/** True when the group exists and has at least one condition. */
export const hasConditions = (group: ConditionGroup | undefined | null): group is ConditionGroup => {
  return !!group && Array.isArray(group.conditions) && group.conditions.length > 0;
};

/**
 * Evaluate a condition group. Returns null when there are no conditions so
 * callers can fall back to legacy behavior (visibilityPath / toggleDataPath).
 */
export const evaluateConditionGroup = (
  group: ConditionGroup | undefined | null,
  gameData: any
): boolean | null => {
  if (!hasConditions(group)) return null;
  const results = group.conditions.map(c => evaluateCondition(c, gameData));
  return group.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
};

/**
 * Pick the active state of a multi-state group: first state whose condition
 * matches, else the first state without a condition (the fallback), else the
 * first state. Returns null when the list is empty.
 */
export const resolveActiveStateId = (
  states: MultiStateDef[] | undefined | null,
  gameData: any
): string | null => {
  if (!Array.isArray(states) || states.length === 0) return null;

  for (const state of states) {
    if (evaluateConditionGroup(state.condition, gameData) === true) {
      return state.id;
    }
  }
  const fallback = states.find(s => !hasConditions(s.condition));
  return (fallback || states[0]).id;
};

/** True when a component config is a multi-state container. */
export const isMultiStateGroup = (props: any): boolean => {
  return Array.isArray(props?.states) && props.states.length > 0;
};

/**
 * Human-readable summary of a condition (for chips / state cards),
 * e.g. "homeTeam.score > awayTeam.score".
 */
export const describeCondition = (cond: Condition): string => {
  const right = cond.rightType === 'path' ? (cond.rightPath || '?') : (cond.rightValue ?? '?');
  return `${cond.leftPath || '?'} ${cond.op} ${right}`;
};

// ────────────────────────────────────────────────────────────────────────
// TV-runtime helpers — ancestor-driven visibility.
//
// DynamicScoreboard's structural pass is layout-static (it must not
// recompute on every game-data tick), so dynamic ancestor logic — group
// visibility conditions/paths and multi-state membership — is captured
// once per layout as a list of constraints and evaluated inside the leaf
// components on each game-data change (driving the opacity animation).
// ────────────────────────────────────────────────────────────────────────

export interface VisibilityConstraint {
  /** Boolean game-data path on an ancestor that must be true. */
  path?: string;
  /** Ancestor condition group that must evaluate true. */
  condition?: ConditionGroup;
  /** Multi-state membership: this state must be the active one. */
  state?: { states: MultiStateDef[]; stateId: string };
}

/** True when every ancestor constraint passes for the current game data. */
export const evaluateVisibilityConstraints = (
  constraints: VisibilityConstraint[] | undefined,
  gameData: any
): boolean => {
  if (!constraints || constraints.length === 0) return true;
  for (const c of constraints) {
    if (c.condition) {
      if (evaluateConditionGroup(c.condition, gameData) === false) return false;
    } else if (c.path) {
      const value = getNestedValue(gameData, c.path);
      if (typeof value === 'boolean' && !value) return false;
    }
    if (c.state) {
      const active = resolveActiveStateId(c.state.states, gameData);
      if (active && active !== c.state.stateId) return false;
    }
  }
  return true;
};

/**
 * Walk a component's ancestor chain and capture every dynamic visibility
 * gate: group visibilityCondition/visibilityPath and multi-state membership
 * (the direct child of a multi-state parent belongs to one state).
 * Layout-static — call once per prepared component.
 */
export const buildVisibilityConstraints = (
  component: { parentId?: string; id?: string },
  componentMap: Map<string, { parentId?: string; id?: string; props?: any }>
): VisibilityConstraint[] => {
  const constraints: VisibilityConstraint[] = [];
  let child: { parentId?: string; id?: string } = component;
  let parentId = component.parentId;
  while (parentId) {
    const parent = componentMap.get(parentId);
    if (!parent) break;
    const pProps: any = parent.props || {};

    if (hasConditions(pProps.visibilityCondition)) {
      constraints.push({ condition: pProps.visibilityCondition });
    } else if (pProps.visibilityPath) {
      constraints.push({ path: pProps.visibilityPath });
    }

    if (Array.isArray(pProps.states) && pProps.states.length > 0) {
      const entry = pProps.states.find((s: MultiStateDef) => s.childId === child.id);
      if (entry) {
        constraints.push({ state: { states: pProps.states, stateId: entry.id } });
      }
    }

    child = parent;
    parentId = parent.parentId;
  }
  return constraints;
};

/** Every game-data path referenced by a condition group (for memo guards). */
export const collectConditionPaths = (group: ConditionGroup | undefined | null): string[] => {
  if (!hasConditions(group)) return [];
  const paths: string[] = [];
  for (const c of group.conditions) {
    if (c.leftPath) paths.push(c.leftPath);
    if (c.rightType === 'path' && c.rightPath) paths.push(c.rightPath);
  }
  return paths;
};

/** Every game-data path referenced by a constraint list (for memo guards). */
export const collectConstraintPaths = (
  constraints: VisibilityConstraint[] | undefined
): string[] => {
  if (!constraints) return [];
  const paths: string[] = [];
  for (const c of constraints) {
    if (c.path) paths.push(c.path);
    if (c.condition) paths.push(...collectConditionPaths(c.condition));
    if (c.state) {
      for (const s of c.state.states) {
        paths.push(...collectConditionPaths(s.condition));
      }
    }
  }
  return paths;
};
