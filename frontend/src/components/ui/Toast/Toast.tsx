import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaTimes
} from 'react-icons/fa';
import styles from './Toast.module.css';
import Button from '../Button/Button';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // Mantenemos como opcional para compatibilidad, pero siempre usaremos 3300ms
  onClose: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Duración fija para todas las notificaciones: 3.3 segundos (3300ms)
const TOAST_DURATION = 3300;

const Toast: React.FC<ToastProps> = memo(({
  id,
  message,
  type,
  duration = TOAST_DURATION, // Siempre usamos 3300ms, ignorando el valor pasado
  onClose,
  action
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingTime, setRemainingTime] = useState(TOAST_DURATION);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const timerRef = useRef<number | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const touchStartXRef = useRef<number>(0);

  // Get icon based on toast type
  const getToastIcon = useCallback(() => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className={styles.icon} />;
      case 'error':
        return <FaExclamationCircle className={styles.icon} />;
      case 'warning':
        return <FaExclamationTriangle className={styles.icon} />;
      case 'info':
      default:
        return <FaInfoCircle className={styles.icon} />;
    }
  }, [type]);

  // Clean up function for all timers
  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  }, []);

  // Handle close button click
  const handleClose = useCallback(() => {
    setIsExiting(true);
    // Clear any existing timers first
    clearAllTimers();
    // Set new animation timer
    animationTimerRef.current = window.setTimeout(() => onClose(id), 300);
  }, [id, onClose, clearAllTimers]);

  // Handle mouse enter - pause the timer
  const handleMouseEnter = useCallback(() => {
    setIsPaused(true);
    // Clear the main timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Calculate remaining time
    const elapsedTime = Date.now() - startTimeRef.current;
    setRemainingTime(Math.max(0, TOAST_DURATION - elapsedTime));
  }, []);

  // Handle mouse leave - resume the timer
  const handleMouseLeave = useCallback(() => {
    if (!isSwiping) {
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // Clear any existing timers first
      clearAllTimers();

      if (remainingTime > 0) {
        timerRef.current = window.setTimeout(() => {
          setIsExiting(true);
          animationTimerRef.current = window.setTimeout(() => onClose(id), 300);
        }, remainingTime);
      }
    }
  }, [remainingTime, id, onClose, clearAllTimers, isSwiping]);

  // Handle touch start - for swipe to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    setIsPaused(true); // Pause timer while touching

    // Clear any existing timers first
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Calculate remaining time
    const elapsedTime = Date.now() - startTimeRef.current;
    setRemainingTime(Math.max(0, TOAST_DURATION - elapsedTime));
  }, []);

  // Handle touch move - track swipe movement
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touchX = e.touches[0].clientX;
      const deltaX = touchX - touchStartXRef.current;

      // Only allow swipe right (positive deltaX)
      if (deltaX > 0) {
        setIsSwiping(true);
        setSwipeOffset(deltaX);
      }
    }
  }, []);

  // Handle touch end - complete swipe if threshold met
  const handleTouchEnd = useCallback(() => {
    const SWIPE_THRESHOLD = 80; // Pixels needed to swipe to dismiss

    if (swipeOffset > SWIPE_THRESHOLD) {
      // Swipe threshold met, dismiss toast
      setIsExiting(true);
      animationTimerRef.current = window.setTimeout(() => onClose(id), 300);
    } else {
      // Reset swipe state
      setIsSwiping(false);
      setSwipeOffset(0);

      // Resume timer
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // Restart timer with remaining time
      if (remainingTime > 0) {
        timerRef.current = window.setTimeout(() => {
          setIsExiting(true);
          animationTimerRef.current = window.setTimeout(() => onClose(id), 300);
        }, remainingTime);
      }
    }
  }, [id, onClose, remainingTime, swipeOffset]);

  // Set up the auto-dismiss timer
  useEffect(() => {
    if (!isPaused && !isSwiping) {
      // Clear any existing timers first
      clearAllTimers();

      startTimeRef.current = Date.now();
      timerRef.current = window.setTimeout(() => {
        setIsExiting(true);
        animationTimerRef.current = window.setTimeout(() => onClose(id), 300);
      }, TOAST_DURATION);
    }

    // Cleanup function
    return clearAllTimers;
  }, [id, onClose, isPaused, clearAllTimers, isSwiping]);

  // Calculate progress percentage
  const progressPercentage = isPaused
    ? (remainingTime / TOAST_DURATION) * 100
    : ((Date.now() - startTimeRef.current) / TOAST_DURATION) * 100;

  // Calculate remaining percentage for progress bar
  const remainingPercentage = 100 - Math.min(progressPercentage, 100);

  // Round for ARIA attribute
  const ariaValueNow = Math.round(remainingPercentage);

  return (
    <div
      className={`${styles.toast} ${styles[type]} ${isExiting ? styles.toastExiting : ''} ${isSwiping ? styles.toastSwiping : ''}`}
      style={isSwiping ? { transform: `translateX(${swipeOffset}px)` } : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className={styles.toastContent}>
        <div className={styles.toastIconContainer} aria-hidden="true">
          {getToastIcon()}
        </div>
        <div className={styles.toastMessage}>{message}</div>
        <Button
          variant="text"
          size="icon"
          onClick={handleClose}
          aria-label="Cerrar notificación"
          className={styles.closeButton}
          icon={<FaTimes />}
        />
      </div>

      {action && (
        <div className={styles.toastAction}>
          <Button
            variant="text"
            size="small"
            onClick={action.onClick}
            aria-label={`${action.label} para esta notificación`}
            className={styles.actionButton}
          >
            {action.label}
          </Button>
        </div>
      )}

      <div
        className={`${styles.progressBar} ${isPaused ? styles.paused : ''}`}
        style={{
          width: `${remainingPercentage}%`
        }}
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={ariaValueNow}
        aria-label="Tiempo restante de la notificación"
      />
    </div>
  );
});

export default Toast;
