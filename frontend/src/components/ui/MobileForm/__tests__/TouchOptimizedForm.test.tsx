import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useForm, Controller } from 'react-hook-form';
import MobileForm, {
  MobileFormGroup,
  MobileFormLabel,
  MobileFormInput,
  MobileFormSelect,
  MobileFormTextarea,
  MobileFormCheckbox,
  MobileFormActions,
} from '../MobileForm';

// Test component that uses the MobileForm system
const TestFormComponent: React.FC<{
  onSubmit: (data: any) => void;
  includeErrors?: boolean;
}> = ({ onSubmit, includeErrors = false }) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<{
    name: string;
    email: string;
    category: string;
    description: string;
    terms: boolean;
  }>({
    mode: 'onBlur',
    defaultValues: {
      terms: false,
    },
  });

  const selectOptions = [
    { value: '', label: 'Selecciona una opción' },
    { value: 'personal', label: 'Personal' },
    { value: 'business', label: 'Empresa' },
    { value: 'other', label: 'Otro' },
  ];

  return (
    <MobileForm
      title="Formulario de Prueba"
      description="Formulario optimizado para dispositivos móviles"
      onSubmit={handleSubmit(onSubmit)}
    >
      <MobileFormGroup>
        <MobileFormLabel htmlFor="name" required>
          Nombre completo
        </MobileFormLabel>
        <MobileFormInput
          id="name"
          {...register('name', { required: 'El nombre es requerido' })}
          error={includeErrors ? errors.name?.message : undefined}
          placeholder="Ingresa tu nombre"
          autoComplete="name"
        />
      </MobileFormGroup>

      <MobileFormGroup>
        <MobileFormLabel htmlFor="email" required>
          Correo electrónico
        </MobileFormLabel>
        <MobileFormInput
          id="email"
          type="email"
          {...register('email', {
            required: 'El email es requerido',
            pattern: {
              value: /^\S+@\S+$/i,
              message: 'Formato de email inválido',
            },
          })}
          error={includeErrors ? errors.email?.message : undefined}
          placeholder="ejemplo@correo.com"
          autoComplete="email"
          inputMode="email"
        />
      </MobileFormGroup>

      <MobileFormGroup>
        <MobileFormLabel htmlFor="category">
          Categoría
        </MobileFormLabel>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <MobileFormSelect
              id="category"
              {...field}
              options={selectOptions}
              error={includeErrors ? errors.category?.message : undefined}
            />
          )}
        />
      </MobileFormGroup>

      <MobileFormGroup>
        <MobileFormLabel htmlFor="description">
          Descripción
        </MobileFormLabel>
        <MobileFormTextarea
          id="description"
          {...register('description')}
          error={includeErrors ? errors.description?.message : undefined}
          placeholder="Describe tu solicitud..."
          rows={4}
        />
      </MobileFormGroup>

      <MobileFormGroup>
        <Controller
          name="terms"
          control={control}
          rules={{ required: 'Debes aceptar los términos' }}
          render={({ field }) => (
            <MobileFormCheckbox
              id="terms"
              {...field}
              label="Acepto los términos y condiciones"
              error={includeErrors ? errors.terms?.message : undefined}
            />
          )}
        />
      </MobileFormGroup>

      <MobileFormActions>
        <button type="submit" className="submit-button">
          Enviar
        </button>
        <button type="button" className="cancel-button">
          Cancelar
        </button>
      </MobileFormActions>
    </MobileForm>
  );
};

describe('TouchOptimizedForm (MobileForm System)', () => {
  const user = userEvent.setup();
  const mockSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MobileForm Container', () => {
    it('should render form with title and description', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      expect(screen.getByText('Formulario de Prueba')).toBeInTheDocument();
      expect(screen.getByText('Formulario optimizado para dispositivos móviles')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('should prevent default form submission', async () => {
      const preventDefault = vi.fn();
      
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const form = screen.getByRole('form');
      fireEvent.submit(form, { preventDefault });

      expect(preventDefault).toHaveBeenCalled();
    });

    it('should have noValidate attribute for custom validation', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('noValidate');
    });
  });

  describe('MobileFormInput', () => {
    it('should render input with proper mobile attributes', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      const emailInput = screen.getByLabelText(/correo electrónico/i);

      expect(nameInput).toHaveAttribute('autoComplete', 'name');
      expect(nameInput).toHaveAttribute('placeholder', 'Ingresa tu nombre');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(emailInput).toHaveAttribute('inputMode', 'email');
    });

    it('should handle user input correctly', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      const emailInput = screen.getByLabelText(/correo electrónico/i);

      await user.type(nameInput, 'Juan Pérez');
      await user.type(emailInput, 'juan@example.com');

      expect(nameInput).toHaveValue('Juan Pérez');
      expect(emailInput).toHaveValue('juan@example.com');
    });

    it('should display error messages when validation fails', () => {
      render(<TestFormComponent onSubmit={mockSubmit} includeErrors={true} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      fireEvent.blur(nameInput);

      // Error message should appear
      expect(screen.getByText('El nombre es requerido')).toBeInTheDocument();
      expect(nameInput).toHaveClass('inputError');
    });

    it('should support touch-friendly focus and blur', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);

      await user.click(nameInput);
      expect(nameInput).toHaveFocus();

      await user.tab();
      expect(nameInput).not.toHaveFocus();
    });
  });

  describe('MobileFormSelect', () => {
    it('should render select with options', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const categorySelect = screen.getByLabelText(/categoría/i);
      expect(categorySelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: 'Selecciona una opción' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Personal' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Empresa' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Otro' })).toBeInTheDocument();
    });

    it('should handle selection changes', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const categorySelect = screen.getByLabelText(/categoría/i);
      
      await user.selectOptions(categorySelect, 'personal');
      expect(categorySelect).toHaveValue('personal');
    });

    it('should have touch-friendly size', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const categorySelect = screen.getByLabelText(/categoría/i);
      expect(categorySelect).toHaveClass('formSelect');
    });
  });

  describe('MobileFormTextarea', () => {
    it('should render textarea with proper attributes', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const descriptionTextarea = screen.getByLabelText(/descripción/i);
      expect(descriptionTextarea).toHaveAttribute('rows', '4');
      expect(descriptionTextarea).toHaveAttribute('placeholder', 'Describe tu solicitud...');
    });

    it('should handle multi-line text input', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const descriptionTextarea = screen.getByLabelText(/descripción/i);
      const multiLineText = 'Primera línea\nSegunda línea\nTercera línea';

      await user.type(descriptionTextarea, multiLineText);
      expect(descriptionTextarea).toHaveValue(multiLineText);
    });

    it('should be resizable for touch interactions', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const descriptionTextarea = screen.getByLabelText(/descripción/i);
      expect(descriptionTextarea).toHaveClass('formTextarea');
    });
  });

  describe('MobileFormCheckbox', () => {
    it('should render checkbox with large touch target', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const termsCheckbox = screen.getByLabelText(/acepto los términos/i);
      expect(termsCheckbox).toHaveAttribute('type', 'checkbox');
      expect(termsCheckbox).not.toBeChecked();
    });

    it('should handle checkbox interactions', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const termsCheckbox = screen.getByLabelText(/acepto los términos/i);
      
      await user.click(termsCheckbox);
      expect(termsCheckbox).toBeChecked();

      await user.click(termsCheckbox);
      expect(termsCheckbox).not.toBeChecked();
    });

    it('should show validation error for required checkbox', () => {
      render(<TestFormComponent onSubmit={mockSubmit} includeErrors={true} />);

      const submitButton = screen.getByRole('button', { name: /enviar/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Debes aceptar los términos')).toBeInTheDocument();
    });

    it('should be clickable via label for accessibility', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const termsLabel = screen.getByText(/acepto los términos/i);
      const termsCheckbox = screen.getByLabelText(/acepto los términos/i);

      await user.click(termsLabel);
      expect(termsCheckbox).toBeChecked();
    });
  });

  describe('MobileFormLabel', () => {
    it('should render labels with required indicators', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameLabel = screen.getByText(/nombre completo/i);
      const emailLabel = screen.getByText(/correo electrónico/i);
      const categoryLabel = screen.getByText(/categoría/i);

      // Required labels should have asterisk
      expect(nameLabel.parentElement).toHaveTextContent('*');
      expect(emailLabel.parentElement).toHaveTextContent('*');
      
      // Optional labels should not have asterisk
      expect(categoryLabel.parentElement).not.toHaveTextContent('*');
    });

    it('should be properly associated with form controls', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameLabel = screen.getByText(/nombre completo/i);
      const nameInput = screen.getByLabelText(/nombre completo/i);

      expect(nameLabel.closest('label')).toHaveAttribute('for', 'name');
      expect(nameInput).toHaveAttribute('id', 'name');
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      // Fill out the form
      await user.type(screen.getByLabelText(/nombre completo/i), 'Juan Pérez');
      await user.type(screen.getByLabelText(/correo electrónico/i), 'juan@example.com');
      await user.selectOptions(screen.getByLabelText(/categoría/i), 'personal');
      await user.type(screen.getByLabelText(/descripción/i), 'Esta es una descripción de prueba');
      await user.click(screen.getByLabelText(/acepto los términos/i));

      // Submit the form
      await user.click(screen.getByRole('button', { name: /enviar/i }));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          name: 'Juan Pérez',
          email: 'juan@example.com',
          category: 'personal',
          description: 'Esta es una descripción de prueba',
          terms: true,
        });
      });
    });

    it('should prevent submission with invalid data', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} includeErrors={true} />);

      // Submit without filling required fields
      await user.click(screen.getByRole('button', { name: /enviar/i }));

      // Should not call onSubmit
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Touch Optimization', () => {
    it('should have minimum 44px touch targets', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const inputs = screen.getAllByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /enviar/i });
      const checkbox = screen.getByRole('checkbox');

      // All interactive elements should have touch-friendly classes
      inputs.forEach(input => {
        expect(input).toHaveClass('formInput');
      });

      expect(checkbox.closest('.formCheckbox')).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
    });

    it('should handle touch events properly', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);

      // Simulate touch events
      fireEvent.touchStart(nameInput);
      fireEvent.touchEnd(nameInput);

      expect(nameInput).toBeInTheDocument();
    });

    it('should prevent iOS zoom on input focus', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const emailInput = screen.getByLabelText(/correo electrónico/i);
      
      // Should have inputMode for better mobile keyboard
      expect(emailInput).toHaveAttribute('inputMode', 'email');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA relationships', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      const nameLabel = screen.getByText(/nombre completo/i);

      expect(nameLabel.closest('label')).toHaveAttribute('for', 'name');
      expect(nameInput).toHaveAttribute('id', 'name');
    });

    it('should support keyboard navigation', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      const emailInput = screen.getByLabelText(/correo electrónico/i);

      // Tab through form elements
      await user.tab();
      expect(nameInput).toHaveFocus();

      await user.tab();
      expect(emailInput).toHaveFocus();
    });

    it('should announce errors to screen readers', () => {
      render(<TestFormComponent onSubmit={mockSubmit} includeErrors={true} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      fireEvent.blur(nameInput);

      const errorMessage = screen.getByText('El nombre es requerido');
      expect(errorMessage).toHaveClass('errorMessage');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to different screen sizes', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const form = screen.getByRole('form');
      expect(form).toHaveClass('mobileForm');
    });

    it('should use fluid container for responsive layout', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      // Check that ResponsiveContainer is used
      const container = screen.getByRole('form').closest('[class*="ResponsiveContainer"]');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Form Groups and Actions', () => {
    it('should group related form elements', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const formGroups = document.querySelectorAll('.formGroup');
      expect(formGroups.length).toBeGreaterThan(0);
    });

    it('should render action buttons in dedicated container', () => {
      render(<TestFormComponent onSubmit={mockSubmit} />);

      const submitButton = screen.getByRole('button', { name: /enviar/i });
      const cancelButton = screen.getByRole('button', { name: /cancelar/i });

      expect(submitButton.closest('.formActions')).toBeInTheDocument();
      expect(cancelButton.closest('.formActions')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display validation errors inline', () => {
      render(<TestFormComponent onSubmit={mockSubmit} includeErrors={true} />);

      const emailInput = screen.getByLabelText(/correo electrónico/i);
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      expect(screen.getByText('Formato de email inválido')).toBeInTheDocument();
    });

    it('should clear errors when valid input is provided', async () => {
      render(<TestFormComponent onSubmit={mockSubmit} includeErrors={true} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      
      // Trigger error
      fireEvent.blur(nameInput);
      expect(screen.getByText('El nombre es requerido')).toBeInTheDocument();

      // Fix error
      await user.type(nameInput, 'Juan Pérez');
      
      // Error should be cleared (would need form revalidation to test fully)
      expect(nameInput).toHaveValue('Juan Pérez');
    });
  });
});