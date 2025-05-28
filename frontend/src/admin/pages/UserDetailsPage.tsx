import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  FaArrowLeft,
  FaExclamationTriangle,
  FaCar,
  FaLock,
  FaLockOpen,
  FaRedo,
} from 'react-icons/fa';
import { useParams, Link } from 'react-router-dom';

import styles from './UserDetailsPage.module.css';
import Button from '../../components/ui/Button/Button';
import ResponsiveContainer from '../../components/ui/ResponsiveContainer/ResponsiveContainer';
import Icon from '../../shared/components/ui/Icon';
import { useAdminAuth as useAuth } from '../../shared/hooks/useAuth';
import { useToast } from '../../shared/hooks/useToast';
import adminService, { Application, SecurityEvent } from '../services/adminService';

const UserDetailsPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { showToast } = useToast();
  const { user: loggedInUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user details
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminUserDetails', userId],
    queryFn: () => adminService.getUserDetails(userId as string),
    enabled: !!userId, // Only run the query if userId is present
  });

  // Enable user mutation
  const enableMutation = useMutation({
    mutationFn: (id: string) => adminService.enableUser(id),
    onSuccess: () => {
      showToast('Usuario activado exitosamente', 'success');
      // Invalidate the user details query to refetch the data
      queryClient.invalidateQueries({ queryKey: ['adminUserDetails', userId] });
    },
    onError: (error: Error) => {
      showToast(`Error al activar usuario: ${error.message}`, 'error');
    },
  });

  // Disable user mutation
  const disableMutation = useMutation({
    mutationFn: (id: string) => adminService.disableUser(id),
    onSuccess: () => {
      showToast('Usuario desactivado exitosamente', 'success');
      // Invalidate the user details query to refetch the data
      queryClient.invalidateQueries({ queryKey: ['adminUserDetails', userId] });
    },
    onError: (error: Error) => {
      showToast(`Error al desactivar usuario: ${error.message}`, 'error');
    },
  });

  // Handle user details error
  React.useEffect(() => {
    if (isError && error) {
      showToast(`Error al cargar detalles del usuario: ${error.message}`, 'error');
    }
  }, [isError, error, showToast]);

  // Fetch user applications
  const {
    data: appsData,
    isLoading: appsLoading,
    isError: appsError,
    error: appsErrorDetails,
    refetch: refetchApps,
  } = useQuery({
    queryKey: ['userApplications', userId],
    queryFn: () => adminService.getUserApplications(userId as string),
    enabled: !!userId, // Only run the query if userId is present
  });

  // Handle applications error
  React.useEffect(() => {
    if (appsError && appsErrorDetails) {
      showToast(
        `Error al cargar solicitudes del usuario: ${appsErrorDetails instanceof Error ? appsErrorDetails.message : 'Error desconocido'}`,
        'error',
      );
    }
  }, [appsError, appsErrorDetails, showToast]);

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando detalles del usuario...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.errorIcon}
          size="xl"
          color="var(--color-danger)"
        />
        <h2>Error al cargar detalles del usuario</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button
          variant="primary"
          onClick={() => refetch()}
          className={styles.retryButton}
          icon={<Icon IconComponent={FaRedo} size="sm" />}
        >
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  const user = data?.user;

  if (!user) {
    return (
      <div className={styles.errorContainer}>
        <Icon
          IconComponent={FaExclamationTriangle}
          className={styles.errorIcon}
          size="xl"
          color="var(--color-danger)"
        />
        <h2>Usuario no encontrado</h2>
        <p>No se encontró información para el usuario solicitado.</p>
        <Link to="/users" className={styles.backButton}>
          <Icon IconComponent={FaArrowLeft} className={styles.backIcon} size="sm" />
          Volver a la lista de usuarios
        </Link>
      </div>
    );
  }

  return (
    <ResponsiveContainer maxWidth="xxl">
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Detalles del Usuario</h1>
          <p className={styles.pageSubtitle}>ID: {user.id}</p>
        </div>
        <Link to="/users" className={styles.backButton}>
          <Icon IconComponent={FaArrowLeft} className={styles.backIcon} size="sm" />
          Volver a la lista de usuarios
        </Link>
      </header>

      <div className={styles.userDetailsCard}>
        <div className={styles.userDetailsHeader}>
          <h2 className={styles.sectionTitle}>Información del Usuario</h2>
          {/* Add account status actions */}
          <div className={styles.userActions}>
            {user.is_active !== false ? (
              <Button
                variant="danger"
                className={styles.disableButton}
                onClick={() => {
                  // Prevent admin from disabling their own account
                  if (loggedInUser?.id === userId) {
                    showToast('No puedes desactivar tu propia cuenta', 'error');
                    return;
                  }

                  // Confirm before disabling
                  if (
                    window.confirm('¿Estás seguro que deseas desactivar esta cuenta de usuario?')
                  ) {
                    disableMutation.mutate(userId as string);
                  }
                }}
                disabled={disableMutation.isPending || loggedInUser?.id === userId}
                icon={<Icon IconComponent={FaLock} className={styles.actionIcon} size="sm" />}
              >
                Desactivar Cuenta
              </Button>
            ) : (
              <Button
                variant="success"
                className={styles.enableButton}
                onClick={() => {
                  // Confirm before enabling
                  if (window.confirm('¿Estás seguro que deseas activar esta cuenta de usuario?')) {
                    enableMutation.mutate(userId as string);
                  }
                }}
                disabled={enableMutation.isPending}
                icon={<Icon IconComponent={FaLockOpen} className={styles.actionIcon} size="sm" />}
              >
                Activar Cuenta
              </Button>
            )}
          </div>
        </div>
        <div className={styles.userDetailsBody}>
          <dl className={styles.definitionList}>
            <dt className={styles.definitionTerm}>Nombre Completo</dt>
            <dd className={styles.definitionDetail}>{`${user.first_name} ${user.last_name}`}</dd>

            <dt className={styles.definitionTerm}>Email</dt>
            <dd className={styles.definitionDetail}>{user.email}</dd>

            <dt className={styles.definitionTerm}>Tipo de Cuenta</dt>
            <dd className={styles.definitionDetail}>
              <span
                className={user.account_type === 'admin' ? styles.adminBadge : styles.clientBadge}
              >
                {user.account_type === 'admin' ? 'Administrador' : 'Cliente'}
              </span>
            </dd>

            <dt className={styles.definitionTerm}>Acceso Admin</dt>
            <dd className={styles.definitionDetail}>
              <span
                className={`${styles.booleanBadge} ${user.is_admin_portal ? styles.trueBadge : styles.falseBadge}`}
              >
                {user.is_admin_portal ? 'Sí' : 'No'}
              </span>
            </dd>

            <dt className={styles.definitionTerm}>Estado de la Cuenta</dt>
            <dd className={styles.definitionDetail}>
              <span
                className={`${styles.statusBadge} ${user.is_active !== false ? styles.statusActive : styles.statusInactive}`}
              >
                {user.is_active !== false ? 'Activa' : 'Desactivada'}
              </span>
            </dd>

            {user.role && (
              <>
                <dt className={styles.definitionTerm}>Rol</dt>
                <dd className={styles.definitionDetail}>{user.role}</dd>
              </>
            )}

            <dt className={styles.definitionTerm}>Fecha de Creación</dt>
            <dd className={styles.definitionDetail}>{formatDate(user.created_at)}</dd>

            <dt className={styles.definitionTerm}>Última Actualización</dt>
            <dd className={styles.definitionDetail}>{formatDate(user.updated_at)}</dd>

            {user.created_by && (
              <>
                <dt className={styles.definitionTerm}>Creado Por</dt>
                <dd className={styles.definitionDetail}>
                  {user.created_by_first_name && user.created_by_last_name
                    ? `${user.created_by_first_name} ${user.created_by_last_name}`
                    : user.created_by}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {user.securityEvents && user.securityEvents.length > 0 && (
        <div className={styles.securityEventsSection}>
          <h2 className={styles.sectionTitle}>Eventos de Seguridad Recientes</h2>
          <table className={styles.securityEventsTable}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo de Acción</th>
                <th>Dirección IP</th>
                <th>Agente de Usuario</th>
              </tr>
            </thead>
            <tbody>
              {user.securityEvents.map((event: SecurityEvent) => (
                <tr key={event.id}>
                  <td>{formatDate(event.created_at)}</td>
                  <td>{event.action_type}</td>
                  <td>{event.ip_address}</td>
                  <td>{event.user_agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {user.securityEvents && user.securityEvents.length === 0 && (
        <div className={styles.noEvents}>
          No hay eventos de seguridad recientes para este usuario.
        </div>
      )}

      {/* Applications Section */}
      <div className={styles.applicationsSection}>
        <h2 className={styles.sectionTitle}>Solicitudes de Permisos</h2>

        {appsLoading && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Cargando solicitudes...</p>
          </div>
        )}

        {appsError && (
          <div className={styles.errorContainer}>
            <Icon
              IconComponent={FaExclamationTriangle}
              className={styles.errorIcon}
              size="xl"
              color="var(--color-danger)"
            />
            <h3>Error al cargar solicitudes</h3>
            <p>
              {appsErrorDetails instanceof Error ? appsErrorDetails.message : 'Error desconocido'}
            </p>
            <Button
              variant="primary"
              onClick={() => refetchApps()}
              className={styles.retryButton}
              icon={<Icon IconComponent={FaRedo} size="sm" />}
            >
              Intentar nuevamente
            </Button>
          </div>
        )}

        {!appsLoading && !appsError && appsData?.applications && (
          <>
            {appsData.applications.length === 0 ? (
              <div className={styles.noEvents}>Este usuario no tiene solicitudes de permisos.</div>
            ) : (
              <table className={styles.applicationsTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Estado</th>
                    <th>Vehículo</th>
                    <th>Fecha de Solicitud</th>
                    <th>Fecha de Vencimiento</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {appsData.applications.map((app: Application) => (
                    <tr key={app.id}>
                      <td>{app.id}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(app.status)}`}>
                          {getStatusDisplayName(app.status)}
                        </span>
                      </td>
                      <td>{`${app.marca} ${app.linea} (${app.ano_modelo})`}</td>
                      <td>{formatDate(app.created_at)}</td>
                      <td>{formatDate(app.fecha_vencimiento)}</td>
                      <td>
                        <Link to={`/applications/${app.id}`} className={styles.viewButton}>
                          <Icon IconComponent={FaCar} className={styles.viewIcon} size="sm" /> Ver
                          Detalles
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </ResponsiveContainer>
  );
};

// Helper function to get status display name
const getStatusDisplayName = (status: string): string => {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Pendiente de Pago';
    case 'PROOF_SUBMITTED':
      return 'Comprobante Enviado';
    case 'PAYMENT_RECEIVED':
      return 'Pago Verificado';
    case 'PROOF_REJECTED':
      return 'Comprobante Rechazado';
    case 'PERMIT_READY':
      return 'Permiso Listo';
    case 'COMPLETED':
      return 'Completado';
    case 'CANCELLED':
      return 'Cancelado';
    case 'EXPIRED':
      return 'Vencido';
    default:
      return status;
  }
};

// Helper function to get status CSS class
const getStatusClass = (status: string): string => {
  switch (status) {
    case 'PENDING_PAYMENT':
      return styles.statusPending;
    case 'PROOF_SUBMITTED':
      return styles.statusSubmitted;
    case 'PAYMENT_RECEIVED':
    case 'COMPLETED':
      return styles.statusVerified;
    case 'PROOF_REJECTED':
      return styles.statusRejected;
    case 'PERMIT_READY':
      return styles.statusReady;
    case 'CANCELLED':
      return styles.statusCancelled;
    case 'EXPIRED':
      return styles.statusExpired;
    default:
      return styles.statusPending;
  }
};

export default UserDetailsPage;
