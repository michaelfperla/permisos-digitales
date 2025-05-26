import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import SuccessStep from '../SuccessStep';

describe('SuccessStep', () => {
  it('renders with application ID and without payment instructions', () => {
    render(
      <BrowserRouter>
        <SuccessStep applicationId="TEST123" />
      </BrowserRouter>,
    );

    expect(screen.getByText(/Solicitud Enviada Exitosamente/i)).toBeInTheDocument();
    // Use a more specific selector for the application ID
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === 'p' &&
          content.includes('TEST123') &&
          element.textContent?.includes('Número de Solicitud')
        );
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$1,500.00 MXN/)).toBeInTheDocument();
  });

  it('renders with payment instructions including currency', () => {
    const paymentInstructions = {
      amount: 1500,
      currency: 'MXN',
      reference: 'REF123',
      paymentMethods: ['Transferencia Bancaria', 'Pago en Línea'],
      nextSteps: ['Realice el pago', 'Guarde su comprobante'],
    };

    render(
      <BrowserRouter>
        <SuccessStep applicationId="TEST123" paymentInstructions={paymentInstructions} />
      </BrowserRouter>,
    );

    expect(screen.getByText(/Solicitud Enviada Exitosamente/i)).toBeInTheDocument();
    expect(screen.getByText(/TEST123/)).toBeInTheDocument();
    expect(screen.getByText(/REF123/)).toBeInTheDocument();
    expect(screen.getByText(/Transferencia Bancaria/)).toBeInTheDocument();
    expect(screen.getByText(/Pago en Línea/)).toBeInTheDocument();
    expect(screen.getByText(/Realice el pago/)).toBeInTheDocument();
    expect(screen.getByText(/Guarde su comprobante/)).toBeInTheDocument();
  });

  it('renders with payment instructions but missing currency (should use MXN as default)', () => {
    const paymentInstructions = {
      amount: 1500,
      currency: '', // Empty currency
      reference: 'REF123',
      paymentMethods: ['Transferencia Bancaria'],
      nextSteps: ['Realice el pago'],
    };

    render(
      <BrowserRouter>
        <SuccessStep applicationId="TEST123" paymentInstructions={paymentInstructions} />
      </BrowserRouter>,
    );

    // Should still render without errors
    expect(screen.getByText(/Solicitud Enviada Exitosamente/i)).toBeInTheDocument();
    // Should format the amount with default MXN currency
    const amountText = screen.getByText(/\$1,500.00/);
    expect(amountText).toBeInTheDocument();
  });

  it('renders with payment instructions with undefined currency (should use MXN as default)', () => {
    const paymentInstructions = {
      amount: 1500,
      currency: undefined as unknown as string, // Undefined currency
      reference: 'REF123',
      paymentMethods: ['Transferencia Bancaria'],
      nextSteps: ['Realice el pago'],
    };

    render(
      <BrowserRouter>
        <SuccessStep applicationId="TEST123" paymentInstructions={paymentInstructions} />
      </BrowserRouter>,
    );

    // Should still render without errors
    expect(screen.getByText(/Solicitud Enviada Exitosamente/i)).toBeInTheDocument();
    // Should format the amount with default MXN currency
    const amountText = screen.getByText(/\$1,500.00/);
    expect(amountText).toBeInTheDocument();
  });
});
