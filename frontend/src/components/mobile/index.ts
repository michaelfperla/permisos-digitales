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
import MobileTable from '../ui/MobileTable/MobileTable';
import type { Column as MobileTableColumn } from '../ui/MobileTable/MobileTable';

// Mobile Form
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormSelect,
  MobileFormTextarea,
  MobileFormCheckbox,
  MobileFormActions
} from '../ui/MobileForm/MobileForm';

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
  MobileFormActions
};

export type {
  MobileTableColumn
};
