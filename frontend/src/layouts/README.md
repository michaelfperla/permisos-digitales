# Layouts (`frontend/src/layouts/`)

This directory contains layout components for the Permisos Digitales frontend. Layout components are responsible for defining the common structure of different types of pages in the application, such as headers, footers, sidebars, and content areas.

## Role

- Provide a consistent visual structure across multiple pages.
- Reduce boilerplate in individual page components by handling common structural elements.
- Often used in conjunction with `react-router-dom` to wrap page content.

## Key Layouts (Examples)

Based on the file listing, common layouts include:

- **`MainLayout.tsx`**: The standard layout for most authenticated user pages, likely including a header, sidebar/navigation, and a main content area.
- **`AuthLayout.tsx`**: A simpler layout used for authentication pages (e.g., Login, Register, Forgot Password), often centered with minimal navigation.
- **`HomeLayout.tsx`**: Potentially a specific layout for the main landing page or dashboard, which might differ slightly from the `MainLayout`.
- **`UserLayout.tsx`**: Could be a variation of `MainLayout` or a specific layout for user profile sections.
- **`VerificationLayout.tsx`**: A layout for pages related to email verification or other verification processes.

The admin portal (`frontend/src/admin/layouts/`) will have its own set of layout components (e.g., `AdminLayout.tsx`).

## Usage

Layout components typically accept `children` props, which represent the content of the specific page to be rendered within the layout's structure.

```typescript
// Conceptual: In a routing setup (e.g., App.tsx)
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<MainLayout><DashboardPage /></MainLayout>} />
      <Route path="/profile" element={<MainLayout><ProfilePage /></MainLayout>} />
      {/* ... other routes */}
    </Routes>
  );
}
```

This approach ensures that pages like `DashboardPage` and `ProfilePage` don't need to repeat the common header/footer/sidebar structure.
