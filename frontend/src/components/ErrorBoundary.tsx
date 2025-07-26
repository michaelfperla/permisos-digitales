import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to monitoring service
    logger.error('Error caught by boundary:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--color-neutral-50, #f8f9fa)',
          borderRadius: '8px',
          margin: '2rem',
          border: '1px solid var(--color-neutral-200, #dee2e6)'
        }}>
          <h2 style={{ 
            color: 'var(--color-neutral-900, #212529)',
            marginBottom: '1rem',
            fontSize: '1.5rem'
          }}>
            Algo salió mal
          </h2>
          <p style={{ 
            color: 'var(--color-neutral-600, #6c757d)',
            marginBottom: '2rem',
            maxWidth: '400px'
          }}>
            Ha ocurrido un error inesperado. Por favor, intenta recargar la página o regresa al inicio.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: 'var(--color-primary, #a72b31)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              Recargar Página
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-primary, #a72b31)',
                border: '1px solid var(--color-primary, #a72b31)',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;