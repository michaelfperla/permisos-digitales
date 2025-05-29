import React from 'react';
import { BsCalendarFill, BsShieldCheck } from 'react-icons/bs';
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaUser,
  FaFileAlt,
  FaDownload,
} from 'react-icons/fa';

import Icon from './Icon';


/**
 * Example component demonstrating various ways to use the Icon component
 * This is for documentation purposes only and not meant to be used in production
 */
const IconExample: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Icon Component Examples</h2>

      <section style={{ marginBottom: '20px' }}>
        <h3>Predefined Sizes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <Icon IconComponent={FaCheckCircle} size="xs" />
            <span style={{ marginLeft: '8px' }}>Extra Small (xs)</span>
          </div>
          <div>
            <Icon IconComponent={FaCheckCircle} size="sm" />
            <span style={{ marginLeft: '8px' }}>Small (sm)</span>
          </div>
          <div>
            <Icon IconComponent={FaCheckCircle} size="md" />
            <span style={{ marginLeft: '8px' }}>Medium (md - default)</span>
          </div>
          <div>
            <Icon IconComponent={FaCheckCircle} size="lg" />
            <span style={{ marginLeft: '8px' }}>Large (lg)</span>
          </div>
          <div>
            <Icon IconComponent={FaCheckCircle} size="xl" />
            <span style={{ marginLeft: '8px' }}>Extra Large (xl)</span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Custom Sizes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <Icon IconComponent={FaUser} size="1.75rem" />
            <span style={{ marginLeft: '8px' }}>1.75rem</span>
          </div>
          <div>
            <Icon IconComponent={FaUser} size="24px" />
            <span style={{ marginLeft: '8px' }}>24px</span>
          </div>
          <div>
            <Icon IconComponent={FaUser} size="2em" />
            <span style={{ marginLeft: '8px' }}>2em</span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Colors</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <Icon IconComponent={FaExclamationCircle} color="var(--color-primary)" size="lg" />
            <span style={{ marginLeft: '8px' }}>Primary</span>
          </div>
          <div>
            <Icon IconComponent={FaCheckCircle} color="var(--color-success)" size="lg" />
            <span style={{ marginLeft: '8px' }}>Éxito</span>
          </div>
          <div>
            <Icon IconComponent={FaExclamationTriangle} color="var(--color-warning)" size="lg" />
            <span style={{ marginLeft: '8px' }}>Warning</span>
          </div>
          <div>
            <Icon IconComponent={FaInfoCircle} color="var(--color-info)" size="lg" />
            <span style={{ marginLeft: '8px' }}>Info</span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Different Icon Libraries</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <Icon IconComponent={FaFileAlt} size="lg" />
            <span style={{ marginLeft: '8px' }}>FaFileAlt (react-icons/fa)</span>
          </div>
          <div>
            <Icon IconComponent={BsCalendarFill} size="lg" />
            <span style={{ marginLeft: '8px' }}>BsCalendarFill (react-icons/bs)</span>
          </div>
          <div>
            <Icon IconComponent={BsShieldCheck} size="lg" />
            <span style={{ marginLeft: '8px' }}>BsShieldCheck (react-icons/bs)</span>
          </div>
        </div>
      </section>

      <section>
        <h3>Accessibility Examples</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <Icon
              IconComponent={FaDownload}
              size="lg"
              decorative={false}
              ariaLabel="Download file"
            />
            <span style={{ marginLeft: '8px' }}>Non-decorative with aria-label</span>
          </div>
          <div>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <Icon IconComponent={FaDownload} size="lg" />
              <span>Download</span>
            </button>
            <span style={{ marginLeft: '8px' }}>Decorative (with text)</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default IconExample;
