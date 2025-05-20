import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusTimeline from '../StatusTimeline';
import { ApplicationStatus } from '../../services/applicationService';

describe('StatusTimeline Component', () => {
  const mockDates = {
    created_at: '2025-01-15T10:30:00Z',
    payment_proof_uploaded_at: '2025-01-16T09:30:00Z',
    payment_verified_at: '2025-01-17T11:45:00Z',
    fecha_expedicion: '2025-01-18T14:20:00Z'
  };
  
  it('should render PENDING_PAYMENT status correctly', () => {
    render(
      <StatusTimeline 
        currentStatus="PENDING_PAYMENT" 
        applicationDates={mockDates} 
      />
    );
    
    expect(screen.getByText('Pago Pendiente')).toBeInTheDocument();
    expect(screen.getByText(/Solicitud creada, pendiente de pago/i)).toBeInTheDocument();
  });
  
  it('should render PROOF_SUBMITTED status correctly', () => {
    render(
      <StatusTimeline 
        currentStatus="PROOF_SUBMITTED" 
        applicationDates={mockDates} 
      />
    );
    
    expect(screen.getByText('Pago Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Enviado')).toBeInTheDocument();
    expect(screen.getByText(/Comprobante de pago enviado/i)).toBeInTheDocument();
  });
  
  it('should render PAYMENT_RECEIVED status correctly', () => {
    render(
      <StatusTimeline 
        currentStatus="PAYMENT_RECEIVED" 
        applicationDates={mockDates} 
      />
    );
    
    expect(screen.getByText('Pago Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Enviado')).toBeInTheDocument();
    expect(screen.getByText('Pago Recibido')).toBeInTheDocument();
    expect(screen.getByText(/Pago verificado y recibido/i)).toBeInTheDocument();
  });
  
  it('should render PERMIT_READY status correctly', () => {
    render(
      <StatusTimeline 
        currentStatus="PERMIT_READY" 
        applicationDates={mockDates} 
      />
    );
    
    expect(screen.getByText('Pago Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Enviado')).toBeInTheDocument();
    expect(screen.getByText('Pago Recibido')).toBeInTheDocument();
    expect(screen.getByText('Generando Permiso')).toBeInTheDocument();
    expect(screen.getByText('Permiso Listo')).toBeInTheDocument();
    expect(screen.getByText(/Permiso generado y listo para descargar/i)).toBeInTheDocument();
  });
  
  it('should render PROOF_REJECTED status correctly', () => {
    render(
      <StatusTimeline 
        currentStatus="PROOF_REJECTED" 
        applicationDates={{
          ...mockDates,
          payment_proof_uploaded_at: '2025-01-16T09:30:00Z'
        }} 
      />
    );
    
    expect(screen.getByText('Solicitud Creada')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Enviado')).toBeInTheDocument();
    expect(screen.getByText('Comprobante Rechazado')).toBeInTheDocument();
    expect(screen.getByText(/El comprobante de pago fue rechazado/i)).toBeInTheDocument();
  });
  
  it('should render EXPIRED status correctly', () => {
    render(
      <StatusTimeline 
        currentStatus="EXPIRED" 
        applicationDates={{
          ...mockDates,
          fecha_expedicion: '2024-01-18T14:20:00Z'
        }} 
      />
    );
    
    expect(screen.getByText('Permiso Emitido')).toBeInTheDocument();
    expect(screen.getByText('Permiso Expirado')).toBeInTheDocument();
    expect(screen.getByText(/Este permiso ha expirado/i)).toBeInTheDocument();
  });
  
  it('should render unknown status with simplified timeline', () => {
    const unknownStatus = 'UNKNOWN_STATUS' as ApplicationStatus;
    render(
      <StatusTimeline 
        currentStatus={unknownStatus} 
        applicationDates={mockDates} 
      />
    );
    
    expect(screen.getByText('Solicitud Creada')).toBeInTheDocument();
    expect(screen.getByText(unknownStatus)).toBeInTheDocument();
    expect(screen.getByText(/Estado actual de la solicitud/i)).toBeInTheDocument();
  });
});
