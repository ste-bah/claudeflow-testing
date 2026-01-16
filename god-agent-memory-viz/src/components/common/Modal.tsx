import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils';
import { Button } from './Button';

/**
 * Modal size types
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Modal component props
 */
export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Title displayed in the modal header */
  title?: string;
  /** Size of the modal */
  size?: ModalSize;
  /** Whether clicking the overlay closes the modal */
  closeOnOverlay?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
  /** Whether to show the close button in the header */
  showCloseButton?: boolean;
  /** Modal body content */
  children: React.ReactNode;
  /** Footer content (typically action buttons) */
  footer?: React.ReactNode;
  /** Additional class name for the modal content */
  className?: string;
}

/**
 * Maps size prop to CSS class modifier
 */
const sizeClassMap: Record<ModalSize, string> = {
  sm: 'modal__content--sm',
  md: '',
  lg: 'modal__content--lg',
  xl: 'modal__content--xl',
  full: 'modal__content--full',
};

/**
 * Focusable element selectors for focus trap
 */
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Modal component with portal rendering, focus trap, and accessibility support.
 *
 * @example
 * // Basic modal
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 *
 * @example
 * // Modal with footer
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Edit Item"
 *   size="lg"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={handleClose}>Cancel</Button>
 *       <Button onClick={handleSave}>Save</Button>
 *     </>
 *   }
 * >
 *   <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
 * </Modal>
 *
 * @example
 * // Full-screen modal
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Full Screen View"
 *   size="full"
 *   closeOnOverlay={false}
 * >
 *   <div>Full screen content here</div>
 * </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  footer,
  className,
}: ModalProps): React.ReactPortal | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  /**
   * Handle escape key press
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose();
      }

      // Focus trap: Tab key navigation
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTORS
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement) return;

        if (event.shiftKey) {
          // Shift + Tab: Move focus backward
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: Move focus forward
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [closeOnEscape, onClose]
  );

  /**
   * Handle overlay click
   */
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && closeOnOverlay) {
        onClose();
      }
    },
    [closeOnOverlay, onClose]
  );

  /**
   * Lock body scroll when modal is open
   */
  useEffect(() => {
    if (isOpen) {
      // Store the current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      // Focus the modal
      setTimeout(() => {
        if (modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            FOCUSABLE_SELECTORS
          );
          const firstElement = focusableElements[0];
          if (firstElement) {
            firstElement.focus();
          } else {
            // If no focusable elements, focus the modal itself
            modalRef.current.focus();
          }
        }
      }, 0);

      // Add event listener for keyboard navigation
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        // Restore body scroll
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;

        // Remove event listener
        document.removeEventListener('keydown', handleKeyDown);

        // Restore focus to previously focused element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      className={cn('modal', isOpen && 'modal--open')}
      role="presentation"
    >
      {/* Overlay */}
      <div
        className="modal__overlay"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className={cn(
          'modal__content',
          sizeClassMap[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="modal__header">
            {title && (
              <h2 id="modal-title" className="modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                iconOnly
                size="sm"
                onClick={onClose}
                className="modal__close"
                aria-label="Close modal"
              >
                <X size={18} />
              </Button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="modal__body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );

  // Render via portal to document.body
  return createPortal(modalContent, document.body);
}

Modal.displayName = 'Modal';

export default Modal;
