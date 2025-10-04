import React from 'react';
import { FaSpinner, FaShieldAlt } from 'react-icons/fa';

interface AdminLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  overlay?: boolean;
  variant?: 'default' | 'branded' | 'minimal';
}

/**
 * Professional loading spinner for admin portal
 * Provides consistent loading states with brand colors
 */
const AdminLoadingSpinner: React.FC<AdminLoadingSpinnerProps> = ({
  size = 'md',
  message = 'Cargando...',
  overlay = false,
  variant = 'default'
}) => {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: 'spinner-md', 
    lg: 'spinner-lg',
    xl: 'spinner-xl'
  };

  const renderSpinner = () => {
    if (variant === 'branded') {
      return (
        <div className={`admin-spinner branded ${sizeClasses[size]}`}>
          <div className="brand-ring">
            <FaShieldAlt className="shield-icon" />
          </div>
          {message && <p className="loading-message">{message}</p>}
        </div>
      );
    }

    if (variant === 'minimal') {
      return (
        <div className={`admin-spinner minimal ${sizeClasses[size]}`}>
          <div className="minimal-dots">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
          {message && <p className="loading-message">{message}</p>}
        </div>
      );
    }

    // Default variant
    return (
      <div className={`admin-spinner default ${sizeClasses[size]}`}>
        <FaSpinner className="spinner-icon" />
        {message && <p className="loading-message">{message}</p>}
      </div>
    );
  };

  const content = renderSpinner();

  if (overlay) {
    return (
      <div className="loading-overlay">
        {content}
        <style jsx>{`
          .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(248, 249, 250, 0.9);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {content}
      <style jsx>{`
        .admin-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .admin-spinner.default .spinner-icon {
          color: #a72b31;
          animation: spin 1s linear infinite;
        }

        .admin-spinner.branded {
          position: relative;
        }

        .brand-ring {
          width: 60px;
          height: 60px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #a72b31;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .shield-icon {
          color: #a72b31;
          font-size: 1.5rem;
          position: absolute;
        }

        .minimal-dots {
          display: flex;
          gap: 0.5rem;
        }

        .minimal-dots .dot {
          width: 8px;
          height: 8px;
          background: #a72b31;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite both;
        }

        .minimal-dots .dot:nth-child(1) { animation-delay: -0.32s; }
        .minimal-dots .dot:nth-child(2) { animation-delay: -0.16s; }

        .loading-message {
          margin-top: 1rem;
          color: #6c757d;
          font-size: 0.875rem;
          font-weight: 500;
          text-align: center;
        }

        /* Size variants */
        .spinner-sm .spinner-icon { font-size: 1rem; }
        .spinner-sm .brand-ring { width: 32px; height: 32px; }
        .spinner-sm .shield-icon { font-size: 0.75rem; }
        .spinner-sm .loading-message { font-size: 0.75rem; margin-top: 0.5rem; }

        .spinner-md .spinner-icon { font-size: 1.5rem; }
        .spinner-md .brand-ring { width: 48px; height: 48px; }
        .spinner-md .shield-icon { font-size: 1rem; }
        
        .spinner-lg .spinner-icon { font-size: 2rem; }
        .spinner-lg .brand-ring { width: 64px; height: 64px; }
        .spinner-lg .shield-icon { font-size: 1.5rem; }
        .spinner-lg .loading-message { font-size: 1rem; }

        .spinner-xl .spinner-icon { font-size: 3rem; }
        .spinner-xl .brand-ring { width: 80px; height: 80px; border-width: 4px; }
        .spinner-xl .shield-icon { font-size: 2rem; }
        .spinner-xl .loading-message { font-size: 1.125rem; margin-top: 1.5rem; }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          } 40% {
            transform: scale(1);
          }
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .admin-spinner {
            padding: 1rem;
          }
          
          .loading-message {
            font-size: 0.8125rem;
          }
        }
      `}</style>
    </>
  );
};

export default AdminLoadingSpinner;