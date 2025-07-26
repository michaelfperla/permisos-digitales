import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import Button from '../ui/Button/Button';
import Icon from '../../shared/components/ui/Icon';
import { logger } from '../../utils/logger';
import styles from './SecurePaymentElement.module.css';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class PaymentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Payment component error:', { error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <Icon IconComponent={FaExclamationTriangle} className={styles.errorIcon} size="md" />
          <div>
            <p className={styles.errorMessage}>
              Error al cargar el sistema de pagos. Por favor, intenta de nuevo.
            </p>
            <Button
              variant="secondary"
              size="small"
              onClick={this.handleRetry}
              style={{ marginTop: '12px' }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PaymentErrorBoundary;