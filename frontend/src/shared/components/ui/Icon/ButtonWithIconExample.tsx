import React from 'react';
import { FaDownload, FaEdit, FaTrash, FaPlus, FaSearch, FaSignOutAlt } from 'react-icons/fa';

import Icon from './Icon';
import Button from '../../../../components/ui/Button/Button';

/**
 * Example component demonstrating how to use the Icon component with Button
 * This is for documentation purposes only and not meant to be used in production
 */
const ButtonWithIconExample: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Button with Icon Examples</h2>

      <section style={{ marginBottom: '20px' }}>
        <h3>Primary Buttons with Icons</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <Button variant="primary" icon={<Icon IconComponent={FaDownload} />}>
            Download
          </Button>

          <Button variant="primary" icon={<Icon IconComponent={FaEdit} />}>
            Edit
          </Button>

          <Button variant="primary" icon={<Icon IconComponent={FaPlus} />}>
            Add New
          </Button>
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Secondary Buttons with Icons</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <Button variant="secondary" icon={<Icon IconComponent={FaSearch} />}>
            Search
          </Button>

          <Button variant="secondary" icon={<Icon IconComponent={FaEdit} size="sm" />} size="small">
            Edit
          </Button>
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Icon-only Buttons</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <Button
            variant="primary"
            size="icon"
            icon={<Icon IconComponent={FaDownload} />}
            aria-label="Download"
          />

          <Button
            variant="secondary"
            size="icon"
            icon={<Icon IconComponent={FaEdit} />}
            aria-label="Edit"
          />

          <Button
            variant="danger"
            size="icon"
            icon={<Icon IconComponent={FaTrash} />}
            aria-label="Delete"
          />
        </div>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Buttons with Icons After Text</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <Button variant="primary" icon={<Icon IconComponent={FaSignOutAlt} />} iconAfter>
            Sign Out
          </Button>

          <Button variant="secondary" icon={<Icon IconComponent={FaDownload} />} iconAfter>
            Download
          </Button>
        </div>
      </section>

      <section>
        <h3>Different Button Sizes with Icons</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" size="small" icon={<Icon IconComponent={FaPlus} size="sm" />}>
            Small
          </Button>

          <Button variant="primary" icon={<Icon IconComponent={FaPlus} />}>
            Default
          </Button>

          <Button variant="primary" size="large" icon={<Icon IconComponent={FaPlus} size="lg" />}>
            Large
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ButtonWithIconExample;
