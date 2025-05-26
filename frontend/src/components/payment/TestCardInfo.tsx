import React, { useState } from 'react';
import { FaCreditCard, FaCopy, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

import styles from './TestCardInfo.module.css';
import Icon from '../../shared/components/ui/Icon';

interface TestCardInfoProps {
  onSelectCard: (
    _cardNumber: string,
    _name: string,
    _expMonth: string,
    _expYear: string,
    _cvc: string,
  ) => void;
}

const TestCardInfo: React.FC<TestCardInfoProps> = ({ onSelectCard }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const testCards = [
    {
      type: 'Visa',
      number: '4242 4242 4242 4242',
      name: 'Test User',
      expMonth: '12',
      expYear: '25',
      cvc: '123',
      description: 'Tarjeta aprobada',
      recommended: true,
    },
    {
      type: 'Mastercard',
      number: '5555 5555 5555 4444',
      name: 'Test User',
      expMonth: '12',
      expYear: '25',
      cvc: '123',
      description: 'Tarjeta aprobada',
      recommended: false,
    },
    {
      type: 'Visa',
      number: '4000 0000 0000 0002',
      name: 'Test User',
      expMonth: '12',
      expYear: '25',
      cvc: '123',
      description: 'Tarjeta rechazada',
      recommended: false,
    },
  ];

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSelectCard = (card: (typeof testCards)[0]) => {
    onSelectCard(card.number.replace(/\s/g, ''), card.name, card.expMonth, card.expYear, card.cvc);
  };

  return (
    <div className={styles.testCardContainer}>
      <div className={styles.testCardHeader}>
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.warningIcon}
          size="lg"
          color="var(--color-warning)"
        />
        <h3>¡IMPORTANTE! Tarjetas de Prueba</h3>
      </div>
      <p className={styles.testCardDescription}>
        <strong>Para pruebas, DEBES usar la tarjeta 4242 4242 4242 4242</strong>. Otras tarjetas
        pueden ser rechazadas. No se realizará ningún cargo real.
      </p>
      <div className={styles.testCardList}>
        {testCards.map((card, index) => (
          <div
            key={index}
            className={`${styles.testCard} ${card.recommended ? styles.recommendedCard : ''}`}
          >
            {card.recommended && (
              <div className={styles.recommendedBadge}>
                <Icon
                  IconComponent={FaExclamationTriangle}
                  size="sm"
                  color="var(--color-warning)"
                />{' '}
                Usar esta tarjeta
              </div>
            )}
            <div className={styles.testCardTop}>
              <div className={styles.testCardType}>
                <Icon IconComponent={FaCreditCard} className={styles.cardIcon} size="md" />
                <span>{card.type}</span>
              </div>
              <div
                className={`${styles.testCardStatus} ${card.recommended ? styles.recommendedStatus : ''}`}
              >
                {card.description}
              </div>
            </div>
            <div className={styles.testCardDetails}>
              <div className={styles.testCardField}>
                <span className={styles.fieldLabel}>Número:</span>
                <div className={styles.fieldValueContainer}>
                  <span className={styles.fieldValue}>{card.number}</span>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => copyToClipboard(card.number, `number-${index}`)}
                    title="Copiar número"
                  >
                    {copied === `number-${index}` ? (
                      <Icon IconComponent={FaCheck} size="sm" color="var(--color-success)" />
                    ) : (
                      <Icon IconComponent={FaCopy} size="sm" />
                    )}
                  </button>
                </div>
              </div>
              <div className={styles.testCardField}>
                <span className={styles.fieldLabel}>Nombre:</span>
                <span className={styles.fieldValue}>{card.name}</span>
              </div>
              <div className={styles.testCardField}>
                <span className={styles.fieldLabel}>Expiración:</span>
                <span className={styles.fieldValue}>
                  {card.expMonth}/{card.expYear}
                </span>
              </div>
              <div className={styles.testCardField}>
                <span className={styles.fieldLabel}>CVC:</span>
                <span className={styles.fieldValue}>{card.cvc}</span>
              </div>
            </div>
            <button
              type="button"
              className={`${styles.useCardButton} ${card.recommended ? styles.recommendedButton : ''}`}
              onClick={() => handleSelectCard(card)}
            >
              {card.recommended ? 'Usar esta tarjeta (Recomendada)' : 'Usar esta tarjeta'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestCardInfo;
