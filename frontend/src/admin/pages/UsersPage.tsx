import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FaExclamationTriangle, FaSearch, FaFilter, FaSync } from 'react-icons/fa';
import adminService, { AdminUserListItem, PaginatedUsers } from '../services/adminService';
import { useToast } from '../contexts/ToastContext';
import Button from '../../components/ui/Button/Button';
import styles from './UsersPage.module.css';

const UsersPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<AdminUserListItem[]>([]);

  // Fetch users with pagination
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<PaginatedUsers>({
    queryKey: ['adminUsers', { page: currentPage, limit: 10, role: roleFilter }],
    queryFn: () => adminService.getUsers(currentPage, 10, roleFilter || undefined),
    onError: (err) => {
      showToast(`Error al cargar usuarios: ${err instanceof Error ? err.message : 'Error desconocido'}`, 'error');
    }
  });

  // Update filtered users when data or search term changes
  useEffect(() => {
    if (data?.users) {
      setFilteredUsers(
        data.users.filter(user => {
          if (!searchTerm.trim()) return true;

          const searchLower = searchTerm.toLowerCase();
          return (
            user.email.toLowerCase().includes(searchLower) ||
            user.first_name.toLowerCase().includes(searchLower) ||
            user.last_name.toLowerCase().includes(searchLower) ||
            `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower)
          );
        })
      );
    }
  }, [data, searchTerm]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
        <FaExclamationTriangle className={styles.errorIcon} />
        <h2>Error al cargar usuarios</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
        <Button
          variant="primary"
          onClick={() => refetch()}
        >
          Intentar nuevamente
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.usersPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Gestión de Usuarios</h1>
          <p className={styles.pageSubtitle}>
            Total de usuarios: {data?.pagination?.total || 0}
          </p>
        </div>

        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterWrapper}>
            <FaFilter className={styles.filterIcon} />
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
            icon={<FaSync />}
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
                      <span className={user.account_type === 'admin' ? styles.adminBadge : styles.clientBadge}>
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
    </div>
  );
};

export default UsersPage;
