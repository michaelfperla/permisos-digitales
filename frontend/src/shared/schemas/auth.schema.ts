import { z } from 'zod';

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Falta tu correo electrónico')
    .email('Escribe un correo electrónico válido'),
  password: z.string().min(1, 'Falta tu contraseña'),
});

/**
 * Type for login form data
 */
export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Admin login form schema
 */
export const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Falta tu correo electrónico')
    .email('Escribe un correo electrónico válido'),
  password: z.string().min(1, 'Falta tu contraseña'),
});

/**
 * Type for admin login form data
 */
export type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

/**
 * Registration form schema
 */
export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'Falta tu nombre'),
    lastName: z.string().min(1, 'Falta tu apellido'),
    email: z
      .string()
      .min(1, 'Falta tu correo electrónico')
      .email('Escribe un correo electrónico válido'),
    password: z
      .string()
      .min(1, 'Falta tu contraseña')
      .min(8, 'Tu contraseña debe tener mínimo 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no son iguales',
    path: ['confirmPassword'],
  });

/**
 * Type for registration form data
 */
export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Forgot password form schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Falta tu correo electrónico')
    .email('Escribe un correo electrónico válido'),
});

/**
 * Type for forgot password form data
 */
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Password validation schema with strength checking
 */
const passwordValidationSchema = z
  .string()
  .min(1, 'Falta tu contraseña')
  .min(8, 'Tu contraseña debe tener mínimo 8 caracteres');

/**
 * Reset password form schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordValidationSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no son iguales',
    path: ['confirmPassword'],
  });

/**
 * Type for reset password form data
 */
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Change password form schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: passwordValidationSchema,
    confirmPassword: z.string().min(1, 'Debe confirmar la nueva contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

/**
 * Type for change password form data
 */
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
