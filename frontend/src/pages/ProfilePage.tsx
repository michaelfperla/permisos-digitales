import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import userService, { UserProfileUpdateData } from '../services/userService';
import ChangePasswordForm from '../components/auth/ChangePasswordForm';
import Modal from '../components/ui/Modal';
import styles from './ProfilePage.module.css';

const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || ''
  });

  if (!user) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.profileCard}>
          <p>No se ha encontrado información del usuario. Por favor, inicie sesión nuevamente.</p>
          <Link to="/login" className={styles.actionButton}>Iniciar Sesión</Link>
        </div>
      </div>
    );
  }

  const handleChangePasswordClick = () => {
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

  const handlePasswordChangeSuccess = () => {
    setIsPasswordModalOpen(false);
  };

  const handleEditClick = () => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updateData: UserProfileUpdateData = {
        first_name: formData.first_name,
        last_name: formData.last_name
      };

      const response = await userService.updateProfile(updateData);

      if (response.success && response.user) {
        showToast('Perfil actualizado exitosamente', 'success');
        setIsEditing(false);

        // Update the user in the auth context
        setUser(response.user);
      } else {
        showToast(response.message || 'Error al actualizar el perfil', 'error');
      }
    } catch (error) {
      showToast('Error al actualizar el perfil', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.profileContainer}>
      <header className={`${styles.profileHeader} page-header-main-content`}>
        <h1 className={`${styles.profileTitle} page-title-h1`}>Perfil de Usuario</h1>
        <h2 className={`${styles.profileSubtitle} page-subtitle-h2`}>
          Información de su cuenta
        </h2>
      </header>

      <div className={styles.profileCard}>
        <div className={styles.profileSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.profileSectionTitle}>Información Personal</h2>
            {!isEditing && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.editButton}`}
                onClick={handleEditClick}
              >
                Editar
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label htmlFor="first_name" className={styles.formLabel}>Nombre</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="last_name" className={styles.formLabel}>Apellido</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.formLabel}>Correo Electrónico</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={user.email}
                  className={styles.formInput}
                  disabled
                />
                <p className={styles.formHelperText}>El correo electrónico no se puede modificar</p>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.secondaryButton}`}
                  onClick={handleCancelEdit}
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.actionButton}
                  disabled={isLoading}
                >
                  {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.profileInfo}>
              <div className={styles.profileLabel}>Nombre</div>
              <div className={styles.profileValue}>{user.first_name}</div>

              <div className={styles.profileLabel}>Apellido</div>
              <div className={styles.profileValue}>{user.last_name}</div>

              <div className={styles.profileLabel}>Correo Electrónico</div>
              <div className={styles.profileValue}>{user.email}</div>

              {user.role && (
                <>
                  <div className={styles.profileLabel}>Tipo de Cuenta</div>
                  <div className={styles.profileValue}>
                    {user.role === 'admin' ? 'Administrador' :
                     user.role === 'staff' ? 'Personal' :
                     user.role === 'user' ? 'Usuario' :
                     user.role}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.profileSection}>
          <h2 className={styles.profileSectionTitle}>Seguridad</h2>
          <p>Gestione su contraseña y la seguridad de su cuenta.</p>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleChangePasswordClick}
            data-testid="change-password-button"
          >
            Cambiar Contraseña
          </button>
        </div>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.profileSection}>
          <h2 className={styles.profileSectionTitle}>Permisos y Solicitudes</h2>
          <p>Acceda a sus permisos y solicitudes en proceso.</p>
          <Link to="/dashboard" className={styles.actionButton}>
            Ver Permisos
          </Link>
        </div>
      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
        title="Cambiar Contraseña"
      >
        <ChangePasswordForm
          onSuccess={handlePasswordChangeSuccess}
          onCancel={handleClosePasswordModal}
        />
      </Modal>
    </div>
  );
};

export default ProfilePage;
