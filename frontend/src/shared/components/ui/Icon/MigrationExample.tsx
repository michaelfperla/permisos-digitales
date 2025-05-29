import React from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

import Icon from './Icon';

/**
 * Example showing before and after migration of a component
 * This is for documentation purposes only
 */
const MigrationExample: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Migration Example</h2>

      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          <h3>Before Migration</h3>
          <BeforeMigrationExample />
        </div>

        <div style={{ flex: 1 }}>
          <h3>After Migration</h3>
          <AfterMigrationExample />
        </div>
      </div>
    </div>
  );
};

/**
 * Example component before migration (using direct react-icons)
 */
const BeforeMigrationExample: React.FC = () => {
  return (
    <div>
      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <FaCheckCircle
          style={{
            color: 'var(--color-success)',
            fontSize: '24px',
            marginRight: '12px',
          }}
        />
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Operación Exitosa</h4>
          <p style={{ margin: 0 }}>Sus cambios han sido guardados.</p>
        </div>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <FaTimes style={{ fontSize: '16px', color: '#6c757d' }} />
        </button>
      </div>

      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <FaExclamationCircle
          style={{
            color: 'var(--color-danger)',
            fontSize: '24px',
            marginRight: '12px',
          }}
        />
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Error Ocurrido</h4>
          <p style={{ margin: 0 }}>Por favor intente de nuevo más tarde.</p>
        </div>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <FaTimes style={{ fontSize: '16px', color: '#6c757d' }} />
        </button>
      </div>

      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <FaInfoCircle
          style={{
            color: 'var(--color-info)',
            fontSize: '24px',
            marginRight: '12px',
          }}
        />
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Información</h4>
          <p style={{ margin: 0 }}>Este es un mensaje informativo.</p>
        </div>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <FaTimes style={{ fontSize: '16px', color: '#6c757d' }} />
        </button>
      </div>
    </div>
  );
};

/**
 * Example component after migration (using Icon component)
 */
const AfterMigrationExample: React.FC = () => {
  return (
    <div>
      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Icon
          IconComponent={FaCheckCircle}
          color="var(--color-success)"
          size="24px"
          className="me-3"
        />
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Operación Exitosa</h4>
          <p style={{ margin: 0 }}>Sus cambios han sido guardados.</p>
        </div>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <Icon IconComponent={FaTimes} size="16px" color="#6c757d" />
        </button>
      </div>

      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Icon
          IconComponent={FaExclamationCircle}
          color="var(--color-danger)"
          size="24px"
          className="me-3"
        />
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Error Ocurrido</h4>
          <p style={{ margin: 0 }}>Por favor intente de nuevo más tarde.</p>
        </div>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <Icon IconComponent={FaTimes} size="16px" color="#6c757d" />
        </button>
      </div>

      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Icon
          IconComponent={FaInfoCircle}
          color="var(--color-info)"
          size="24px"
          className="me-3"
        />
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Información</h4>
          <p style={{ margin: 0 }}>Este es un mensaje informativo.</p>
        </div>
        <button
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <Icon IconComponent={FaTimes} size="16px" color="#6c757d" />
        </button>
      </div>
    </div>
  );
};

export default MigrationExample;
