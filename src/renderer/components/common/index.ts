// src/renderer/components/common/index.ts
// Barrel export for all common UI primitives (T014).
export { Button, IconButton } from './Button';
export type { ButtonProps, IconButtonProps, ButtonVariant, ButtonSize } from './Button';

export { ErrorBoundary, GlobalErrorBoundary } from './ErrorBoundary';

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Modal,
} from './Modal';

export { StatusBadge, LoadingSpinner, ProgressBar } from './StatusBadge';
export type { BadgeVariant, SpinnerSize } from './StatusBadge';

export { Tooltip, TooltipProvider, EmptyState } from './Tooltip';
