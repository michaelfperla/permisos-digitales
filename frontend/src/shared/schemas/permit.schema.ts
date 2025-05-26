import { z } from 'zod';

/**
 * Schema for permit renewal form
 */
export const permitRenewalSchema = z.object({
  domicilio: z
    .string()
    .min(1, 'El domicilio es obligatorio')
    .max(255, 'El domicilio no puede exceder 255 caracteres'),
  color: z
    .string()
    .min(1, 'El color del vehículo es obligatorio')
    .max(100, 'El color del vehículo no puede exceder 100 caracteres'),
  renewal_reason: z.string().min(1, 'El motivo de renovación es obligatorio'),
  renewal_notes: z.string().optional(),
});

/**
 * Type for permit renewal form data
 */
export type PermitRenewalFormData = z.infer<typeof permitRenewalSchema>;

/**
 * Schema for personal information step
 */
export const personalInfoSchema = z.object({
  nombre_completo: z
    .string()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres')
    .max(255, 'El nombre completo no puede exceder 255 caracteres')
    .regex(
      /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s\-'.,:;()]+$/,
      'El nombre contiene caracteres no permitidos',
    ),
  curp_rfc: z
    .string()
    .min(10, 'El CURP o RFC debe tener entre 10 y 50 caracteres')
    .max(50, 'El CURP o RFC debe tener entre 10 y 50 caracteres')
    .regex(/^[A-Z0-9]+$/i, 'El CURP o RFC solo debe contener letras y números'),
  domicilio: z.string().min(5, 'El domicilio debe tener al menos 5 caracteres'),
});

/**
 * Schema for vehicle information step
 */
export const vehicleInfoSchema = z.object({
  marca: z
    .string()
    .min(2, 'La marca del vehículo es requerida')
    .max(100, 'La marca del vehículo no puede exceder 100 caracteres'),
  linea: z
    .string()
    .min(2, 'El modelo del vehículo es requerido')
    .max(100, 'El modelo del vehículo no puede exceder 100 caracteres'),
  color: z
    .string()
    .min(2, 'El color del vehículo es requerido')
    .max(100, 'El color del vehículo no puede exceder 100 caracteres'),
  numero_serie: z
    .string()
    .min(5, 'El número de serie debe tener entre 5 y 50 caracteres')
    .max(50, 'El número de serie debe tener entre 5 y 50 caracteres')
    .regex(/^[A-Z0-9]+$/i, 'El número de serie solo debe contener letras y números'),
  numero_motor: z
    .string()
    .min(2, 'El número de motor es requerido')
    .max(50, 'El número de motor no puede exceder 50 caracteres'),
  ano_modelo: z.union([
    z
      .string()
      .refine(
        (val) => {
          const year = parseInt(val);
          const currentYear = new Date().getFullYear();
          return !isNaN(year) && year >= 1900 && year <= currentYear + 2;
        },
        {
          message: `El año debe estar entre 1900 y ${new Date().getFullYear() + 2}`,
        },
      )
      .refine((val) => /^\d{4}$/.test(val), {
        message: 'El año debe ser de 4 dígitos',
      }),
    z.number().refine(
      (val) => {
        const currentYear = new Date().getFullYear();
        return val >= 1900 && val <= currentYear + 2;
      },
      {
        message: `El año debe estar entre 1900 y ${new Date().getFullYear() + 2}`,
      },
    ),
  ]),
});

/**
 * Schema for payment information
 */
export const paymentInfoSchema = z.object({
  payment_token: z.string().optional(),
  payment_method: z.enum(['card', 'oxxo']).optional(),
  device_session_id: z.string().optional(),
});

/**
 * Complete permit application schema
 */
export const completePermitSchema = z.object({
  ...personalInfoSchema.shape,
  ...vehicleInfoSchema.shape,
  ...paymentInfoSchema.shape,
});

/**
 * Type for personal information form data
 */
export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

/**
 * Type for vehicle information form data
 */
export type VehicleInfoFormData = z.infer<typeof vehicleInfoSchema>;

/**
 * Type for payment information form data
 */
export type PaymentInfoFormData = z.infer<typeof paymentInfoSchema>;

/**
 * Type for complete permit form data
 */
export type CompletePermitFormData = z.infer<typeof completePermitSchema>;
