import React, { useState } from 'react';
import styles from './Accordion.module.css';

export interface AccordionItem {
  id: string;
  title: string;
  content: string | React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
  allowMultiple?: boolean;
}

const Accordion: React.FC<AccordionProps> = ({ items, defaultOpenId, allowMultiple = false }) => {
  const [openItems, setOpenItems] = useState<string[]>(defaultOpenId ? [defaultOpenId] : []);

  const toggleItem = (itemId: string) => {
    if (allowMultiple) {
      setOpenItems(prev =>
        prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
      );
    } else {
      setOpenItems(prev => (prev.includes(itemId) ? [] : [itemId]));
    }
  };

  return (
    <div className={styles.accordionContainer}>
      {items.map(item => {
        const isOpen = openItems.includes(item.id);
        
        return (
          <div key={item.id} className={styles.accordionItem}>
            <button
              className={styles.accordionButton}
              onClick={() => toggleItem(item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
            >
              <span className={styles.accordionTitle}>{item.title}</span>
              <span className={styles.accordionIcon}>
                {isOpen ? '−' : '+'}
              </span>
            </button>
            <div
              id={`accordion-panel-${item.id}`}
              className={`${styles.accordionPanel} ${isOpen ? styles.accordionPanelOpen : ''}`}
              aria-hidden={!isOpen}
            >
              <div className={styles.accordionContent}>{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;