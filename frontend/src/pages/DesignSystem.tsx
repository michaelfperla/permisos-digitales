import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './DesignSystem.module.css';

// Import all UI components to showcase
import Button from '../components/ui/Button/Button';
import Card from '../components/ui/Card/Card';
import Icon from '../shared/components/ui/Icon';
import StatusBadge from '../components/ui/StatusBadge/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Toast from '../components/ui/Toast/Toast';
import { ApplicationStatus } from '../constants/application.constants';

// Import icons from react-icons
import { 
  FaHome, FaUser, FaFileAlt, FaPlusCircle, FaExclamationCircle,
  FaCheckCircle, FaTimes, FaBars, FaClock, FaExclamationTriangle
} from 'react-icons/fa';

const DesignSystem: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastId, setToastId] = useState(0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Sistema de Diseño - Permisos Digitales</h1>
        <p>Referencia completa de componentes y estilos</p>
      </header>

      <nav className={styles.nav}>
        <a href="#colors">Colores</a>
        <a href="#typography">Tipografía</a>
        <a href="#spacing">Espaciado</a>
        <a href="#buttons">Botones</a>
        <a href="#forms">Formularios</a>
        <a href="#cards">Tarjetas</a>
        <a href="#badges">Badges</a>
        <a href="#navigation">Navegación</a>
        <a href="#feedback">Feedback</a>
        <a href="#mobile">Mobile</a>
      </nav>

      <main className={styles.main}>
        {/* Colors Section */}
        <section id="colors" className={styles.section}>
          <h2>Colores</h2>
          <div className={styles.colorGrid}>
            <div className={styles.colorGroup}>
              <h3>Colores Primarios</h3>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-primary)' }}>
                <span>Primary</span>
                <code>--color-primary</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-primary-dark)' }}>
                <span>Primary Dark</span>
                <code>--color-primary-dark</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-primary-light)' }}>
                <span>Primary Light</span>
                <code>--color-primary-light</code>
              </div>
            </div>

            <div className={styles.colorGroup}>
              <h3>Colores Funcionales</h3>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-success)' }}>
                <span>Success</span>
                <code>--color-success</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-warning)' }}>
                <span>Warning</span>
                <code>--color-warning</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-error)' }}>
                <span>Error</span>
                <code>--color-error</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: 'var(--color-info)' }}>
                <span>Info</span>
                <code>--color-info</code>
              </div>
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section id="typography" className={styles.section}>
          <h2>Tipografía</h2>
          <div className={styles.typographyDemo}>
            <h1 className={styles.h1Demo}>Heading 1 - Solicitud de Permiso</h1>
            <h2 className={styles.h2Demo}>Heading 2 - Información Personal</h2>
            <h3 className={styles.h3Demo}>Heading 3 - Datos del Vehículo</h3>
            <h4 className={styles.h4Demo}>Heading 4 - Detalles Adicionales</h4>
            <p className={styles.bodyDemo}>
              Texto de párrafo regular. Este es el estilo por defecto para el contenido del cuerpo.
              Utiliza la fuente Inter para mejor legibilidad.
            </p>
            <p className={styles.smallDemo}>
              <small>Texto pequeño para notas y aclaraciones secundarias.</small>
            </p>
          </div>
        </section>

        {/* Spacing Section */}
        <section id="spacing" className={styles.section}>
          <h2>Sistema de Espaciado</h2>
          <div className={styles.spacingDemo}>
            <div className={styles.spacingBox} style={{ padding: 'var(--spacing-xs)' }}>
              <code>--spacing-xs</code>
            </div>
            <div className={styles.spacingBox} style={{ padding: 'var(--spacing-sm)' }}>
              <code>--spacing-sm</code>
            </div>
            <div className={styles.spacingBox} style={{ padding: 'var(--spacing-md)' }}>
              <code>--spacing-md</code>
            </div>
            <div className={styles.spacingBox} style={{ padding: 'var(--spacing-lg)' }}>
              <code>--spacing-lg</code>
            </div>
            <div className={styles.spacingBox} style={{ padding: 'var(--spacing-xl)' }}>
              <code>--spacing-xl</code>
            </div>
          </div>
        </section>

        {/* Buttons Section */}
        <section id="buttons" className={styles.section}>
          <h2>Botones</h2>
          <div className={styles.buttonGrid}>
            <div>
              <h3>Primarios</h3>
              <Button variant="primary">Iniciar Sesión</Button>
              <Button variant="primary" disabled>Deshabilitado</Button>
            </div>
            <div>
              <h3>Secundarios</h3>
              <Button variant="secondary">Registrarse</Button>
              <Button variant="secondary" disabled>Deshabilitado</Button>
            </div>
            <div>
              <h3>Peligro</h3>
              <Button variant="danger">Eliminar</Button>
              <Button variant="danger" disabled>Deshabilitado</Button>
            </div>
            <div>
              <h3>Tamaños</h3>
              <Button size="small">Pequeño</Button>
              <Button size="default">Mediano</Button>
              <Button size="large">Grande</Button>
            </div>
          </div>
        </section>

        {/* Forms Section */}
        <section id="forms" className={styles.section}>
          <h2>Elementos de Formulario</h2>
          <form className={styles.formDemo}>
            <div className={styles.formGroup}>
              <label htmlFor="name">Nombre Completo</label>
              <input type="text" id="name" placeholder="Juan Pérez" />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">Correo Electrónico</label>
              <input type="email" id="email" placeholder="correo@ejemplo.com" />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone">Teléfono</label>
              <input type="tel" id="phone" placeholder="+52 123 456 7890" />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="vehicle">Tipo de Vehículo</label>
              <select id="vehicle">
                <option>Selecciona un tipo</option>
                <option>Automóvil</option>
                <option>Camioneta</option>
                <option>Motocicleta</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="message">Mensaje</label>
              <textarea id="message" rows={4} placeholder="Escribe tu mensaje aquí..."></textarea>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkbox}>
                <input type="checkbox" />
                <span>Acepto los términos y condiciones</span>
              </label>
            </div>

            <div className={styles.formError}>
              <Icon IconComponent={FaExclamationCircle} size="sm" />
              <span>Este campo es requerido</span>
            </div>
          </form>
        </section>

        {/* Cards Section */}
        <section id="cards" className={styles.section}>
          <h2>Tarjetas</h2>
          <div className={styles.cardGrid}>
            <Card>
              <h3>Tarjeta Básica</h3>
              <p>Contenido de ejemplo para una tarjeta estándar.</p>
            </Card>

            <Card className={styles.highlightCard}>
              <h3>Tarjeta Destacada</h3>
              <p>Esta tarjeta tiene un estilo especial para llamar la atención.</p>
              <Button variant="primary" size="small">Acción</Button>
            </Card>

            <Card>
              <div className={styles.statCard}>
                <Icon IconComponent={FaFileAlt} size="lg" color="var(--color-primary)" />
                <div>
                  <h4>125</h4>
                  <p>Permisos Activos</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Badges Section */}
        <section id="badges" className={styles.section}>
          <h2>Status Badges</h2>
          <div className={styles.badgeGrid}>
            <StatusBadge status={ApplicationStatus.COMPLETED} />
            <StatusBadge status={ApplicationStatus.AWAITING_PAYMENT} />
            <StatusBadge status={ApplicationStatus.PAYMENT_PROCESSING} />
            <StatusBadge status={ApplicationStatus.EXPIRED} />
            <StatusBadge status={ApplicationStatus.CANCELLED} />
          </div>
        </section>

        {/* Navigation Section */}
        <section id="navigation" className={styles.section}>
          <h2>Navegación</h2>
          <div className={styles.navDemo}>
            <div className={styles.navBar}>
              <div className={styles.navBrand}>
                Permisos<span>Digitales</span>
              </div>
              <nav className={styles.navMenu}>
                <Link to="/">Inicio</Link>
                <Link to="/permits">Mis Permisos</Link>
                <Link to="/profile">Mi Perfil</Link>
                <Button variant="primary" size="small">Nuevo Permiso</Button>
              </nav>
            </div>
          </div>
        </section>

        {/* Feedback Section */}
        <section id="feedback" className={styles.section}>
          <h2>Elementos de Feedback</h2>
          
          <div className={styles.feedbackGrid}>
            <div>
              <h3>Loading States</h3>
              <LoadingSpinner />
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="lg" />
            </div>

            <div>
              <h3>Empty States</h3>
              <div className={styles.emptyState}>
                <Icon IconComponent={FaFileAlt} size="3rem" color="var(--color-text-muted)" />
                <h4>No hay permisos</h4>
                <p>Aún no has creado ningún permiso digital</p>
                <Button variant="primary">Crear Permiso</Button>
              </div>
            </div>

            <div>
              <h3>Dialogs</h3>
              <Button onClick={() => setShowDialog(true)}>Mostrar Diálogo</Button>
              {showDialog && (
                <div className={styles.dialogBackdrop} onClick={() => setShowDialog(false)}>
                  <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                    <h3>¿Estás seguro?</h3>
                    <p>Esta acción no se puede deshacer.</p>
                    <div className={styles.dialogActions}>
                      <Button variant="secondary" onClick={() => setShowDialog(false)}>Cancelar</Button>
                      <Button variant="primary" onClick={() => setShowDialog(false)}>Confirmar</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3>Toast Notifications</h3>
              <Button onClick={() => {
                setShowToast(true);
                setToastId(prev => prev + 1);
              }}>Mostrar Toast</Button>
              {showToast && (
                <Toast
                  id={`toast-${toastId}`}
                  type="success"
                  message="Operación completada exitosamente"
                  onClose={() => setShowToast(false)}
                />
              )}
            </div>
          </div>
        </section>

        {/* Mobile Section */}
        <section id="mobile" className={styles.section}>
          <h2>Componentes Mobile</h2>
          <div className={styles.mobileDemo}>
            <div className={styles.phoneFrame}>
              <div className={styles.mobileHeader}>
                <Icon IconComponent={FaBars} size="lg" />
                <span>Permisos Digitales</span>
                <Icon IconComponent={FaUser} size="lg" />
              </div>
              
              <div className={styles.mobileCard}>
                <h4>Permiso #PD-2025-001</h4>
                <StatusBadge status={ApplicationStatus.COMPLETED} />
                <p>Toyota Corolla 2020</p>
                <small>Válido hasta: 31/12/2025</small>
              </div>

              <div className={styles.mobileNav}>
                <button className={styles.mobileNavItem}>
                  <Icon IconComponent={FaHome} size="md" />
                  <span>Inicio</span>
                </button>
                <button className={styles.mobileNavItem}>
                  <Icon IconComponent={FaFileAlt} size="md" />
                  <span>Permisos</span>
                </button>
                <button className={styles.mobileNavItem}>
                  <Icon IconComponent={FaPlusCircle} size="md" />
                  <span>Nuevo</span>
                </button>
                <button className={styles.mobileNavItem}>
                  <Icon IconComponent={FaUser} size="md" />
                  <span>Perfil</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DesignSystem;