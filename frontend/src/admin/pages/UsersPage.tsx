import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaSearch, FaFilter, FaSync } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import styles from './UsersPage.module.css';
import Button from '../../components/ui/Button/Button';
import ResponsiveContainer from '../../components/ui/ResponsiveContainer/ResponsiveContainer';
import Icon from '../../shared/components/ui/Icon';
import useResponsive from '../../hooks/useResponsive';
import { useToast } from '../../shared/hooks/useToast';
import adminService, { AdminUserListItem, PaginatedUsers } from '../services/adminService';

const UsersPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isMdDown } = useResponsive();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<AdminUserListItem[]>([]);

  // Fetch users with pagination
  const { data, isLoading, isError, error, refetch } = useQuery<PaginatedUsers>({
    queryKey: ['adminUsers', { page: currentPage, limit: 10, role: roleFilter }],
    queryFn: () => adminService.getUsers(currentPage, 10, roleFilter || undefined),
  });

  // Handle users query error
  React.useEffect(() => {
    if (isError && error) {
      showToast(
        `Error al cargar usuarios: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        'error',
      );
    }
  }, [isError, error, showToast]);

  // Update filtered users when data or search term changes
  useEffect(() => {
    if (data?.users) {
      setFilteredUsers(
        data.users.filter((user) => {
          if (!searchTerm.trim()) return true;

          const searchLower = searchTerm.toLowerCase();
          return (
            user.email.toLowerCase().includes(searchLower) ||
            user.first_name.toLowerCase().includes(searchLower) ||
            user.last_name.toLowerCase().includes(searchLower) ||
            `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower)
          );
        }),
      );
    }
  }, [data, searchTerm]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando usuarios...</p>
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
        <h2>Error al cargar usuarios</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button variant="primary" onClick={() => refetch()}>
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  return (
    <ResponsiveContainer maxWidth="xxl">
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Gestión de Usuarios</h1>
          <p className={styles.pageSubtitle}>Total de usuarios: {data?.pagination?.total || 0}</p>
        </div>

        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <Icon IconComponent={FaSearch} className={styles.searchIcon} size="sm" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterWrapper}>
            <Icon IconComponent={FaFilter} className={styles.filterIcon} size="sm" />
            <select
              className={styles.filterSelect}
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
              aria-label="Filtrar por tipo de cuenta"
            >
              <option value="">Todos los Tipos</option>
              <option value="client">Cliente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <Button
            variant="secondary"
            size="small"
            icon={<Icon IconComponent={FaSync} size="sm" />}
            onClick={() => refetch()}
          >
            Actualizar
          </Button>
        </div>
      </header>

      {filteredUsers.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No se encontraron usuarios</h2>
          <p>Intente con otros criterios de búsqueda.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          {isMdDown ? (
            <div className={styles.mobileCards}>
              {filteredUsers.map((user: AdminUserListItem) => (
                <div
                  key={user.id}
                  className={styles.mobileCard}
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileCardTitle}>
                      {`${user.first_name} ${user.last_name}`}
                    </div>
                    <div className={styles.mobileCardId}>ID: {user.id}</div>
                  </div>

                  <div className={styles.mobileCardContent}>
                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Email:</span>
                      <span className={styles.mobileCardValue}>{user.email}</span>
                    </div>

                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Tipo de Cuenta:</span>
                      <span
                        className={
                          user.account_type === 'admin' ? styles.adminBadge : styles.clientBadge
                        }
                      >
                        {user.account_type === 'admin' ? 'Administrador' : 'Cliente'}
                      </span>
                    </div>

                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Acceso Admin:</span>
                      <span className={styles.mobileCardValue}>
                        {user.is_admin_portal ? 'Sí' : 'No'}
                      </span>
                    </div>

                    <div className={styles.mobileCardItem}>
                      <span className={styles.mobileCardLabel}>Fecha de Creación:</span>
                      <span className={styles.mobileCardValue}>{formatDate(user.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop Table Layout */
            <div className={styles.tableContainer}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Tipo de Cuenta</th>
                    <th>Acceso Admin</th>
                    <th>Fecha de Creación</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: AdminUserListItem) => (
                    <tr
                      key={user.id}
                      className={styles.clickableRow}
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <td>{user.id}</td>
                      <td>{`${user.first_name} ${user.last_name}`}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={
                            user.account_type === 'admin' ? styles.adminBadge : styles.clientBadge
                          }
                        >
                          {user.account_type === 'admin' ? 'Administrador' : 'Cliente'}
                        </span>
                      </td>
                      <td>{user.is_admin_portal ? 'Sí' : 'No'}</td>
                      <td>{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={styles.paginationButton}
              >
                Anterior
              </Button>

              <span className={styles.paginationInfo}>
                Página {currentPage} de {data.pagination.totalPages}
              </span>

              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === data.pagination.totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={styles.paginationButton}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </ResponsiveContainer>
  );
};

export default UsersPage;
