import React, { forwardRef, useId } from 'react';
import { cn } from '@/utils';

/**
 * Input variant types
 */
export type InputVariant = 'default' | 'error' | 'success';

/**
 * Input size types
 */
export type InputSize = 'sm' | 'md' | 'lg';

/**
 * Input component props
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual style variant */
  variant?: InputVariant;
  /** Size of the input */
  size?: InputSize;
  /** Label text displayed above the input */
  label?: string;
  /** Whether the field is required (shows asterisk on label) */
  required?: boolean;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Error message displayed below the input (overrides helperText) */
  errorMessage?: string;
  /** Icon to display on the left side of the input */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side of the input */
  rightIcon?: React.ReactNode;
  /** Makes the input full width */
  fullWidth?: boolean;
  /** Additional class name for the wrapper element */
  wrapperClassName?: string;
}

/**
 * Maps size prop to CSS padding classes for base input
 */
const sizeClassMap: Record<InputSize, string> = {
  sm: 'input--sm',
  md: '',
  lg: 'input--lg',
};

/**
 * Maps size prop to icon size classes
 */
const iconSizeClassMap: Record<InputSize, string> = {
  sm: 'input-wrapper__icon--sm',
  md: '',
  lg: 'input-wrapper__icon--lg',
};

/**
 * Input component with label, helper text, error states, and icon support.
 *
 * @example
 * // Basic input
 * <Input label="Email" placeholder="Enter your email" />
 *
 * @example
 * // With error state
 * <Input
 *   label="Password"
 *   type="password"
 *   variant="error"
 *   errorMessage="Password is required"
 * />
 *
 * @example
 * // With icons
 * <Input
 *   label="Search"
 *   leftIcon={<SearchIcon />}
 *   rightIcon={<ClearIcon />}
 *   placeholder="Search..."
 * />
 *
 * @example
 * // Success variant with helper text
 * <Input
 *   label="Username"
 *   variant="success"
 *   helperText="Username is available"
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = 'default',
      size = 'md',
      label,
      required = false,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      fullWidth = false,
      wrapperClassName,
      disabled,
      className,
      id: providedId,
      ...props
    },
    ref
  ) => {
    // Generate a unique ID if not provided
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    // Determine the effective variant based on error message
    const effectiveVariant = errorMessage ? 'error' : variant;

    // Build class names
    const groupClasses = cn(
      'input-group',
      effectiveVariant === 'error' && 'input-group--error',
      effectiveVariant === 'success' && 'input-group--success',
      fullWidth && 'w-full',
      wrapperClassName
    );

    const wrapperClasses = cn(
      'input-wrapper',
      leftIcon && 'input-wrapper--icon-left',
      rightIcon && 'input-wrapper--icon-right'
    );

    const inputClasses = cn(
      'input-group__input',
      sizeClassMap[size],
      effectiveVariant === 'error' && 'input-group__input--error',
      effectiveVariant === 'success' && 'input-group__input--success',
      className
    );

    const leftIconClasses = cn(
      'input-wrapper__icon',
      'input-wrapper__icon--left',
      iconSizeClassMap[size]
    );

    const rightIconClasses = cn(
      'input-wrapper__icon',
      'input-wrapper__icon--right',
      iconSizeClassMap[size]
    );

    // Determine which description ID to use for aria-describedby
    const describedBy = errorMessage ? errorId : helperText ? helperId : undefined;

    return (
      <div className={groupClasses}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'input-group__label',
              required && 'input-group__label--required'
            )}
          >
            {label}
          </label>
        )}

        <div className={wrapperClasses}>
          {leftIcon && (
            <span className={leftIconClasses} aria-hidden="true">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            disabled={disabled}
            aria-disabled={disabled}
            aria-invalid={effectiveVariant === 'error'}
            aria-describedby={describedBy}
            aria-required={required}
            {...props}
          />

          {rightIcon && (
            <span className={rightIconClasses} aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>

        {errorMessage && (
          <span id={errorId} className="input-group__error" role="alert">
            {errorMessage}
          </span>
        )}

        {helperText && !errorMessage && (
          <span id={helperId} className="input-group__helper">
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
