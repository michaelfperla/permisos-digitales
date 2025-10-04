import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FaExclamationTriangle, FaRedo, FaHome } from 'react-icons/fa';

import Button from '../../components/ui/Button/Button';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

/**
 * Professional Error Boundary for Admin Portal
 * Prevents crashes and provides recovery options
 */
class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `admin-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with context
    logger.error('Admin Portal Error Boundary caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service (if available)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          section: 'admin-portal',
          errorId: this.state.errorId
        }
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: '' });
  };

  handleGoHome = () => {
    window.location.href = '/admin/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Professional error UI
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'white',
            borderRadius: '12px',
            padding: '3rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #a72b31, #852023)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem'
            }}>
              <FaExclamationTriangle 
                size={32} 
                color="white" 
              />
            </div>

            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#343a40',
              marginBottom: '1rem'
            }}>
              Error en el Portal Administrativo
            </h1>

            <p style={{
              color: '#6c757d',
              marginBottom: '0.5rem',
              lineHeight: '1.5'
            }}>
              Ha ocurrido un error inesperado. Nuestro equipo técnico ha sido notificado automáticamente.
            </p>

            <p style={{
              color: '#9ca3af',
              fontSize: '0.875rem',
              marginBottom: '2rem',
              fontFamily: 'monospace'
            }}>
              ID del Error: {this.state.errorId}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                textAlign: 'left',
                marginBottom: '2rem',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
                  Detalles del Error (Solo en Desarrollo)
                </summary>
                <pre style={{
                  marginTop: '1rem',
                  whiteSpace: 'pre-wrap',
                  color: '#dc3545'
                }}>
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <Button
                variant="primary"
                onClick={this.handleRetry}
                style={{
                  background: 'linear-gradient(135deg, #a72b31, #852023)',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FaRedo size={14} />
                Intentar Nuevamente
              </Button>

              <Button
                variant="secondary"
                onClick={this.handleGoHome}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FaHome size={14} />
                Ir al Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;