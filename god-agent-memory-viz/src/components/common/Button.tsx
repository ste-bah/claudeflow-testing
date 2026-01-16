import React, { forwardRef } from 'react';
import { cn } from '@/utils';
import { Spinner } from './Loading';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Button size types
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button component props
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Shows a loading spinner and disables the button */
  isLoading?: boolean;
  /** Text to show while loading (replaces children) */
  loadingText?: string;
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Makes the button full width */
  fullWidth?: boolean;
  /** Renders as icon-only button (square aspect ratio) */
  iconOnly?: boolean;
}

/**
 * Maps size prop to CSS class modifier
 */
const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
};

/**
 * Maps size prop to icon-only CSS class modifier
 */
const iconOnlySizeClassMap: Record<ButtonSize, string> = {
  sm: 'btn--icon-sm',
  md: 'btn--icon',
  lg: 'btn--icon-lg',
};

/**
 * Maps size prop to spinner size
 */
const spinnerSizeMap: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
};

/**
 * Button component with multiple variants, sizes, and loading state support.
 *
 * @example
 * // Primary button
 * <Button variant="primary">Click me</Button>
 *
 * @example
 * // Loading state
 * <Button isLoading loadingText="Saving...">Save</Button>
 *
 * @example
 * // With icons
 * <Button leftIcon={<PlusIcon />}>Add Item</Button>
 *
 * @example
 * // Icon-only button
 * <Button iconOnly variant="ghost" aria-label="Settings">
 *   <SettingsIcon />
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      iconOnly = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const buttonClasses = cn(
      'btn',
      `btn--${variant}`,
      iconOnly ? iconOnlySizeClassMap[size] : sizeClassMap[size],
      fullWidth && 'w-full',
      className
    );

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner size={spinnerSizeMap[size]} className="btn__icon" />
            {loadingText && <span>{loadingText}</span>}
            {!loadingText && !iconOnly && children}
          </>
        ) : (
          <>
            {leftIcon && <span className="btn__icon">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="btn__icon">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
