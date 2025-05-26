# Frontend Directory Structure

```
frontend/
├── README.md
├── admin.html
├── eslint.config.js
├── index.html
├── package.json
├── public/
│   ├── favicon.svg
│   ├── offline.html
│   └── service-worker.js
├── src/
│   ├── App.tsx
│   ├── README.md
│   ├── admin/
│   │   ├── App.tsx
│   │   ├── README.md
│   │   ├── components/
│   │   │   └── auth/
│   │   ├── contexts/
│   │   │   └── ToastContext.module.css
│   │   ├── hooks/
│   │   ├── layouts/
│   │   │   ├── AdminLayout.module.css
│   │   │   └── AdminLayout.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── ApplicationDetailsPage.module.css
│   │   │   ├── ApplicationDetailsPage.tsx
│   │   │   ├── ApplicationsPage.module.css
│   │   │   ├── ApplicationsPage.tsx
│   │   │   ├── DashboardPage.module.css
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── LoginPage.module.css
│   │   │   ├── LoginPage.tsx
│   │   │   ├── PendingVerificationsPage.module.css
│   │   │   ├── PendingVerificationsPage.tsx
│   │   │   ├── UserDetailsPage.module.css
│   │   │   ├── UserDetailsPage.tsx
│   │   │   ├── UsersPage.module.css
│   │   │   ├── UsersPage.tsx
│   │   │   ├── VerificationHistoryPage.module.css
│   │   │   └── VerificationHistoryPage.tsx
│   │   └── services/
│   │       ├── adminService.ts
│   │       ├── api.ts
│   │       └── authService.ts
│   ├── components/
│   │   ├── Form.module.css
│   │   ├── README.md
│   │   ├── __tests__/
│   │   ├── auth/
│   │   │   ├── ChangePasswordForm.module.css
│   │   │   ├── ChangePasswordForm.tsx
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   ├── Form.module.css
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── RegisterForm.module.css
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── ResetPasswordForm.tsx
│   │   │   └── __tests__/
│   │   ├── dashboard/
│   │   ├── forms/
│   │   │   ├── Form.module.css
│   │   │   ├── FormWizard.module.css
│   │   │   ├── FormWizard.tsx
│   │   │   └── __tests__/
│   │   ├── layout/
│   │   │   ├── Footer.module.css
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar/
│   │   │   └── __tests__/
│   │   ├── mobile/
│   │   │   └── index.ts
│   │   ├── navigation/
│   │   │   ├── AppHeaderMobile/
│   │   │   ├── MobileNavigation/
│   │   │   └── Navigation.module.css
│   │   ├── payment/
│   │   │   ├── OxxoPaymentSlipModal.module.css
│   │   │   ├── OxxoPaymentSlipModal.tsx
│   │   │   ├── TestCardInfo.module.css
│   │   │   └── TestCardInfo.tsx
│   │   ├── permit/
│   │   │   ├── PermitRouteGuard.module.css
│   │   │   ├── PermitRouteGuard.tsx
│   │   │   ├── RenewalEligibility.module.css
│   │   │   ├── RenewalEligibility.tsx
│   │   │   ├── StatusTimeline.module.css
│   │   │   ├── StatusTimeline.tsx
│   │   │   └── __tests__/
│   │   ├── permit-form/
│   │   │   ├── CompleteForm.module.css
│   │   │   ├── CompleteReviewStep.tsx
│   │   │   ├── CompleteVehicleInfoStep.tsx
│   │   │   ├── ConfirmationStep.tsx
│   │   │   ├── OxxoConfirmationStep.tsx
│   │   │   ├── PaymentFormStep.tsx
│   │   │   ├── PersonalInfoStep.tsx
│   │   │   ├── ReviewStep.module.css
│   │   │   ├── SuccessStep.module.css
│   │   │   └── __tests__/
│   │   └── ui/
│   │       ├── Accordion/
│   │       │   └── Accordion.module.css
│   │       ├── Alert/
│   │       │   ├── Alert.module.css
│   │       │   └── Alert.tsx
│   │       ├── Button/
│   │       │   ├── Button.module.css
│   │       │   └── Button.tsx
│   │       ├── Card/
│   │       │   ├── Card.module.css
│   │       │   └── Card.tsx
│   │       ├── DataTable.module.css
│   │       ├── DataTable.tsx
│   │       ├── FormControl/
│   │       │   ├── Checkbox.tsx
│   │       │   ├── FormControl.module.css
│   │       │   ├── RHFAdapters.tsx
│   │       │   ├── Radio.tsx
│   │       │   └── index.ts
│   │       ├── Input/
│   │       │   ├── Input.module.css
│   │       │   ├── Input.tsx
│   │       │   ├── RHFInput.tsx
│   │       │   └── index.ts
│   │       ├── LoadingSpinner.module.css
│   │       ├── LoadingSpinner.tsx
│   │       ├── MobileForm/
│   │       │   ├── MobileForm.module.css
│   │       │   ├── MobileForm.tsx
│   │       │   └── RHFAdapters.tsx
│   │       ├── MobileTable/
│   │       │   ├── MobileTable.module.css
│   │       │   └── MobileTable.tsx
│   │       ├── Modal.module.css
│   │       ├── Modal.tsx
│   │       ├── Pagination/
│   │       │   └── Pagination.module.css
│   │       ├── ResponsiveContainer/
│   │       │   ├── ResponsiveContainer.module.css
│   │       │   ├── ResponsiveContainer.tsx
│   │       │   └── index.ts
│   │       ├── ResponsiveGrid/
│   │       │   ├── ResponsiveGrid.module.css
│   │       │   ├── ResponsiveGrid.tsx
│   │       │   └── index.ts
│   │       ├── ResponsiveImage/
│   │       │   ├── ResponsiveImage.module.css
│   │       │   ├── ResponsiveImage.tsx
│   │       │   └── index.ts
│   │       ├── SkeletonTable.module.css
│   │       ├── SkeletonTable.tsx
│   │       ├── StatusBadge/
│   │       │   ├── StatusBadge.module.css
│   │       │   ├── StatusBadge.tsx
│   │       │   └── index.ts
│   │       ├── StatusBadge.tsx
│   │       ├── Tabs/
│   │       │   ├── Tabs.module.css
│   │       │   └── Tabs.tsx
│   │       ├── TextLogo/
│   │       │   ├── TextLogo.module.css
│   │       │   ├── TextLogo.tsx
│   │       │   └── index.ts
│   │       ├── Toast/
│   │       │   ├── Toast.module.css
│   │       │   ├── Toast.tsx
│   │       │   ├── ToastContainer.tsx
│   │       │   ├── __tests__/
│   │       │   └── index.ts
│   │       └── __tests__/
│   ├── constants/
│   │   └── index.ts
│   ├── contexts/
│   │   ├── README.md
│   │   └── __tests__/
│   │       └── ToastContext.test.tsx
│   ├── hooks/
│   │   ├── README.md
│   │   ├── __tests__/
│   │   │   └── usePermitFormValidation.test.ts
│   │   ├── useBreadcrumbs.ts
│   │   ├── useMediaQuery.ts
│   │   ├── usePermitFormValidation.ts
│   │   └── useResponsive.ts
│   ├── layouts/
│   │   ├── AuthLayout.module.css
│   │   ├── AuthLayout.tsx
│   │   ├── HomeLayout.module.css
│   │   ├── HomeLayout.tsx
│   │   ├── MainLayout.module.css
│   │   ├── MainLayout.tsx
│   │   ├── README.md
│   │   ├── UserLayout.module.css
│   │   ├── UserLayout.tsx
│   │   ├── VerificationLayout.module.css
│   │   └── VerificationLayout.tsx
│   ├── main.tsx
│   ├── pages/
│   │   ├── CompletePermitFormPage.module.css
│   │   ├── CompletePermitFormPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── HomePage.module.css
│   │   ├── HomePage.tsx
│   │   ├── LegalPage.module.css
│   │   ├── LoginPage.tsx
│   │   ├── PaymentErrorPage.tsx
│   │   ├── PaymentResultPage.module.css
│   │   ├── PaymentSuccessPage.tsx
│   │   ├── PaymentUploadPage.module.css
│   │   ├── PaymentUploadPage.tsx
│   │   ├── PermitDetailsPage.module.css
│   │   ├── PermitDetailsPage.tsx
│   │   ├── PermitPaymentPage.tsx
│   │   ├── PermitsListPage.module.css
│   │   ├── PermitsListPage.tsx
│   │   ├── PreVerificationPage.module.css
│   │   ├── PreVerificationPage.tsx
│   │   ├── PrivacyPolicyPage.tsx
│   │   ├── ProfilePage.module.css
│   │   ├── ProfilePage.tsx
│   │   ├── README.md
│   │   ├── RegisterPage.tsx
│   │   ├── ResendVerificationPage.module.css
│   │   ├── ResendVerificationPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── TermsAndConditionsPage.tsx
│   │   ├── UserDashboardPage.module.css
│   │   ├── UserDashboardPage.tsx
│   │   ├── UserPermitsPage.module.css
│   │   ├── UserPermitsPage.tsx
│   │   ├── VerifyEmailPage.module.css
│   │   ├── VerifyEmailPage.tsx
│   │   └── __tests__/
│   ├── services/
│   │   ├── README.md
│   │   ├── __tests__/
│   │   ├── api.ts
│   │   ├── applicationService.ts
│   │   ├── authService.ts
│   │   ├── paymentService.ts
│   │   └── userService.ts
│   ├── shared/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ToastContext.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useToast.ts
│   │   └── schemas/
│   │       ├── auth.schema.ts
│   │       └── permit.schema.ts
│   ├── styles/
│   │   ├── button-styles.css
│   │   ├── global.css
│   │   ├── mobile-form-utilities.css
│   │   ├── mobile-touch-targets.css
│   │   ├── mobile-utilities.css
│   │   ├── reset.css
│   │   ├── variables.css
│   │   └── visibility-utilities.css
│   ├── test/
│   │   ├── mocks/
│   │   │   ├── applicationService.ts
│   │   │   ├── authService.ts
│   │   │   └── axios.ts
│   │   ├── setup.ts
│   │   └── test-utils.tsx
│   ├── types/
│   │   ├── application.types.ts
│   │   └── permisos.ts
│   ├── utils/
│   │   ├── __tests__/
│   │   ├── breadcrumbsConfig.ts
│   │   ├── conekta-loader.ts
│   │   ├── csrf.ts
│   │   ├── debug.ts
│   │   ├── paymentSimulation.ts
│   │   ├── permit-validation.ts
│   │   ├── toast-migration.ts
│   │   └── validation.ts
│   └── vite-env.d.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```
