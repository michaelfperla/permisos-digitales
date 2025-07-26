import React, { useState } from 'react';
import styles from './DesignSystem.module.css';

// Import only the components we know exist
import Button from '../components/ui/Button/Button';
import StatusBadge from '../components/ui/StatusBadge/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ApplicationStatus } from '../constants/application.constants';

const DesignSystemSimple: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Sistema de Diseño - Permisos Digitales</h1>
        <p>Referencia visual para componentes y estilos</p>
      </header>

      <nav className={styles.nav}>
        <a href="#colors">Colores</a>
        <a href="#typography">Tipografía</a>
        <a href="#buttons">Botones</a>
        <a href="#forms">Formularios</a>
        <a href="#badges">Badges</a>
        <a href="#feedback">Feedback</a>
      </nav>

      <main className={styles.main}>
        {/* Colors Section */}
        <section id="colors" className={styles.section}>
          <h2>Colores Principales</h2>
          <div className={styles.colorGrid}>
            <div className={styles.colorGroup}>
              <h3>Marca</h3>
              <div className={styles.colorSwatch} style={{ backgroundColor: '#B5384D' }}>
                <span>Primary</span>
                <code>#B5384D</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: '#8A2B3A' }}>
                <span>Primary Dark</span>
                <code>#8A2B3A</code>
              </div>
            </div>

            <div className={styles.colorGroup}>
              <h3>Estados</h3>
              <div className={styles.colorSwatch} style={{ backgroundColor: '#10B981' }}>
                <span>Success</span>
                <code>#10B981</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: '#F59E0B' }}>
                <span>Warning</span>
                <code>#F59E0B</code>
              </div>
              <div className={styles.colorSwatch} style={{ backgroundColor: '#EF4444' }}>
                <span>Error</span>
                <code>#EF4444</code>
              </div>
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section id="typography" className={styles.section}>
          <h2>Tipografía</h2>
          <div className={styles.typographyDemo}>
            <h1 className={styles.h1Demo}>Título Principal (H1)</h1>
            <h2 className={styles.h2Demo}>Subtítulo (H2)</h2>
            <h3 className={styles.h3Demo}>Sección (H3)</h3>
            <p className={styles.bodyDemo}>
              Texto de párrafo regular. Este es el estilo estándar para el contenido.
            </p>
            <small className={styles.smallDemo}>Texto pequeño para notas secundarias.</small>
          </div>
        </section>

        {/* Buttons Section */}
        <section id="buttons" className={styles.section}>
          <h2>Botones</h2>
          <div className={styles.buttonGrid}>
            <div>
              <h3>Variantes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button variant="primary">Primario</Button>
                <Button variant="secondary">Secundario</Button>
                <Button variant="danger">Peligro</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
            <div>
              <h3>Estados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button variant="primary">Normal</Button>
                <Button variant="primary" disabled>Deshabilitado</Button>
              </div>
            </div>
            <div>
              <h3>Tamaños</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button variant="primary" size="small">Pequeño</Button>
                <Button variant="primary" size="default">Normal</Button>
                <Button variant="primary" size="large">Grande</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Forms Section */}
        <section id="forms" className={styles.section}>
          <h2>Elementos de Formulario</h2>
          <form className={styles.formDemo}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Correo Electrónico</label>
              <input 
                type="email" 
                id="email" 
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="usuario@ejemplo.com" 
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Contraseña</label>
              <input 
                type="password" 
                id="password" 
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="••••••••" 
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="select">Tipo de Vehículo</label>
              <select id="select" style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: 'white'
              }}>
                <option>Selecciona una opción</option>
                <option>Automóvil</option>
                <option>Camioneta</option>
                <option>Motocicleta</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>
                <input type="checkbox" /> Acepto los términos
              </label>
            </div>

            <div className={styles.formError}>
              ⚠️ Este campo es requerido
            </div>
          </form>
        </section>

        {/* Status Badges Section */}
        <section id="badges" className={styles.section}>
          <h2>Status Badges</h2>
          <div className={styles.badgeGrid}>
            <StatusBadge status={ApplicationStatus.COMPLETED} />
            <StatusBadge status={ApplicationStatus.AWAITING_PAYMENT} />
            <StatusBadge status={ApplicationStatus.PAYMENT_PROCESSING} />
            <StatusBadge status={ApplicationStatus.CANCELLED} />
            <StatusBadge status={ApplicationStatus.EXPIRED} />
          </div>
        </section>

        {/* Feedback Section */}
        <section id="feedback" className={styles.section}>
          <h2>Elementos de Feedback</h2>
          
          <div className={styles.feedbackGrid}>
            <div>
              <h3>Loading States</h3>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <LoadingSpinner size="sm" />
                <LoadingSpinner />
                <LoadingSpinner size="lg" />
              </div>
            </div>

            <div>
              <h3>Diálogo de Ejemplo</h3>
              <Button onClick={() => setShowDialog(true)}>Mostrar Diálogo</Button>
              
              {showDialog && (
                <div className={styles.dialogBackdrop} onClick={() => setShowDialog(false)}>
                  <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                    <h3>Confirmación</h3>
                    <p>¿Estás seguro de realizar esta acción?</p>
                    <div className={styles.dialogActions}>
                      <Button variant="secondary" onClick={() => setShowDialog(false)}>
                        Cancelar
                      </Button>
                      <Button variant="primary" onClick={() => setShowDialog(false)}>
                        Confirmar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3>Mensajes</h3>
              <div className={styles.messageSuccess}>
                ✓ Operación completada exitosamente
              </div>
              <div className={styles.messageError}>
                ✗ Error al procesar la solicitud
              </div>
              <div className={styles.messageInfo}>
                ℹ️ Información importante
              </div>
            </div>
          </div>
        </section>

        {/* Common Issues Section */}
        <section className={styles.section}>
          <h2>Problemas Comunes a Corregir</h2>
          <div className={styles.issuesList}>
            <h3>1. Inconsistencia de Colores</h3>
            <p>❌ Mal: Usar diferentes tonos de rojo (#B5384D, #B71C1C, etc.)</p>
            <p>✅ Bien: Usar siempre var(--color-primary) o #B5384D</p>

            <h3>2. Botones Inconsistentes</h3>
            <p>❌ Mal: Mezclar estilos (algunos con borde, otros sin)</p>
            <p>✅ Bien: Usar clases consistentes (btn btn-primary)</p>

            <h3>3. Espaciado Variable</h3>
            <p>❌ Mal: padding: 20px, margin: 15px (valores arbitrarios)</p>
            <p>✅ Bien: Usar variables CSS (--spacing-md, --spacing-lg)</p>

            <h3>4. Z-Index en Mobile</h3>
            <p>❌ Mal: z-index: 999, z-index: 1000 (valores mágicos)</p>
            <p>✅ Bien: Usar var(--z-index-modal), var(--z-index-sticky)</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DesignSystemSimple;