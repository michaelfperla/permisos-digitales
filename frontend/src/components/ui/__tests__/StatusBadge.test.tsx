import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ApplicationStatus } from '../../services/applicationService';
import StatusBadge from '../StatusBadge';

describe('StatusBadge Component', () => {
  it('should render PENDING_PAYMENT status correctly', () => {
    render(<StatusBadge status="PENDING_PAYMENT" />);
    expect(screen.getByText('Falta pagar')).toBeInTheDocument();
  });

  it('should render PROOF_SUBMITTED status correctly', () => {
    render(<StatusBadge status="PROOF_SUBMITTED" />);
    expect(screen.getByText('Comprobante enviado')).toBeInTheDocument();
  });

  it('should render PROOF_REJECTED status correctly', () => {
    render(<StatusBadge status="PROOF_REJECTED" />);
    expect(screen.getByText('Comprobante rechazado')).toBeInTheDocument();
  });

  it('should render PERMIT_READY status correctly', () => {
    render(<StatusBadge status="PERMIT_READY" />);
    expect(screen.getByText('Permiso listo')).toBeInTheDocument();
  });

  it('should render COMPLETED status correctly', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completado')).toBeInTheDocument();
  });

  it('should render EXPIRED status correctly', () => {
    render(<StatusBadge status="EXPIRED" />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('should render unknown status as is', () => {
    const unknownStatus = 'UNKNOWN_STATUS' as ApplicationStatus;
    render(<StatusBadge status={unknownStatus} />);
    expect(screen.getByText(unknownStatus)).toBeInTheDocument();
  });
});
