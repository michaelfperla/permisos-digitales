# Pages (`frontend/src/pages/`)

This directory contains top-level React components that represent the different views or "pages" of the Permisos Digitales application. Each page component typically corresponds to a specific URL route.

## Role

- Assemble various layout and shared components to create a complete view.
- Fetch page-specific data using services and hooks (often via React Query).
- Handle user interactions and page-level state.
- Define the primary content displayed for a given route.

## Key Pages (Examples)

- **`HomePage.tsx`**: The landing page or initial dashboard for logged-in users.
- **`LoginPage.tsx`**, **`RegisterPage.tsx`**: User authentication pages.
- **`ForgotPasswordPage.tsx`**, **`ResetPasswordPage.tsx`**: Password recovery flow.
- **`CompletePermitFormPage.tsx`**: The main page housing the multi-step permit application form.
- **`PermitsListPage.tsx`**: Displays a list of the user's permits.
- **`PermitDetailsPage.tsx`**: Shows detailed information about a specific permit.
- **`PermitRenewalPage.tsx`**: Handles the permit renewal process.
- **`PaymentUploadPage.tsx`**, **`PaymentSuccessPage.tsx`**, **`PaymentErrorPage.tsx`**: Pages involved in the payment and proof upload flow.
- **`ProfilePage.tsx`**: Allows users to view and edit their profile information.
- **`VerifyEmailPage.tsx`**, **`ResendVerificationPage.tsx`**: Email verification flow.

Page components are typically routed via `react-router-dom` configuration, often found in or imported into `App.tsx`.
