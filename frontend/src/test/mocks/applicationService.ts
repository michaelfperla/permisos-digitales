import { vi } from 'vitest';

import { Application, ApplicationStatus } from '../../services/applicationService';

// Mock application data
export const mockApplications: Application[] = [
  {
    id: '1',
    user_id: '123',
    status: 'PERMIT_READY' as ApplicationStatus,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-20T14:45:00Z',

    // Applicant Data
    nombre_completo: 'Test User',
    curp_rfc: 'TESU123456ABC',
    domicilio: '123 Main St, Anytown, CA 12345',

    // Vehicle Data
    marca: 'Ford',
    linea: 'Mustang',
    color: 'Rojo',
    numero_serie: 'ABC123456789',
    numero_motor: 'M123456',
    ano_modelo: 2023,

    // Permit Data
    folio: 'PD-2025-001',
    importe: 150.0,
    fecha_expedicion: '2025-01-15',
    fecha_vencimiento: '2026-01-15',

    // Payment Data - using current system properties
    // payment_reference is not part of the Application type in current system
  },
  {
    id: '2',
    user_id: '123',
    status: 'AWAITING_OXXO_PAYMENT' as ApplicationStatus,
    created_at: '2025-02-10T09:15:00Z',
    updated_at: '2025-02-10T09:15:00Z',

    // Applicant Data
    nombre_completo: 'Test User',
    curp_rfc: 'TESU123456ABC',
    domicilio: '123 Main St, Anytown, CA 12345',

    // Vehicle Data
    marca: 'Toyota',
    linea: 'Corolla',
    color: 'Azul',
    numero_serie: 'DEF456789012',
    numero_motor: 'M789012',
    ano_modelo: 2022,
  },
  {
    id: '3',
    user_id: '123',
    status: 'PAYMENT_FAILED' as ApplicationStatus,
    created_at: '2025-03-05T13:20:00Z',
    updated_at: '2025-03-06T10:10:00Z',

    // Applicant Data
    nombre_completo: 'Test User',
    curp_rfc: 'TESU123456ABC',
    domicilio: '123 Main St, Anytown, CA 12345',

    // Vehicle Data
    marca: 'Honda',
    linea: 'Civic',
    color: 'Negro',
    numero_serie: 'GHI789012345',
    numero_motor: 'M345678',
    ano_modelo: 2024,

    // Payment Data - payment failed
    // payment_reference is not part of the Application type in current system
  },
];

// Mock application service
const applicationServiceMock = {
  getApplications: vi.fn().mockResolvedValue({
    success: true,
    applications: mockApplications,
  }),

  getApplicationById: vi.fn().mockImplementation((id: string) => {
    const application = mockApplications.find((app) => app.id === id);

    if (application) {
      return Promise.resolve({
        success: true,
        application,
      });
    }

    return Promise.resolve({
      success: false,
      application: {} as Application,
      message: 'Application not found',
    });
  }),

  createApplication: vi.fn().mockImplementation((applicationData: Partial<Application>) => {
    const newApplication = {
      id: '999',
      user_id: '123',
      status: 'PENDING_PAYMENT' as ApplicationStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // Applicant Data
      nombre_completo: applicationData.nombre_completo || 'New Test User',
      curp_rfc: applicationData.curp_rfc || 'NEWU123456ABC',
      domicilio: applicationData.domicilio || '456 New St, Newtown, CA 54321',

      // Vehicle Data
      marca: applicationData.marca || 'New Brand',
      linea: applicationData.linea || 'New Model',
      color: applicationData.color || 'New Color',
      numero_serie: applicationData.numero_serie || 'NEW123456789',
      numero_motor: applicationData.numero_motor || 'NEWM123456',
      ano_modelo: applicationData.ano_modelo || '2025',

      ...applicationData,
    };

    return Promise.resolve({
      success: true,
      application: newApplication,
      message: 'Application created successfully',
      paymentInstructions: {
        amount: 1500,
        currency: 'MXN',
        reference: `PD-${newApplication.id}`,
        paymentMethods: ['Transferencia Bancaria', 'Depósito en Banco', 'Pago en Línea'],
        nextSteps: [
          'Realice el pago utilizando la referencia proporcionada.',
          'Guarde su comprobante de pago (captura de pantalla, etc.).',
          'Una vez verificado el pago, su permiso estará disponible para descargar.',
        ],
      },
    });
  }),

  updateApplication: vi
    .fn()
    .mockImplementation((id: string, applicationData: Partial<Application>) => {
      const application = mockApplications.find((app) => app.id === id);

      if (!application) {
        return Promise.resolve({
          success: false,
          application: {} as Application,
          message: 'Application not found',
        });
      }

      if (application.status !== 'AWAITING_OXXO_PAYMENT') {
        return Promise.resolve({
          success: false,
          application,
          message: `Cannot update application in ${application.status} status`,
        });
      }

      const updatedApplication = {
        ...application,
        ...applicationData,
        updated_at: new Date().toISOString(),
      };

      return Promise.resolve({
        success: true,
        application: updatedApplication,
        message: 'Application updated successfully',
      });
    }),

  uploadPaymentProof: vi
    .fn()
    .mockImplementation((id: string, file: File, paymentReference?: string) => {
      const application = mockApplications.find((app) => app.id === id);

      if (!application) {
        return Promise.resolve({
          success: false,
          application: {} as Application,
          message: 'Application not found',
        });
      }

      if (application.status !== 'AWAITING_OXXO_PAYMENT' && application.status !== 'PAYMENT_FAILED') {
        return Promise.resolve({
          success: false,
          application,
          message: `Cannot upload payment proof in ${application.status} status`,
        });
      }

      const now = new Date().toISOString();

      const updatedApplication = {
        ...application,
        status: 'PROOF_SUBMITTED' as ApplicationStatus,
        payment_proof_path: URL.createObjectURL(file),
        payment_reference: paymentReference || null,
        payment_proof_uploaded_at: now,
        updated_at: now,
      };

      return Promise.resolve({
        success: true,
        application: updatedApplication,
        message: 'Payment proof uploaded successfully',
      });
    }),

  downloadPermit: vi
    .fn()
    .mockImplementation(
      (id: string, type: 'permiso' | 'certificado' | 'placas' = 'permiso') => {
        const application = mockApplications.find((app) => app.id === id);

        if (!application) {
          return Promise.reject(new Error('Application not found'));
        }

        if (application.status !== 'PERMIT_READY' && application.status !== 'COMPLETED') {
          return Promise.reject(
            new Error(`Cannot download permit in ${application.status} status`),
          );
        }

        // Create a mock PDF blob based on document type
        const typeLabels: Record<string, string> = {
          permiso: 'Permiso',
          certificado: 'Certificado',
          placas: 'Placas',
        };

        const mockPdfContent = `Mock PDF content for ${typeLabels[type] || 'document'} ${id}`;
        const mockBlob = new Blob([mockPdfContent], { type: 'application/pdf' });

        return Promise.resolve(mockBlob);
      },
    ),
};

export default applicationServiceMock;
