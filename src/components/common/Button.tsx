import React from 'react';
import './Button.css';

/**
 * Compact, designer-friendly button used across the layout-builder panels.
 *
 * Variants control color/accent. Sizes default to `sm` because the panel
 * UI is dense; use `xs` for icon-only inline actions, `md` for primary
 * action rows (e.g. modals).
 */

export type ButtonVariant =
  | 'default'   // neutral grey
  | 'primary'   // blue accent
  | 'secondary' // purple accent
  | 'success'   // green
  | 'danger'    // red
  | 'ghost';    // transparent / hover-only fill

export type ButtonSize = 'xs' | 'sm' | 'md';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;          // full width
  icon?: React.ReactNode;   // optional leading glyph (string char or svg)
  iconOnly?: boolean;       // hide label slot — square icon button
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'default',
  size = 'sm',
  block = false,
  icon,
  iconOnly = false,
  className = '',
  children,
  ...rest
}, ref) => {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block ? 'btn--block' : '',
    iconOnly ? 'btn--icon-only' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button ref={ref} type="button" className={classes} {...rest}>
      {icon && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      {!iconOnly && children !== undefined && <span className="btn__label">{children}</span>}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
