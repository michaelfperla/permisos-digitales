import React, { useState } from 'react';

const CleanDesignSystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState('colors');

  // Inline all styles to be completely isolated
  const styles = {
    // Reset and base
    '*': {
      margin: 0,
      padding: 0,
      boxSizing: 'border-box' as const,
    },
    
    page: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      color: '#212529',
    },

    header: {
      backgroundColor: '#fff',
      borderBottom: '1px solid #e9ecef',
      padding: '2rem 0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    },

    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 1.5rem',
    },

    title: {
      fontSize: '2.5rem',
      fontWeight: '700',
      color: '#B5384D',
      marginBottom: '0.5rem',
    },

    subtitle: {
      fontSize: '1.125rem',
      color: '#6c757d',
    },

    nav: {
      backgroundColor: '#fff',
      padding: '0',
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid #e9ecef',
    },

    navInner: {
      display: 'flex',
      gap: '2rem',
      padding: '0',
    },

    navItem: {
      padding: '1rem 0',
      cursor: 'pointer',
      borderBottom: '3px solid transparent',
      fontWeight: '500',
      color: '#6c757d',
      transition: 'all 0.2s ease',
    },

    navItemActive: {
      borderBottomColor: '#B5384D',
      color: '#B5384D',
    },

    content: {
      padding: '3rem 0',
    },

    section: {
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    },

    sectionTitle: {
      fontSize: '1.75rem',
      fontWeight: '600',
      marginBottom: '1.5rem',
      color: '#212529',
    },

    // Color system
    colorGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem',
    },

    colorCard: {
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    },

    colorSwatch: {
      height: '120px',
      display: 'flex',
      alignItems: 'flex-end',
      padding: '1rem',
      color: '#fff',
      fontWeight: '600',
    },

    colorInfo: {
      padding: '1rem',
      backgroundColor: '#fff',
    },

    colorName: {
      fontWeight: '600',
      marginBottom: '0.25rem',
    },

    colorHex: {
      color: '#6c757d',
      fontSize: '0.875rem',
      fontFamily: 'monospace',
    },

    // Typography
    typeExample: {
      marginBottom: '2rem',
      padding: '1.5rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
    },

    // Buttons
    buttonGroup: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '1rem',
      marginBottom: '2rem',
    },

    button: {
      padding: '0.5rem 1.5rem',
      borderRadius: '6px',
      border: 'none',
      fontWeight: '500',
      fontSize: '1rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit',
    },

    buttonPrimary: {
      backgroundColor: '#B5384D',
      color: '#fff',
    },

    buttonSecondary: {
      backgroundColor: '#fff',
      color: '#B5384D',
      border: '2px solid #B5384D',
    },

    buttonSuccess: {
      backgroundColor: '#198754',
      color: '#fff',
    },

    buttonDanger: {
      backgroundColor: '#dc3545',
      color: '#fff',
    },

    // Forms
    formGroup: {
      marginBottom: '1.5rem',
    },

    label: {
      display: 'block',
      marginBottom: '0.5rem',
      fontWeight: '500',
      color: '#212529',
    },

    input: {
      width: '100%',
      padding: '0.625rem 0.875rem',
      fontSize: '1rem',
      borderRadius: '6px',
      border: '1px solid #ced4da',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      fontFamily: 'inherit',
    },

    inputFocus: {
      borderColor: '#B5384D',
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(181, 56, 77, 0.1)',
    },

    // Cards
    card: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: '1.5rem',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
      marginBottom: '1rem',
    },

    // Badges
    badge: {
      display: 'inline-block',
      padding: '0.375rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.875rem',
      fontWeight: '500',
      marginRight: '0.5rem',
      marginBottom: '0.5rem',
    },

    // Spacing demo
    spacingBox: {
      backgroundColor: '#B5384D',
      opacity: 0.1,
      marginBottom: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#B5384D',
      fontWeight: '600',
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.container}>
          <h1 style={styles.title}>Sistema de Diseño Limpio</h1>
          <p style={styles.subtitle}>Guía visual para Permisos Digitales - Versión corregida</p>
        </div>
      </header>

      <nav style={styles.nav}>
        <div style={styles.container}>
          <div style={styles.navInner}>
            {['colors', 'typography', 'buttons', 'forms', 'components', 'spacing'].map((tab) => (
              <div
                key={tab}
                style={{
                  ...styles.navItem,
                  ...(activeTab === tab ? styles.navItemActive : {}),
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main style={styles.content}>
        <div style={styles.container}>
          {activeTab === 'colors' && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Paleta de Colores</h2>
              
              <h3 style={{ marginBottom: '1rem' }}>Colores Principales</h3>
              <div style={styles.colorGrid}>
                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#B5384D' }}>
                    Primario
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Rojo Permisos</div>
                    <div style={styles.colorHex}>#B5384D</div>
                  </div>
                </div>

                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#8A2B3A' }}>
                    Primario Oscuro
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Rojo Oscuro</div>
                    <div style={styles.colorHex}>#8A2B3A</div>
                  </div>
                </div>

                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#D4516A' }}>
                    Primario Claro
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Rojo Claro</div>
                    <div style={styles.colorHex}>#D4516A</div>
                  </div>
                </div>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Colores de Estado</h3>
              <div style={styles.colorGrid}>
                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#198754' }}>
                    Éxito
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Verde Éxito</div>
                    <div style={styles.colorHex}>#198754</div>
                  </div>
                </div>

                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#ffc107' }}>
                    Advertencia
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Amarillo Advertencia</div>
                    <div style={styles.colorHex}>#ffc107</div>
                  </div>
                </div>

                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#dc3545' }}>
                    Error
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Rojo Error</div>
                    <div style={styles.colorHex}>#dc3545</div>
                  </div>
                </div>

                <div style={styles.colorCard}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: '#0dcaf0' }}>
                    Información
                  </div>
                  <div style={styles.colorInfo}>
                    <div style={styles.colorName}>Azul Info</div>
                    <div style={styles.colorHex}>#0dcaf0</div>
                  </div>
                </div>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Escala de Grises</h3>
              <div style={styles.colorGrid}>
                {[
                  { name: 'Negro', hex: '#212529' },
                  { name: 'Gris Oscuro', hex: '#495057' },
                  { name: 'Gris', hex: '#6c757d' },
                  { name: 'Gris Claro', hex: '#adb5bd' },
                  { name: 'Gris Muy Claro', hex: '#dee2e6' },
                  { name: 'Fondo', hex: '#f8f9fa' },
                ].map((color) => (
                  <div key={color.hex} style={styles.colorCard}>
                    <div style={{ ...styles.colorSwatch, backgroundColor: color.hex, color: color.hex === '#f8f9fa' ? '#212529' : '#fff' }}>
                      {color.name}
                    </div>
                    <div style={styles.colorInfo}>
                      <div style={styles.colorName}>{color.name}</div>
                      <div style={styles.colorHex}>{color.hex}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'typography' && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Tipografía</h2>
              
              <div style={styles.typeExample}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem' }}>
                  Título Principal (H1) - 2.5rem
                </h1>
                <h2 style={{ fontSize: '2rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Subtítulo (H2) - 2rem
                </h2>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Título de Sección (H3) - 1.5rem
                </h3>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1rem' }}>
                  Subsección (H4) - 1.25rem
                </h4>
                <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                  Texto de párrafo regular. Este es el tamaño base para todo el contenido del cuerpo. 
                  La altura de línea es 1.6 para mejor legibilidad. Font-size: 1rem (16px).
                </p>
                <small style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                  Texto pequeño para notas y aclaraciones - 0.875rem
                </small>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Pesos de Fuente</h3>
              <div style={styles.typeExample}>
                <p style={{ fontWeight: 400, marginBottom: '0.5rem' }}>Regular (400) - Texto normal</p>
                <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Medium (500) - Énfasis ligero</p>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Semibold (600) - Subtítulos</p>
                <p style={{ fontWeight: 700 }}>Bold (700) - Títulos principales</p>
              </div>
            </section>
          )}

          {activeTab === 'buttons' && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Botones</h2>
              
              <h3 style={{ marginBottom: '1rem' }}>Variantes Principales</h3>
              <div style={styles.buttonGroup}>
                <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                  Botón Primario
                </button>
                <button style={{ ...styles.button, ...styles.buttonSecondary }}>
                  Botón Secundario
                </button>
                <button style={{ ...styles.button, ...styles.buttonSuccess }}>
                  Botón Éxito
                </button>
                <button style={{ ...styles.button, ...styles.buttonDanger }}>
                  Botón Peligro
                </button>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Estados</h3>
              <div style={styles.buttonGroup}>
                <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                  Normal
                </button>
                <button 
                  style={{ 
                    ...styles.button, 
                    ...styles.buttonPrimary,
                    opacity: 0.8,
                    cursor: 'pointer',
                  }}
                >
                  Hover
                </button>
                <button 
                  style={{ 
                    ...styles.button, 
                    ...styles.buttonPrimary,
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  }}
                  disabled
                >
                  Deshabilitado
                </button>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Tamaños</h3>
              <div style={styles.buttonGroup}>
                <button 
                  style={{ 
                    ...styles.button, 
                    ...styles.buttonPrimary,
                    padding: '0.375rem 1rem',
                    fontSize: '0.875rem',
                  }}
                >
                  Pequeño
                </button>
                <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                  Normal
                </button>
                <button 
                  style={{ 
                    ...styles.button, 
                    ...styles.buttonPrimary,
                    padding: '0.75rem 2rem',
                    fontSize: '1.125rem',
                  }}
                >
                  Grande
                </button>
              </div>
            </section>
          )}

          {activeTab === 'forms' && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Formularios</h2>
              
              <form style={{ maxWidth: '500px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Correo Electrónico</label>
                  <input 
                    type="email" 
                    style={styles.input}
                    placeholder="usuario@ejemplo.com"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Contraseña</label>
                  <input 
                    type="password" 
                    style={styles.input}
                    placeholder="••••••••"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Tipo de Vehículo</label>
                  <select style={styles.input}>
                    <option>Selecciona una opción</option>
                    <option>Automóvil</option>
                    <option>Camioneta</option>
                    <option>Motocicleta</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Mensaje</label>
                  <textarea 
                    style={{ ...styles.input, minHeight: '120px', resize: 'vertical' as const }}
                    placeholder="Escribe tu mensaje aquí..."
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ marginRight: '0.5rem' }} />
                    <span>Acepto los términos y condiciones</span>
                  </label>
                </div>

                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                }}>
                  ⚠️ Por favor completa todos los campos requeridos
                </div>

                <button 
                  type="submit" 
                  style={{ ...styles.button, ...styles.buttonPrimary }}
                >
                  Enviar Formulario
                </button>
              </form>
            </section>
          )}

          {activeTab === 'components' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Tarjetas</h2>
                
                <div style={styles.card}>
                  <h3 style={{ marginBottom: '0.5rem' }}>Tarjeta Básica</h3>
                  <p style={{ color: '#6c757d' }}>
                    Esta es una tarjeta estándar con sombra sutil y bordes redondeados.
                  </p>
                </div>

                <div style={{ 
                  ...styles.card,
                  border: '2px solid #B5384D',
                  boxShadow: '0 4px 6px rgba(181, 56, 77, 0.1)',
                }}>
                  <h3 style={{ marginBottom: '0.5rem', color: '#B5384D' }}>Tarjeta Destacada</h3>
                  <p style={{ color: '#6c757d' }}>
                    Esta tarjeta tiene un borde de color para mayor énfasis.
                  </p>
                  <button 
                    style={{ 
                      ...styles.button, 
                      ...styles.buttonPrimary,
                      marginTop: '1rem',
                    }}
                  >
                    Acción
                  </button>
                </div>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Badges de Estado</h2>
                
                <div>
                  <span style={{ 
                    ...styles.badge,
                    backgroundColor: '#d1f2e8',
                    color: '#0f5132',
                  }}>
                    ✓ Completado
                  </span>
                  <span style={{ 
                    ...styles.badge,
                    backgroundColor: '#fff3cd',
                    color: '#664d03',
                  }}>
                    ⏱ Pendiente
                  </span>
                  <span style={{ 
                    ...styles.badge,
                    backgroundColor: '#cfe2ff',
                    color: '#084298',
                  }}>
                    ↻ Procesando
                  </span>
                  <span style={{ 
                    ...styles.badge,
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                  }}>
                    ✕ Cancelado
                  </span>
                </div>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Mensajes de Alerta</h2>
                
                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#d1f2e8',
                  color: '#0f5132',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid #badbcc',
                }}>
                  ✓ <strong>Éxito:</strong> La operación se completó correctamente.
                </div>

                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#fff3cd',
                  color: '#664d03',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid #ffecb5',
                }}>
                  ⚠️ <strong>Advertencia:</strong> Por favor revisa la información antes de continuar.
                </div>

                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid #f5c2c7',
                }}>
                  ✕ <strong>Error:</strong> No se pudo procesar la solicitud.
                </div>

                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#cfe2ff',
                  color: '#084298',
                  borderRadius: '6px',
                  border: '1px solid #b6d4fe',
                }}>
                  ℹ️ <strong>Información:</strong> Tu permiso estará listo en 24 horas.
                </div>
              </section>
            </>
          )}

          {activeTab === 'spacing' && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Sistema de Espaciado</h2>
              
              <p style={{ marginBottom: '2rem', color: '#6c757d' }}>
                Basado en múltiplos de 8px para consistencia
              </p>

              <div style={{ ...styles.spacingBox, height: '8px' }}>8px - xs</div>
              <div style={{ ...styles.spacingBox, height: '16px' }}>16px - sm</div>
              <div style={{ ...styles.spacingBox, height: '24px' }}>24px - md</div>
              <div style={{ ...styles.spacingBox, height: '32px' }}>32px - lg</div>
              <div style={{ ...styles.spacingBox, height: '48px' }}>48px - xl</div>
              <div style={{ ...styles.spacingBox, height: '64px' }}>64px - 2xl</div>

              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Uso en Componentes</h3>
              <div style={styles.card}>
                <p style={{ marginBottom: '16px' }}>Este párrafo tiene margin-bottom de 16px (sm)</p>
                <p style={{ marginBottom: '24px' }}>Este párrafo tiene margin-bottom de 24px (md)</p>
                <button style={{ 
                  ...styles.button, 
                  ...styles.buttonPrimary,
                  marginRight: '16px',
                }}>
                  Botón con margin-right 16px
                </button>
                <button style={{ ...styles.button, ...styles.buttonSecondary }}>
                  Otro botón
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default CleanDesignSystem;