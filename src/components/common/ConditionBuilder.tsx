import React from 'react';
import DataPathPicker from './DataPathPicker';
import { findOption, valuesForPath, PathValueOption } from './dataPathOptions';
import {
  Condition,
  ConditionGroup,
  ConditionOperator,
  CONDITION_OPERATORS,
} from '../../shared/conditions';
import './ConditionBuilder.css';

/**
 * Generic condition editor. Lives inside the DataPathPicker modal's
 * Condition tab (visibility / toggle bindings) and inline in the
 * Multi-State property section. Each row is one inline comparison:
 *
 *   [game value path]  [operator]  [literal value | another path]
 *
 * Rows combine with AND/OR.
 *
 * Operand path selection has two modes:
 *  - `onRequestPath` provided (modal host): renders a plain button and asks
 *    the host to run the pick — the DataPathPicker modal swaps to its browse
 *    pane in-place instead of stacking a second modal.
 *  - omitted (inline use): nests a full DataPathPicker per operand.
 */

export interface ConditionBuilderProps {
  value: ConditionGroup | undefined;
  onChange: (next: ConditionGroup | undefined) => void;
  /** Hint shown when no conditions exist (e.g. "Always visible"). */
  emptyHint?: string;
  /** Host-driven operand picking (see above). */
  onRequestPath?: (current: string | undefined, commit: (path: string) => void) => void;
}

const emptyCondition = (): Condition => ({
  leftPath: '',
  op: '==',
  rightType: 'value',
  rightValue: '',
});

// Literal-value input that commits on blur/Enter. Inline hosts (multi-state
// cards) persist edits straight into the component, which remounts the
// property panel subtree — committing per keystroke would drop focus.
const DebouncedValueInput = ({ value, onCommit, placeholder }: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
}) => {
  const [local, setLocal] = React.useState(value);
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (document.activeElement !== ref.current) setLocal(value);
  }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      className="condition-builder__value"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onCommit(local);
          ref.current?.blur();
        }
      }}
    />
  );
};

// Right-side operand mode for enum-valued paths (trivia phase, question kind,
// ...): pick "Answer (reveal)" without having to know the wire value is
// `answer`. This is its own mode alongside 123 / {x} / T/F — free-text entry
// stays available for every path. An off-list value (hand-edited layout,
// renamed enum) is kept as an extra entry so nothing is silently rewritten.
const EnumValueSelect = ({ values, value, onCommit }: {
  values: PathValueOption[];
  value: string;
  onCommit: (next: string) => void;
}) => {
  const known = values.some(v => v.value === value);
  return (
    <select
      className="condition-builder__enum"
      value={value}
      onChange={(e) => onCommit(e.target.value)}
      title={value || 'Select value'}
    >
      {!known && <option value={value}>{value ? `${value} (unknown)` : 'Select value…'}</option>}
      {values.map(v => (
        <option key={v.value} value={v.value}>{v.label}</option>
      ))}
    </select>
  );
};

// Compact operator symbols for the inline row layout.
const OP_SYMBOLS: Record<ConditionOperator, string> = {
  '==': '=',
  '!=': '≠',
  '>': '>',
  '>=': '≥',
  '<': '<',
  '<=': '≤',
};

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  value,
  onChange,
  emptyHint = 'No conditions',
  onRequestPath,
}) => {
  const conditions = value?.conditions || [];
  const logic = value?.logic || 'and';

  // Operand path control: host-driven button (modal) or nested picker (inline).
  // Single-line — the friendly label shows, the raw path lives in the tooltip.
  const renderPathControl = (current: string | undefined, commit: (path: string) => void) => {
    if (onRequestPath) {
      const option = findOption(current || undefined);
      return (
        <button
          type="button"
          className={`condition-builder__path-btn ${!current ? 'is-empty' : ''}`}
          onClick={() => onRequestPath(current, commit)}
          title={current || 'Select game value'}
        >
          {option?.label || current || 'Select value…'}
        </button>
      );
    }
    return (
      <div className="condition-builder__operand">
        <DataPathPicker
          purpose="condition"
          value={current}
          placeholder="Select value…"
          allowClear={false}
          onChange={commit}
        />
      </div>
    );
  };

  const commit = (next: Condition[], nextLogic: 'and' | 'or' = logic) => {
    if (next.length === 0) {
      onChange(undefined);
    } else {
      onChange({ logic: nextLogic, conditions: next });
    }
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    commit(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const removeCondition = (index: number) => {
    commit(conditions.filter((_, i) => i !== index));
  };

  const addCondition = () => {
    commit([...conditions, { ...emptyCondition(), join: 'and' }]);
  };

  return (
    <div className="condition-builder">
      {conditions.length === 0 && (
        <div className="condition-builder__empty">{emptyHint}</div>
      )}

      {conditions.map((cond, index) => {
        const enumValues = valuesForPath(cond.leftPath);
        return (
          <div key={index} className="condition-builder__row">
            {/* Chain operator — how this row combines with the result so far.
                Evaluation is left to right: a AND b OR c = ((a AND b) OR c) */}
            {index > 0 && (
              <select
                className="condition-builder__join"
                value={cond.join || logic || 'and'}
                onChange={(e) => updateCondition(index, { join: e.target.value as 'and' | 'or' })}
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
              </select>
            )}

            <button
              type="button"
              className={`condition-builder__not ${cond.negate ? 'is-on' : ''}`}
              onClick={() => updateCondition(index, { negate: cond.negate ? undefined : true })}
              title={cond.negate ? 'Negated (NOT) — click to remove' : 'Click to negate (NOT)'}
            >
              NOT
            </button>

            {renderPathControl(cond.leftPath, (path) => updateCondition(index, { leftPath: path }))}

            <select
              className="condition-builder__op"
              value={cond.op}
              title={CONDITION_OPERATORS.find(o => o.value === cond.op)?.label}
              onChange={(e) => updateCondition(index, { op: e.target.value as ConditionOperator })}
            >
              {CONDITION_OPERATORS.map(op => (
                <option key={op.value} value={op.value} title={op.label}>{OP_SYMBOLS[op.value]}</option>
              ))}
            </select>

            {cond.rightType === 'path' ? (
              renderPathControl(cond.rightPath, (path) => updateCondition(index, { rightPath: path }))
            ) : cond.rightType === 'bool' ? (
              <select
                className="condition-builder__bool"
                value={cond.rightValue === 'false' ? 'false' : 'true'}
                onChange={(e) => updateCondition(index, { rightValue: e.target.value })}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : cond.rightType === 'enum' && enumValues ? (
              <EnumValueSelect
                values={enumValues}
                value={cond.rightValue ?? ''}
                onCommit={(next) => updateCondition(index, { rightValue: next })}
              />
            ) : (
              <DebouncedValueInput
                value={cond.rightValue ?? ''}
                placeholder="value"
                onCommit={(next) => updateCondition(index, { rightValue: next })}
              />
            )}

            <button
              type="button"
              className="condition-builder__mode-btn"
              onClick={() => {
                // value → path → bool → enum (enum only offered when the left
                // path has a fixed set of values) → value
                const nextType = cond.rightType === 'value' ? 'path'
                  : cond.rightType === 'path' ? 'bool'
                  : cond.rightType === 'bool' && enumValues ? 'enum'
                  : 'value';
                updateCondition(index, {
                  rightType: nextType,
                  // Entering bool mode needs a valid true/false value
                  ...(nextType === 'bool' && cond.rightValue !== 'true' && cond.rightValue !== 'false'
                    ? { rightValue: 'true' }
                    : {}),
                  // Entering enum mode needs one of the path's values
                  ...(nextType === 'enum' && enumValues && !enumValues.some(v => v.value === cond.rightValue)
                    ? { rightValue: enumValues[0].value }
                    : {}),
                });
              }}
              title={cond.rightType === 'value'
                ? 'Fixed value — click to compare against a game value'
                : cond.rightType === 'path'
                ? 'Game value — click to compare against true/false'
                : cond.rightType === 'bool'
                ? (enumValues
                  ? 'True/false — click to pick from this path\'s values'
                  : 'True/false — click to compare against a fixed value')
                : 'One of this path\'s values — click to compare against a fixed value'}
            >
              {cond.rightType === 'value' ? '123'
                : cond.rightType === 'path' ? '{x}'
                : cond.rightType === 'bool' ? 'T/F'
                : '≡'}
            </button>

            <button
              type="button"
              className="condition-builder__remove"
              onClick={() => removeCondition(index)}
              title="Remove condition"
            >
              ✕
            </button>
          </div>
        );
      })}

      <div className="condition-builder__footer">
        <button
          type="button"
          className="condition-builder__add"
          onClick={addCondition}
        >
          + Add Condition
        </button>
      </div>
    </div>
  );
};

export default ConditionBuilder;
