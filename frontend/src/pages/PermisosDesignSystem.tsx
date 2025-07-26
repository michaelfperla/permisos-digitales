import React, { useState } from 'react';

const PermisosDesignSystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showOxxoModal, setShowOxxoModal] = useState(false);

  // Permisos Digitales specific styles
  const styles = {
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

    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '1rem',
    },

    logoText: {
      fontSize: '2.5rem',
      fontWeight: '700',
      color: '#212529',
    },

    logoHighlight: {
      color: '#B5384D',
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
      overflowX: 'auto' as const,
    },

    navItem: {
      padding: '1rem 0',
      cursor: 'pointer',
      borderBottom: '3px solid transparent',
      fontWeight: '500',
      color: '#6c757d',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap' as const,
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

    // Component specific styles
    permitCard: {
      backgroundColor: '#fff',
      border: '1px solid #e9ecef',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '1rem',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    },

    permitCardHover: {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      transform: 'translateY(-2px)',
    },

    permitHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1rem',
    },

    permitNumber: {
      fontSize: '1.125rem',
      fontWeight: '600',
      color: '#212529',
    },

    vehicleInfo: {
      color: '#6c757d',
      marginBottom: '0.5rem',
    },

    permitStatus: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.375rem 0.875rem',
      borderRadius: '20px',
      fontSize: '0.875rem',
      fontWeight: '500',
    },

    statusActive: {
      backgroundColor: '#d1f2e8',
      color: '#0f5132',
    },

    statusPending: {
      backgroundColor: '#fff3cd',
      color: '#664d03',
    },

    statusExpired: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
    },

    // Buttons
    button: {
      padding: '0.625rem 1.5rem',
      borderRadius: '6px',
      border: 'none',
      fontWeight: '500',
      fontSize: '1rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
    },

    buttonPrimary: {
      backgroundColor: '#B5384D',
      color: '#fff',
    },

    buttonPrimaryHover: {
      backgroundColor: '#8A2B3A',
    },

    buttonSecondary: {
      backgroundColor: '#fff',
      color: '#B5384D',
      border: '2px solid #B5384D',
    },

    buttonOxxo: {
      backgroundColor: '#fff',
      color: '#212529',
      border: '2px solid #ffc107',
    },

    buttonIcon: {
      fontSize: '1.25rem',
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

    // Mobile specific
    mobileCard: {
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    },

    mobileHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: '#fff',
      borderBottom: '1px solid #e9ecef',
    },

    bottomNav: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      borderTop: '1px solid #e9ecef',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.5rem 0',
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
    },

    navButton: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.5rem 1rem',
      color: '#6c757d',
      fontSize: '0.75rem',
      border: 'none',
      background: 'none',
      cursor: 'pointer',
    },

    navButtonActive: {
      color: '#B5384D',
    },

    // OXXO specific
    oxxoSlip: {
      backgroundColor: '#f8f9fa',
      border: '2px dashed #ffc107',
      borderRadius: '8px',
      padding: '2rem',
      textAlign: 'center' as const,
      marginBottom: '1rem',
    },

    oxxoReference: {
      fontSize: '1.5rem',
      fontWeight: '700',
      fontFamily: 'monospace',
      letterSpacing: '0.1em',
      marginBottom: '0.5rem',
    },

    // Step indicator
    stepIndicator: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '2rem',
    },

    step: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      flex: 1,
    },

    stepNumber: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      fontSize: '0.875rem',
    },

    stepActive: {
      backgroundColor: '#B5384D',
      color: '#fff',
    },

    stepCompleted: {
      backgroundColor: '#198754',
      color: '#fff',
    },

    stepPending: {
      backgroundColor: '#e9ecef',
      color: '#6c757d',
    },

    stepLine: {
      flex: 1,
      height: '2px',
      backgroundColor: '#e9ecef',
      margin: '0 0.5rem',
    },

    stepLineCompleted: {
      backgroundColor: '#198754',
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.container}>
          <div style={styles.logo}>
            <span style={styles.logoText}>Permisos</span>
            <span style={{ ...styles.logoText, ...styles.logoHighlight }}>Digitales</span>
          </div>
          <p style={styles.subtitle}>
            Sistema de Diseño - Plataforma de Permisos de Circulación Provisional
          </p>
        </div>
      </header>

      <nav style={styles.nav}>
        <div style={styles.container}>
          <div style={styles.navInner}>
            {['overview', 'permisos', 'pagos', 'mobile', 'formularios', 'estados'].map((tab) => (
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
          {activeTab === 'overview' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Visión General</h2>
                <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
                  Permisos Digitales es una plataforma para gestionar permisos de circulación provisional
                  en Huitzuco de los Figueroa, Guerrero. El diseño debe ser simple, accesible y 
                  optimizado para usuarios móviles.
                </p>

                <h3 style={{ marginBottom: '1rem' }}>Principios de Diseño</h3>
                <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                  <li><strong>Simplicidad:</strong> Interfaz clara sin elementos innecesarios</li>
                  <li><strong>Accesibilidad:</strong> Fácil de usar para todos los ciudadanos</li>
                  <li><strong>Mobile-first:</strong> Optimizado para teléfonos móviles</li>
                  <li><strong>Confiable:</strong> Transmite seguridad y profesionalismo</li>
                </ul>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Paleta de Colores</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ backgroundColor: '#B5384D', height: '80px', borderRadius: '8px', marginBottom: '0.5rem' }} />
                    <strong>Rojo Principal</strong><br />
                    <code>#B5384D</code>
                  </div>
                  <div>
                    <div style={{ backgroundColor: '#198754', height: '80px', borderRadius: '8px', marginBottom: '0.5rem' }} />
                    <strong>Verde Éxito</strong><br />
                    <code>#198754</code>
                  </div>
                  <div>
                    <div style={{ backgroundColor: '#ffc107', height: '80px', borderRadius: '8px', marginBottom: '0.5rem' }} />
                    <strong>Amarillo OXXO</strong><br />
                    <code>#ffc107</code>
                  </div>
                  <div>
                    <div style={{ backgroundColor: '#dc3545', height: '80px', borderRadius: '8px', marginBottom: '0.5rem' }} />
                    <strong>Rojo Error</strong><br />
                    <code>#dc3545</code>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'permisos' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Tarjetas de Permisos</h2>
                
                <div 
                  style={styles.permitCard}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.permitCardHover)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: '', transform: '' })}
                >
                  <div style={styles.permitHeader}>
                    <div>
                      <div style={styles.permitNumber}>PD-2025-001</div>
                      <div style={styles.vehicleInfo}>Toyota Corolla 2020 • Blanco</div>
                      <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                        Válido hasta: 31/12/2025
                      </div>
                    </div>
                    <div style={{ ...styles.permitStatus, ...styles.statusActive }}>
                      ✓ Activo
                    </div>
                  </div>
                  <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                    Ver Detalles →
                  </button>
                </div>

                <div style={styles.permitCard}>
                  <div style={styles.permitHeader}>
                    <div>
                      <div style={styles.permitNumber}>PD-2025-002</div>
                      <div style={styles.vehicleInfo}>Nissan Versa 2019 • Gris</div>
                      <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                        Esperando pago OXXO
                      </div>
                    </div>
                    <div style={{ ...styles.permitStatus, ...styles.statusPending }}>
                      ⏱ Pendiente
                    </div>
                  </div>
                  <button style={{ ...styles.button, ...styles.buttonOxxo }}>
                    <span style={styles.buttonIcon}>🏪</span> Ver Ficha OXXO
                  </button>
                </div>

                <div style={{ ...styles.permitCard, opacity: 0.7 }}>
                  <div style={styles.permitHeader}>
                    <div>
                      <div style={styles.permitNumber}>PD-2024-089</div>
                      <div style={styles.vehicleInfo}>Honda Civic 2018 • Negro</div>
                      <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                        Expiró: 31/12/2024
                      </div>
                    </div>
                    <div style={{ ...styles.permitStatus, ...styles.statusExpired }}>
                      ✕ Expirado
                    </div>
                  </div>
                  <button style={{ ...styles.button, ...styles.buttonSecondary }}>
                    Renovar Permiso
                  </button>
                </div>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Estados de Permisos</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ ...styles.permitStatus, ...styles.statusActive }}>
                    ✓ Activo
                  </div>
                  <div style={{ ...styles.permitStatus, ...styles.statusPending }}>
                    ⏱ Esperando Pago
                  </div>
                  <div style={{ ...styles.permitStatus, backgroundColor: '#cfe2ff', color: '#084298' }}>
                    ↻ Procesando
                  </div>
                  <div style={{ ...styles.permitStatus, ...styles.statusExpired }}>
                    ✕ Expirado
                  </div>
                  <div style={{ ...styles.permitStatus, backgroundColor: '#e2e3e5', color: '#41464b' }}>
                    ✕ Cancelado
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'pagos' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Métodos de Pago</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  <div style={{ ...styles.permitCard, textAlign: 'center' as const }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Tarjeta de Crédito/Débito</h3>
                    <p style={{ color: '#6c757d', marginBottom: '1rem' }}>
                      Pago inmediato con Visa, Mastercard o American Express
                    </p>
                    <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                      Pagar con Tarjeta
                    </button>
                  </div>

                  <div style={{ ...styles.permitCard, textAlign: 'center' as const }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏪</div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Pago en OXXO</h3>
                    <p style={{ color: '#6c757d', marginBottom: '1rem' }}>
                      Genera una ficha y paga en cualquier OXXO
                    </p>
                    <button 
                      style={{ ...styles.button, ...styles.buttonOxxo }}
                      onClick={() => setShowOxxoModal(true)}
                    >
                      Generar Ficha OXXO
                    </button>
                  </div>
                </div>
              </section>

              {showOxxoModal && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>Ficha de Pago OXXO</h2>
                  <div style={styles.oxxoSlip}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏪</div>
                    <div style={{ marginBottom: '0.5rem' }}>Referencia de pago:</div>
                    <div style={styles.oxxoReference}>1234 5678 9012 3456</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                      $500.00 MXN
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
                      Válido por 3 días (72 horas) • Vence: 28/06/2025 3:00 PM
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                      📄 Descargar PDF
                    </button>
                    <button style={{ ...styles.button, ...styles.buttonSecondary }}>
                      📧 Enviar por Correo
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'mobile' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Diseño Mobile</h2>
                
                <div style={{ maxWidth: '375px', margin: '0 auto', border: '16px solid #333', borderRadius: '36px', overflow: 'hidden' }}>
                  <div style={styles.mobileHeader}>
                    <button style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>☰</button>
                    <span style={{ fontWeight: '600' }}>Mis Permisos</span>
                    <button style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>👤</button>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', minHeight: '500px' }}>
                    <div style={styles.mobileCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>PD-2025-001</strong>
                        <span style={{ ...styles.permitStatus, ...styles.statusActive, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                          Activo
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                        Toyota Corolla 2020
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                        Válido hasta: 31/12/2025
                      </div>
                    </div>

                    <button style={{ 
                      ...styles.button, 
                      ...styles.buttonPrimary,
                      width: '100%',
                      justifyContent: 'center',
                      marginTop: '1rem',
                    }}>
                      + Nuevo Permiso
                    </button>
                  </div>

                  <div style={styles.bottomNav}>
                    <button style={{ ...styles.navButton, ...styles.navButtonActive }}>
                      <span style={{ fontSize: '1.5rem' }}>🏠</span>
                      <span>Inicio</span>
                    </button>
                    <button style={styles.navButton}>
                      <span style={{ fontSize: '1.5rem' }}>📄</span>
                      <span>Permisos</span>
                    </button>
                    <button style={styles.navButton}>
                      <span style={{ fontSize: '1.5rem' }}>➕</span>
                      <span>Nuevo</span>
                    </button>
                    <button style={styles.navButton}>
                      <span style={{ fontSize: '1.5rem' }}>👤</span>
                      <span>Perfil</span>
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'formularios' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Proceso de Solicitud</h2>
                
                <div style={styles.stepIndicator}>
                  <div style={styles.step}>
                    <div style={{ ...styles.stepNumber, ...styles.stepCompleted }}>✓</div>
                    <span style={{ fontSize: '0.875rem' }}>Datos Personales</span>
                    <div style={{ ...styles.stepLine, ...styles.stepLineCompleted }} />
                  </div>
                  <div style={styles.step}>
                    <div style={{ ...styles.stepNumber, ...styles.stepActive }}>2</div>
                    <span style={{ fontSize: '0.875rem' }}>Datos del Vehículo</span>
                    <div style={styles.stepLine} />
                  </div>
                  <div style={styles.step}>
                    <div style={{ ...styles.stepNumber, ...styles.stepPending }}>3</div>
                    <span style={{ fontSize: '0.875rem' }}>Pago</span>
                  </div>
                </div>

                <form style={{ maxWidth: '500px' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>Datos del Vehículo</h3>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Marca del Vehículo *</label>
                    <select style={styles.input}>
                      <option>Selecciona una marca</option>
                      <option>Toyota</option>
                      <option>Nissan</option>
                      <option>Honda</option>
                      <option>Volkswagen</option>
                      <option>Chevrolet</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Modelo *</label>
                    <input 
                      type="text" 
                      style={styles.input}
                      placeholder="Ej: Corolla"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Año *</label>
                      <input 
                        type="number" 
                        style={styles.input}
                        placeholder="2020"
                        min="1990"
                        max="2025"
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Color *</label>
                      <input 
                        type="text" 
                        style={styles.input}
                        placeholder="Ej: Blanco"
                      />
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Número de Placas *</label>
                    <input 
                      type="text" 
                      style={{ ...styles.input, textTransform: 'uppercase' }}
                      placeholder="ABC-123-45"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button 
                      type="button" 
                      style={{ ...styles.button, ...styles.buttonSecondary }}
                    >
                      ← Anterior
                    </button>
                    <button 
                      type="submit" 
                      style={{ ...styles.button, ...styles.buttonPrimary }}
                    >
                      Siguiente →
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {activeTab === 'estados' && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Mensajes y Notificaciones</h2>
                
                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#d1f2e8',
                  color: '#0f5132',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>✓</span>
                  <div>
                    <strong>¡Pago exitoso!</strong><br />
                    Tu permiso ha sido generado y está listo para descargar.
                  </div>
                </div>

                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#fff3cd',
                  color: '#664d03',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>⏱</span>
                  <div>
                    <strong>Pago pendiente</strong><br />
                    Tu ficha OXXO vence en 24 horas. Referencia: 1234-5678-9012
                  </div>
                </div>

                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>✕</span>
                  <div>
                    <strong>Error en el pago</strong><br />
                    No pudimos procesar tu tarjeta. Por favor intenta con otro método de pago.
                  </div>
                </div>

                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#cfe2ff',
                  color: '#084298',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
                  <div>
                    <strong>Tu permiso expira pronto</strong><br />
                    Tu permiso PD-2025-001 expira en 30 días. ¡No olvides renovarlo!
                  </div>
                </div>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Estados Vacíos</h2>
                
                <div style={{ textAlign: 'center' as const, padding: '3rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }}>📄</div>
                  <h3 style={{ marginBottom: '0.5rem' }}>No tienes permisos activos</h3>
                  <p style={{ color: '#6c757d', marginBottom: '1.5rem' }}>
                    Solicita tu primer permiso de circulación provisional
                  </p>
                  <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                    Solicitar Permiso
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default PermisosDesignSystem;