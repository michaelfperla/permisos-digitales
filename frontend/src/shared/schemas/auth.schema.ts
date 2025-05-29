import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Falta tu correo electrónico')
    .email('Escribe un correo electrónico válido'),
  password: z.string().min(1, 'Falta tu contraseña'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Falta tu correo electrónico')
    .email('Escribe un correo electrónico válido'),
  password: z.string().min(1, 'Falta tu contraseña'),
});

export type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

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

export type RegisterFormData = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Falta tu correo electrónico')
    .email('Escribe un correo electrónico válido'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const passwordValidationSchema = z
  .string()
  .min(1, 'Falta tu contraseña')
  .min(8, 'Tu contraseña debe tener mínimo 8 caracteres');

export const resetPasswordSchema = z
  .object({
    password: passwordValidationSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no son iguales',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

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

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
