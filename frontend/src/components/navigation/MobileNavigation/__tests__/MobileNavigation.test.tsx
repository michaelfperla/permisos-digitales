import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MobileNavigation from '../MobileNavigation';

// Mock dependencies
const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard' }),
  };
});

vi.mock('../../../shared/hooks/useAuth', () => ({
  useUserAuth: () => ({
    user: {
      first_name: 'Juan',
      last_name: 'Pérez',
      email: 'juan@example.com',
    },
    logout: mockLogout,
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MobileNavigation', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Cleanup
    document.body.style.overflow = '';
  });

  describe('Bottom Navigation', () => {
    it('should render bottom navigation for authenticated users', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /inicio/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /mis permisos/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /nuevo permiso/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /mi perfil/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    });

    it('should render bottom navigation for unauthenticated users', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={false} type="bottom" />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /inicio/i })).toBeInTheDocument();
      
      // Should not show authenticated-only items
      expect(screen.queryByRole('link', { name: /mis permisos/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
    });

    it('should navigate to correct routes when links are clicked', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const homeLink = screen.getByRole('link', { name: /inicio/i });
      const permitsLink = screen.getByRole('link', { name: /mis permisos/i });
      const newPermitLink = screen.getByRole('link', { name: /nuevo permiso/i });
      const profileLink = screen.getByRole('link', { name: /mi perfil/i });

      expect(homeLink).toHaveAttribute('href', '/dashboard');
      expect(permitsLink).toHaveAttribute('href', '/permits');
      expect(newPermitLink).toHaveAttribute('href', '/permits/complete');
      expect(profileLink).toHaveAttribute('href', '/profile');
    });

    it('should handle logout when logout button is clicked', async () => {
      mockLogout.mockResolvedValue(undefined);

      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const logoutButton = screen.getByRole('button', { name: /cerrar sesión/i });
      await user.click(logoutButton);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should apply active styles to current route', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const homeLink = screen.getByRole('link', { name: /inicio/i });
      expect(homeLink).toHaveClass('active');
    });

    it('should have touch-friendly navigation targets', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const navItems = screen.getAllByRole('link');
      navItems.forEach(item => {
        expect(item).toHaveClass('bottomNavItem');
      });

      const logoutButton = screen.getByRole('button', { name: /cerrar sesión/i });
      expect(logoutButton).toHaveClass('bottomNavItem');
    });
  });

  describe('Drawer Navigation', () => {
    it('should render hamburger menu button for drawer type', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
    });

    it('should open drawer when hamburger button is clicked', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      expect(screen.getByRole('navigation')).toHaveClass('open');
      expect(screen.getByRole('button', { name: /close navigation menu/i })).toBeInTheDocument();
    });

    it('should close drawer when close button is clicked', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      // Close drawer
      const closeButton = screen.getByRole('button', { name: /close navigation menu/i });
      await user.click(closeButton);

      expect(screen.getByRole('navigation')).not.toHaveClass('open');
    });

    it('should close drawer when overlay is clicked', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      // Click overlay
      const overlay = document.querySelector('.drawerOverlay');
      expect(overlay).toBeInTheDocument();
      fireEvent.click(overlay!);

      expect(screen.getByRole('navigation')).not.toHaveClass('open');
    });

    it('should close drawer when Escape key is pressed', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.getByRole('navigation')).not.toHaveClass('open');
    });

    it('should prevent body scrolling when drawer is open', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Initially, body should not have overflow hidden
      expect(document.body.style.overflow).toBe('');

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      // Body should have overflow hidden
      expect(document.body.style.overflow).toBe('hidden');

      // Close drawer
      const closeButton = screen.getByRole('button', { name: /close navigation menu/i });
      await user.click(closeButton);

      // Body overflow should be reset
      expect(document.body.style.overflow).toBe('');
    });

    it('should display user information when authenticated', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer to see user info
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(menuButton);

      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    });

    it('should not display user information when not authenticated', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={false} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(menuButton);

      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
      expect(screen.queryByText('juan@example.com')).not.toBeInTheDocument();
    });

    it('should close drawer when navigation link is clicked', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      // Click a navigation link
      const permitsLink = screen.getByRole('link', { name: /mis permisos/i });
      await user.click(permitsLink);

      expect(screen.getByRole('navigation')).not.toHaveClass('open');
    });

    it('should display logout button in drawer footer when authenticated', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      const logoutButton = screen.getByRole('button', { name: /cerrar sesión/i });
      expect(logoutButton).toBeInTheDocument();

      await user.click(logoutButton);
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle route changes by closing drawer', async () => {
      // Mock location change
      const { rerender } = renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      expect(screen.getByRole('navigation')).toHaveClass('open');

      // Simulate route change by re-rendering with new location
      vi.mocked(require('react-router-dom').useLocation).mockReturnValue({ pathname: '/permits' });
      
      rerender(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Drawer should close on route change
      expect(screen.getByRole('navigation')).not.toHaveClass('open');
    });

    it('should apply custom className when provided', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" className="custom-nav" />);

      expect(screen.getByRole('navigation')).toHaveClass('custom-nav');
    });

    it('should handle different home routes based on authentication', () => {
      // Authenticated users
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);
      let homeLink = screen.getByRole('link', { name: /inicio/i });
      expect(homeLink).toHaveAttribute('href', '/dashboard');

      // Unauthenticated users
      renderWithRouter(<MobileNavigation isAuthenticated={false} type="bottom" />);
      homeLink = screen.getByRole('link', { name: /inicio/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute('aria-label', 'Open navigation menu');
    });

    it('should handle keyboard navigation properly', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const firstLink = screen.getByRole('link', { name: /inicio/i });
      
      // Focus should work properly on navigation items
      firstLink.focus();
      expect(firstLink).toHaveFocus();

      // Tab navigation should work
      await user.tab();
      const secondLink = screen.getByRole('link', { name: /mis permisos/i });
      expect(secondLink).toHaveFocus();
    });

    it('should set proper aria-hidden on overlay', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      const overlay = document.querySelector('.drawerOverlay');
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Error Handling', () => {
    it('should handle logout errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLogout.mockRejectedValue(new Error('Logout failed'));

      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const logoutButton = screen.getByRole('button', { name: /cerrar sesión/i });
      await user.click(logoutButton);

      expect(consoleSpy).toHaveBeenCalledWith('Error during logout:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle missing user data gracefully', () => {
      // Mock missing user data
      vi.mocked(require('../../../shared/hooks/useAuth').useUserAuth).mockReturnValue({
        user: null,
        logout: mockLogout,
      });

      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(menuButton);

      // Should not crash and should not show user info
      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
    });
  });

  describe('Touch Interactions', () => {
    it('should support touch interactions on mobile devices', async () => {
      // Mock touch support
      window.ontouchstart = () => {};

      renderWithRouter(<MobileNavigation isAuthenticated={true} type="bottom" />);

      const homeLink = screen.getByRole('link', { name: /inicio/i });
      
      // Simulate touch events
      fireEvent.touchStart(homeLink);
      fireEvent.touchEnd(homeLink);

      expect(homeLink).toBeInTheDocument();
    });

    it('should handle swipe gestures on drawer', async () => {
      renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      // Open drawer
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);

      const drawer = screen.getByRole('navigation');
      
      // Simulate swipe gesture to close
      fireEvent.touchStart(drawer, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(drawer, {
        touches: [{ clientX: 0, clientY: 100 }],
      });

      fireEvent.touchEnd(drawer);

      // Drawer behavior should still be controlled by buttons/overlay
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderWithRouter(<MobileNavigation isAuthenticated={true} type="drawer" />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});