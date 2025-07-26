# Components (`frontend/src/components/`)

This directory houses reusable React components that form the building blocks of the Permisos Digitales user interface. Components are organized to promote modularity and reusability.

## Organization

Components are typically grouped by feature or common UI patterns:

- **`auth/`**: Components related to user authentication (e.g., `LoginForm.tsx`, `RegisterForm.tsx`).
- **`dashboard/`**: Components specifically for the user dashboard area.
- **`forms/`**: General form-related components, potentially including multi-step wizard logic.
- **`layout/`**: Structural components like `Footer.tsx`, and parts of `Sidebar` or `Header` if not fully in `layouts/`.
- **`navigation/`**: Navigation elements such as breadcrumbs or specialized menu components.
- **`payment/`**: Components for displaying payment information or embedding payment forms.
- **`permit/`**: Components for displaying permit details, status timelines, etc.
- **`permit-form/`**: Components specifically designed for the steps within the permit application form.
- **`ui/`**: This is a crucial subdirectory containing generic, highly reusable UI elements that are application-agnostic. Examples include:
  - `Button`, `Card`, `Modal`, `Input`, `Select`
  - `DataTable`, `Pagination`, `LoadingSpinner`, `Alert`
  - These components form the core design system or UI kit for the application.

## Best Practices

- **Reusability**: Aim to create components that can be used in multiple places with different props.
- **Props**: Use TypeScript interfaces for defining component props clearly.
- **Styling**: CSS Modules (`*.module.css`) are commonly used for component-level styling to avoid class name collisions. Global styles are in `src/styles/`.
- **Testing**: Components should ideally have corresponding unit/integration tests using React Testing Library, often found in `__tests__` subdirectories or within `src/test/`.
