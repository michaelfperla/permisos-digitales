/**
 * Mobile Components Index
 *
 * This file exports all mobile-optimized components for easy importing.
 *
 * Usage:
 * import { MobileForm, MobileTable, MobileNavigation } from '@/components/mobile';
 */

// Mobile Navigation
import MobileNavigation from '../navigation/MobileNavigation/MobileNavigation';
// Mobile Table
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormSelect,
  MobileFormTextarea,
  MobileFormCheckbox,
  MobileFormActions,
} from '../ui/MobileForm/MobileForm';
import {
  RHFMobileFormInput,
  RHFMobileFormSelect,
  RHFMobileFormTextarea,
  RHFMobileFormCheckbox,
} from '../ui/MobileForm/RHFAdapters';
import MobileTable from '../ui/MobileTable/MobileTable';

import type { Column as MobileTableColumn } from '../ui/MobileTable/MobileTable';

// Mobile Form

// React Hook Form Adapters

export {
  // Navigation
  MobileNavigation,

  // Table
  MobileTable,

  // Form
  MobileForm,
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormSelect,
  MobileFormTextarea,
  MobileFormCheckbox,
  MobileFormActions,

  // React Hook Form Adapters
  RHFMobileFormInput,
  RHFMobileFormSelect,
  RHFMobileFormTextarea,
  RHFMobileFormCheckbox,
};

export type { MobileTableColumn };
