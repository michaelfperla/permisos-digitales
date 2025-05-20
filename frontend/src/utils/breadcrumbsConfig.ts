import { ReactNode } from 'react';
import { BreadcrumbItem } from '../components/navigation/Breadcrumbs/Breadcrumbs';

// Define icon types as strings to avoid using JSX in this file
export type IconType = 'home' | 'clipboard' | 'user' | 'dashboard' | 'users' | 'none';

// Define a modified BreadcrumbItem interface that uses IconType instead of ReactNode
export interface BreadcrumbConfigItem {
  label: string;
  path: string;
  iconType?: IconType;
}

// Define route configurations for client-facing routes
export const clientRoutes: Record<string, BreadcrumbConfigItem[]> = {
  '/': [
    { label: 'Inicio', path: '/', iconType: 'home' }
  ],
  '/dashboard': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' }
  ],
  '/permits': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' }
  ],
  '/permits/complete': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Nueva Solicitud', path: '/permits/complete' }
  ],
  '/permits/:id': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Detalles del Permiso', path: '' } // Path will be dynamically set
  ],
  '/permits/:id/renew': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Detalles del Permiso', path: '' }, // Path will be dynamically set
    { label: 'Renovar Permiso', path: '' } // Path will be dynamically set
  ],
  '/permits/:id/payment': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Detalles del Permiso', path: '' }, // Path will be dynamically set
    { label: 'Pago', path: '' } // Path will be dynamically set
  ],
  '/profile': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mi Perfil', path: '/profile', iconType: 'user' }
  ],
  '/documents': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Documentos', path: '/documents', iconType: 'clipboard' }
  ],
  '/payment/success': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Pago Exitoso', path: '/payment/success' }
  ],
  '/payment/error': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Error de Pago', path: '/payment/error' }
  ],
  '/breadcrumbs-test': [
    { label: 'Dashboard', path: '/dashboard', iconType: 'dashboard' },
    { label: 'Mis Solicitudes', path: '/permits', iconType: 'clipboard' },
    { label: 'Prueba de Breadcrumbs', path: '/breadcrumbs-test' }
  ]
};

// Define route configurations for admin routes
export const adminRoutes: Record<string, BreadcrumbConfigItem[]> = {
  '/': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' }
  ],
  '/applications': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' },
    { label: 'Solicitudes', path: '/applications', iconType: 'clipboard' }
  ],
  '/applications/:id': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' },
    { label: 'Solicitudes', path: '/applications', iconType: 'clipboard' },
    { label: 'Detalles de Solicitud', path: '' } // Path will be dynamically set
  ],
  '/pending-verifications': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' },
    { label: 'Verificaciones Pendientes', path: '/pending-verifications' }
  ],
  '/verification-history': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' },
    { label: 'Historial de Verificaciones', path: '/verification-history' }
  ],
  '/users': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' },
    { label: 'Usuarios', path: '/users', iconType: 'users' }
  ],
  '/users/:userId': [
    { label: 'Dashboard', path: '/', iconType: 'dashboard' },
    { label: 'Usuarios', path: '/users', iconType: 'users' },
    { label: 'Detalles de Usuario', path: '' } // Path will be dynamically set
  ]
};
