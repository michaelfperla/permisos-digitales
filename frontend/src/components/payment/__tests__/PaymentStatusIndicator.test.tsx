import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '../../ui/StatusBadge/StatusBadge';
import { ApplicationStatus } from '../../../services/applicationService';

describe('PaymentStatusIndicator (StatusBadge)', () => {
  it('should render payment pending status correctly', () => {
    render(<StatusBadge status="AWAITING_PAYMENT" />);
    
    expect(screen.getByText('Pendiente de Pago')).toBeInTheDocument();
    const badge = screen.getByText('Pendiente de Pago');
    expect(badge).toHaveClass('statusBadge', 'statusActionNeeded');
  });

  it('should render OXXO payment pending status correctly', () => {
    render(<StatusBadge status="AWAITING_OXXO_PAYMENT" />);
    
    expect(screen.getByText('Pendiente de Pago (OXXO)')).toBeInTheDocument();
    const badge = screen.getByText('Pendiente de Pago (OXXO)');
    expect(badge).toHaveClass('statusBadge', 'statusActionNeeded');
  });

  it('should render payment processing status correctly', () => {
    render(<StatusBadge status="PAYMENT_PROCESSING" />);
    
    expect(screen.getByText('Pago en Proceso')).toBeInTheDocument();
    const badge = screen.getByText('Pago en Proceso');
    expect(badge).toHaveClass('statusBadge', 'statusPending');
  });

  it('should render payment failed status correctly', () => {
    render(<StatusBadge status="PAYMENT_FAILED" />);
    
    expect(screen.getByText('Pago Fallido')).toBeInTheDocument();
    const badge = screen.getByText('Pago Fallido');
    expect(badge).toHaveClass('statusBadge', 'statusRejected');
  });

  it('should render payment received status correctly', () => {
    render(<StatusBadge status="PAYMENT_RECEIVED" />);
    
    expect(screen.getByText('Pago Recibido')).toBeInTheDocument();
    const badge = screen.getByText('Pago Recibido');
    expect(badge).toHaveClass('statusBadge', 'statusApproved');
  });

  it('should render permit generation status correctly', () => {
    render(<StatusBadge status="GENERATING_PERMIT" />);
    
    expect(screen.getByText('Generando Permiso')).toBeInTheDocument();
    const badge = screen.getByText('Generando Permiso');
    expect(badge).toHaveClass('statusBadge', 'statusPending');
  });

  it('should render permit generation error status correctly', () => {
    render(<StatusBadge status="ERROR_GENERATING_PERMIT" />);
    
    expect(screen.getByText('Error al Generar')).toBeInTheDocument();
    const badge = screen.getByText('Error al Generar');
    expect(badge).toHaveClass('statusBadge', 'statusRejected');
  });

  it('should render permit ready status correctly', () => {
    render(<StatusBadge status="PERMIT_READY" />);
    
    expect(screen.getByText('Permiso Listo')).toBeInTheDocument();
    const badge = screen.getByText('Permiso Listo');
    expect(badge).toHaveClass('statusBadge', 'statusApproved');
  });

  it('should render completed status correctly', () => {
    render(<StatusBadge status="COMPLETED" />);
    
    expect(screen.getByText('Completado')).toBeInTheDocument();
    const badge = screen.getByText('Completado');
    expect(badge).toHaveClass('statusBadge', 'statusApproved');
  });

  it('should render cancelled status correctly', () => {
    render(<StatusBadge status="CANCELLED" />);
    
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    const badge = screen.getByText('Cancelado');
    expect(badge).toHaveClass('statusBadge', 'statusRejected');
  });

  it('should render expired status correctly', () => {
    render(<StatusBadge status="EXPIRED" />);
    
    expect(screen.getByText('Expirado')).toBeInTheDocument();
    const badge = screen.getByText('Expirado');
    expect(badge).toHaveClass('statusBadge', 'statusWarning');
  });

  it('should render renewal statuses correctly', () => {
    render(<StatusBadge status="RENEWAL_PENDING" />);
    expect(screen.getByText('Renovación Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Renovación Pendiente')).toHaveClass('statusBadge', 'statusWarning');

    render(<StatusBadge status="RENEWAL_APPROVED" />);
    expect(screen.getByText('Renovación Aprobada')).toBeInTheDocument();
    expect(screen.getByText('Renovación Aprobada')).toHaveClass('statusBadge', 'statusApproved');

    render(<StatusBadge status="RENEWAL_REJECTED" />);
    expect(screen.getByText('Renovación Rechazada')).toBeInTheDocument();
    expect(screen.getByText('Renovación Rechazada')).toHaveClass('statusBadge', 'statusRejected');
  });

  it('should handle unknown status gracefully', () => {
    const unknownStatus = 'UNKNOWN_STATUS' as ApplicationStatus;
    render(<StatusBadge status={unknownStatus} />);
    
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
    const badge = screen.getByText('UNKNOWN_STATUS');
    expect(badge).toHaveClass('statusBadge', 'statusPending');
  });

  it('should render with large size when specified', () => {
    render(<StatusBadge status="PAYMENT_RECEIVED" size="large" />);
    
    const badge = screen.getByText('Pago Recibido');
    expect(badge).toHaveClass('statusBadge', 'statusApproved', 'statusBadgeLarge');
  });

  it('should render with default size when not specified', () => {
    render(<StatusBadge status="PAYMENT_RECEIVED" />);
    
    const badge = screen.getByText('Pago Recibido');
    expect(badge).toHaveClass('statusBadge', 'statusApproved');
    expect(badge).not.toHaveClass('statusBadgeLarge');
  });

  it('should apply custom className when provided', () => {
    render(<StatusBadge status="PAYMENT_RECEIVED" className="custom-class" />);
    
    const badge = screen.getByText('Pago Recibido');
    expect(badge).toHaveClass('statusBadge', 'statusApproved', 'custom-class');
  });

  it('should apply correct styling for all payment-related statuses', () => {
    const paymentStatuses: Array<{ status: ApplicationStatus; expectedClass: string }> = [
      { status: 'AWAITING_PAYMENT', expectedClass: 'statusActionNeeded' },
      { status: 'AWAITING_OXXO_PAYMENT', expectedClass: 'statusActionNeeded' },
      { status: 'PAYMENT_PROCESSING', expectedClass: 'statusPending' },
      { status: 'PAYMENT_FAILED', expectedClass: 'statusRejected' },
      { status: 'PAYMENT_RECEIVED', expectedClass: 'statusApproved' },
    ];

    paymentStatuses.forEach(({ status, expectedClass }) => {
      const { unmount } = render(<StatusBadge status={status} />);
      
      const badge = screen.getByText(/pago/i);
      expect(badge).toHaveClass('statusBadge', expectedClass);
      
      unmount();
    });
  });

  it('should group statuses by visual appearance correctly', () => {
    // Action needed (orange/yellow)
    const actionNeededStatuses = ['AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT'] as ApplicationStatus[];
    actionNeededStatuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = screen.getByText(/pendiente/i);
      expect(badge).toHaveClass('statusActionNeeded');
      unmount();
    });

    // Rejected (red)
    const rejectedStatuses = ['PAYMENT_FAILED', 'ERROR_GENERATING_PERMIT', 'CANCELLED', 'RENEWAL_REJECTED'] as ApplicationStatus[];
    rejectedStatuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = document.querySelector('.statusRejected');
      expect(badge).toBeInTheDocument();
      unmount();
    });

    // Approved (green)
    const approvedStatuses = ['PAYMENT_RECEIVED', 'PERMIT_READY', 'COMPLETED', 'RENEWAL_APPROVED'] as ApplicationStatus[];
    approvedStatuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = document.querySelector('.statusApproved');
      expect(badge).toBeInTheDocument();
      unmount();
    });

    // Pending (blue)
    const pendingStatuses = ['PAYMENT_PROCESSING', 'GENERATING_PERMIT'] as ApplicationStatus[];
    pendingStatuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = document.querySelector('.statusPending');
      expect(badge).toBeInTheDocument();
      unmount();
    });

    // Warning (amber)
    const warningStatuses = ['EXPIRED', 'RENEWAL_PENDING'] as ApplicationStatus[];
    warningStatuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = document.querySelector('.statusWarning');
      expect(badge).toBeInTheDocument();
      unmount();
    });
  });

  it('should maintain consistent text content for payment flow', () => {
    // Test the complete payment flow statuses
    const paymentFlow = [
      { status: 'AWAITING_PAYMENT' as ApplicationStatus, text: 'Pendiente de Pago' },
      { status: 'PAYMENT_PROCESSING' as ApplicationStatus, text: 'Pago en Proceso' },
      { status: 'PAYMENT_RECEIVED' as ApplicationStatus, text: 'Pago Recibido' },
      { status: 'GENERATING_PERMIT' as ApplicationStatus, text: 'Generando Permiso' },
      { status: 'PERMIT_READY' as ApplicationStatus, text: 'Permiso Listo' },
      { status: 'COMPLETED' as ApplicationStatus, text: 'Completado' },
    ];

    paymentFlow.forEach(({ status, text }) => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(text)).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle OXXO-specific payment flow', () => {
    const oxxoFlow = [
      { status: 'AWAITING_OXXO_PAYMENT' as ApplicationStatus, text: 'Pendiente de Pago (OXXO)' },
      { status: 'PAYMENT_RECEIVED' as ApplicationStatus, text: 'Pago Recibido' },
    ];

    oxxoFlow.forEach(({ status, text }) => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(text)).toBeInTheDocument();
      const badge = screen.getByText(text);
      expect(badge).toHaveClass('statusBadge');
      unmount();
    });
  });
});