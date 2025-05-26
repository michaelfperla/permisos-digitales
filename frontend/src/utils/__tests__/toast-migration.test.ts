import { describe, it, expect, vi } from 'vitest';

import { ToastType } from '../../components/ui/Toast';
import { showToastCompat } from '../toast-migration';

describe('toast-migration utility', () => {
  it('ignores duration when provided as a number', () => {
    const mockShowToast = vi.fn();
    const message = 'Test message';
    const type: ToastType = 'success';
    const duration = 10000;

    showToastCompat(mockShowToast, message, type, duration);

    // The showToast function should have been called with the message and type only
    expect(mockShowToast).toHaveBeenCalledWith(message, type);

    // It should not pass any options object with duration
    expect(mockShowToast).not.toHaveBeenCalledWith(message, type, { duration });
  });

  it('extracts only the action from options object and ignores duration', () => {
    const mockShowToast = vi.fn();
    const message = 'Test message';
    const type: ToastType = 'success';
    const mockAction = {
      label: 'Action',
      onClick: vi.fn(),
    };
    const options = {
      duration: 10000,
      action: mockAction,
    };

    showToastCompat(mockShowToast, message, type, options);

    // The showToast function should have been called with the message, type, and action only
    expect(mockShowToast).toHaveBeenCalledWith(message, type, { action: mockAction });

    // It should not pass the duration
    expect(mockShowToast).not.toHaveBeenCalledWith(message, type, options);
  });

  it('handles undefined options correctly', () => {
    const mockShowToast = vi.fn();
    const message = 'Test message';
    const type: ToastType = 'success';

    showToastCompat(mockShowToast, message, type);

    // The showToast function should have been called with the message and type only
    expect(mockShowToast).toHaveBeenCalledWith(message, type);
  });

  it('handles null options correctly', () => {
    const mockShowToast = vi.fn();
    const message = 'Test message';
    const type: ToastType = 'success';

    // @ts-ignore - Testing runtime behavior with null
    showToastCompat(mockShowToast, message, type, null);

    // The showToast function should have been called with the message and type only
    expect(mockShowToast).toHaveBeenCalledWith(message, type);
  });

  it('handles options with only action correctly', () => {
    const mockShowToast = vi.fn();
    const message = 'Test message';
    const type: ToastType = 'success';
    const mockAction = {
      label: 'Action',
      onClick: vi.fn(),
    };
    const options = {
      action: mockAction,
    };

    showToastCompat(mockShowToast, message, type, options);

    // The showToast function should have been called with the message, type, and action
    expect(mockShowToast).toHaveBeenCalledWith(message, type, { action: mockAction });
  });
});
