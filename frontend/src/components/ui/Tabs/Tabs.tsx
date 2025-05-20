import React, { useState, ReactNode } from 'react';
import styles from './Tabs.module.css';
import Button from '../Button/Button';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultActiveTab?: string;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultActiveTab,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<string>(defaultActiveTab || (tabs.length > 0 ? tabs[0].id : ''));

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <div className={`${styles.tabsContainer} ${className}`}>
      <div className={styles.tabsHeader} role="tablist">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="text"
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => handleTabClick(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            htmlType="button"
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <div className={styles.tabsContent}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.tabPanel} ${activeTab === tab.id ? styles.tabPanelActive : ''}`}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            hidden={activeTab !== tab.id}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
