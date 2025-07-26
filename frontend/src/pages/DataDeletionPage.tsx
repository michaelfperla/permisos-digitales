import React, { useState } from 'react';
import { FaTrashAlt, FaDownload, FaExclamationTriangle, FaHome, FaEnvelope, FaFileAlt, FaShieldAlt } from 'react-icons/fa';

import styles from './LegalPage.module.css';
import Footer from '../components/layout/Footer';
import AppHeaderMobile, { NavLinkItem } from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import StandardDesktopHeader, {
  HeaderNavLink,
} from '../components/navigation/StandardDesktopHeader';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon/Icon';
import Button from '../components/ui/Button/Button';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';
import { useToast } from '../shared/hooks/useToast';
import { deleteAccount, requestDataExport } from '../services/userService';

const DataDeletionPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    reason: '',
    confirmText: '',
  });

  const mobileNavLinks: NavLinkItem[] = [
    { to: '/', label: 'Inicio', icon: <Icon IconComponent={FaHome} size="sm" /> },
    { to: '/contacto', label: 'Contacto', icon: <Icon IconComponent={FaEnvelope} size="sm" /> },
    { to: '/terminos-y-condiciones', label: 'Términos y Condiciones', icon: <Icon IconComponent={FaFileAlt} size="sm" /> },
    { to: '/politica-de-privacidad', label: 'Política de Privacidad', icon: <Icon IconComponent={FaShieldAlt} size="sm" /> },
    { to: '/login', label: 'Iniciar Sesión', type: 'button-primary' },
    { to: '/register', label: 'Registrarse', type: 'button-secondary' },
  ];

  const desktopNavLinks: HeaderNavLink[] = [
    { to: '/login', label: 'Iniciar Sesión', type: 'link' },
    { to: '/register', label: 'Registrarse', type: 'button-secondary' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.confirmText.toLowerCase() !== 'eliminar') {
      showToast('Debe escribir "eliminar" para confirmar la solicitud', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Debug authentication status
      console.log('Auth status:', { isAuthenticated, user: user?.email });
      
      if (isAuthenticated && user) {
        // For authenticated users, use API directly
        const result = await deleteAccount({
          confirmEmail: formData.email,
          deleteReason: formData.reason
        });

        if (result.success) {
          showToast('Su cuenta ha sido eliminada exitosamente. Será redirigido al inicio.', 'success');
          
          // Clear form and redirect after a delay
          setFormData({
            email: '',
            name: '',
            reason: '',
            confirmText: '',
          });
          
          // Redirect to home page after 3 seconds
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          showToast(result.message, 'error');
        }
      } else {
        // For non-authenticated users, create email request as fallback
        const emailSubject = 'SOLICITUD DE ELIMINACIÓN DE CUENTA';
        const emailBody = `
Solicitud de eliminación de datos personales:

Nombre completo: ${formData.name}
Correo electrónico registrado: ${formData.email}
Motivo de eliminación: ${formData.reason || 'No especificado'}

Fecha de solicitud: ${new Date().toLocaleDateString('es-MX')}
Hora de solicitud: ${new Date().toLocaleTimeString('es-MX')}

Esta solicitud fue enviada desde: https://permisosdigitales.com.mx/eliminar-datos

CONFIRMACIÓN: El usuario escribió "eliminar" para confirmar esta acción irreversible.

NOTA: Esta solicitud fue enviada por un usuario no autenticado. Verificar identidad antes de procesar.
        `.trim();

        const mailtoUrl = `mailto:contacto@permisosdigitales.com.mx?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.location.href = mailtoUrl;

        showToast('Se ha abierto su cliente de correo. Envíe el mensaje para procesar su solicitud manualmente.', 'info');
        
        // Reset form
        setFormData({
          email: '',
          name: '',
          reason: '',
          confirmText: '',
        });
      }
    } catch (error) {
      showToast('Error al procesar la solicitud. Por favor intente nuevamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDataExport = async () => {
    if (!isAuthenticated) {
      showToast('Debe iniciar sesión para exportar sus datos', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestDataExport();
      
      if (result.success) {
        // Create and download the JSON file
        const dataStr = JSON.stringify(result.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `permisos-digitales-datos-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Sus datos han sido descargados exitosamente', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      showToast('Error al exportar datos. Por favor intente nuevamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.legalPageContainer}>
      {!isAuthenticated && (
        isMdDown ? (
          <AppHeaderMobile logoPath="/" navLinks={mobileNavLinks} />
        ) : (
          <StandardDesktopHeader logoPath="/" navLinks={desktopNavLinks} />
        )
      )}

      <main className={isAuthenticated ? styles.legalContentNoHeader : styles.legalContent}>
        <h1 className={styles.legalTitle}>ELIMINACIÓN DE DATOS PERSONALES</h1>
        <p className={styles.legalDate}>Permisos Digitales - Eliminación de Cuenta</p>

        <section className={styles.legalSection}>
          <div className="alert-warning" style={{ 
            padding: '16px', 
            backgroundColor: '#fff3cd', 
            border: '1px solid #ffeaa7', 
            borderRadius: '8px', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <FaExclamationTriangle style={{ color: '#856404', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#856404', fontSize: '16px' }}>
                ⚠️ ACCIÓN IRREVERSIBLE
              </h3>
              <p style={{ margin: 0, color: '#856404', fontSize: '14px' }}>
                La eliminación de su cuenta es permanente e irreversible. Una vez procesada, no podrá recuperar su información personal ni historial de permisos.
              </p>
            </div>
          </div>

          <p>
            Esta página le permite solicitar la eliminación completa de su cuenta y datos personales 
            de acuerdo con sus derechos de protección de datos bajo la legislación mexicana y para 
            cumplir con los requisitos de WhatsApp Business API.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>¿QUÉ DATOS SE ELIMINARÁN?</h2>
          <ul className={styles.legalList}>
            <li>✅ Información personal del perfil (nombre, correo, teléfono)</li>
            <li>✅ Historial de conversaciones de WhatsApp</li>
            <li>✅ Preferencias y configuraciones de cuenta</li>
            <li>✅ Datos de contacto y notificaciones</li>
            <li>✅ Registros de consentimiento para WhatsApp</li>
          </ul>

          <h3>Datos que se conservarán (por obligación legal):</h3>
          <ul className={styles.legalList}>
            <li>📋 Facturas y comprobantes fiscales (5 años - SAT)</li>
            <li>📋 Permisos vigentes hasta su vencimiento natural</li>
            <li>📋 Registros mínimos para prevención de fraude</li>
          </ul>
        </section>

        <section className={styles.legalSection}>
          <h2>ALTERNATIVAS ANTES DE ELIMINAR</h2>
          
          <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              padding: '16px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                <FaDownload style={{ marginRight: '8px' }} />
                Exportar Datos Primero
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>
                Descargue una copia de toda su información antes de eliminar permanentemente su cuenta.
              </p>
              <Button
                variant="secondary"
                size="small"
                onClick={handleDataExport}
                icon={<FaDownload />}
              >
                Solicitar Exportación
              </Button>
            </div>

            <div style={{ 
              padding: '16px', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>Solo Desactivar WhatsApp</h4>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                Si solo quiere dejar de recibir notificaciones de WhatsApp, envíe "STOP" 
                a nuestro número +52 55 4943 0313. Su cuenta permanecerá activa.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.legalSection}>
          <h2>SOLICITUD DE ELIMINACIÓN</h2>
          
          {isAuthenticated ? (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb', 
              borderRadius: '8px', 
              marginBottom: '24px' 
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#155724' }}>
                ✅ Usuario Autenticado - Eliminación Directa
              </h4>
              <p style={{ margin: 0, color: '#155724', fontSize: '14px' }}>
                Como usuario autenticado, su cuenta será eliminada inmediatamente al enviar este formulario.
              </p>
            </div>
          ) : (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '8px', 
              marginBottom: '24px' 
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>
                📧 Usuario No Autenticado - Solicitud por Email
              </h4>
              <p style={{ margin: 0, color: '#856404', fontSize: '14px' }}>
                Como no ha iniciado sesión, se enviará una solicitud por email que será procesada manualmente.
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Correo electrónico registrado *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="correo@ejemplo.com"
                disabled={!!(isAuthenticated && user)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: isAuthenticated && user ? '#f8f9fa' : 'white',
                  cursor: isAuthenticated && user ? 'not-allowed' : 'text'
                }}
              />
              {isAuthenticated && user && (
                <p style={{ 
                  margin: '4px 0 0 0', 
                  fontSize: '12px', 
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  Correo de su cuenta actual (no se puede modificar)
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Nombre completo *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Su nombre completo como aparece en su cuenta"
                disabled={!!(isAuthenticated && user)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: isAuthenticated && user ? '#f8f9fa' : 'white',
                  cursor: isAuthenticated && user ? 'not-allowed' : 'text'
                }}
              />
              {isAuthenticated && user && (
                <p style={{ 
                  margin: '4px 0 0 0', 
                  fontSize: '12px', 
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  Nombre de su cuenta actual (no se puede modificar)
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Motivo de eliminación (opcional)
              </label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccione un motivo</option>
                <option value="Ya no necesito el servicio">Ya no necesito el servicio</option>
                <option value="Preocupaciones de privacidad">Preocupaciones de privacidad</option>
                <option value="Demasiadas notificaciones">Demasiadas notificaciones</option>
                <option value="Problemas técnicos">Problemas técnicos</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Para confirmar, escriba "eliminar" *
              </label>
              <input
                type="text"
                name="confirmText"
                value={formData.confirmText}
                onChange={handleInputChange}
                required
                placeholder="Escriba exactamente: eliminar"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <p style={{ 
                margin: '4px 0 0 0', 
                fontSize: '12px', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                Esta confirmación es necesaria para procesar la eliminación
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || formData.confirmText.toLowerCase() !== 'eliminar'}
              icon={<FaTrashAlt />}
              style={{ 
                backgroundColor: '#dc3545',
                borderColor: '#dc3545'
              }}
            >
              {isSubmitting ? 'Procesando...' : isAuthenticated ? 'Eliminar Cuenta Ahora' : 'Enviar Solicitud por Email'}
            </Button>
          </form>
        </section>

        <section className={styles.legalSection}>
          <h2>PROCESO Y TIEMPOS</h2>
          
          {isAuthenticated ? (
            <div>
              <h3>Para Usuarios Autenticados:</h3>
              <ol className={styles.legalList}>
                <li>⚡ La eliminación se procesa inmediatamente</li>
                <li>✅ Cuenta desactivada al instante</li>
                <li>📧 Confirmación enviada por correo</li>
                <li>🗂️ Datos requeridos por ley permanecen archivados</li>
                <li>🚫 Acceso revocado permanentemente</li>
              </ol>
            </div>
          ) : (
            <div>
              <h3>Para Usuarios No Autenticados:</h3>
              <ol className={styles.legalList}>
                <li>📧 Su solicitud será enviada por correo electrónico</li>
                <li>✅ Recibirá confirmación en un plazo de 48 horas</li>
                <li>🔍 Verificaremos su identidad y validaremos la solicitud</li>
                <li>⏱️ La eliminación se procesará en 5-7 días hábiles</li>
                <li>📨 Le notificaremos cuando el proceso esté completo</li>
              </ol>
            </div>
          )}

          <h3>Restricciones:</h3>
          <ul className={styles.legalList}>
            <li>❌ No se puede procesar si tiene permisos activos vigentes</li>
            <li>❌ No se puede procesar si tiene pagos pendientes</li>
            <li>❌ Los datos requeridos por ley permanecerán archivados</li>
          </ul>
        </section>

        <section className={styles.legalSection}>
          <h2>CONTACTO</h2>
          <p>
            Para dudas sobre este proceso o ejercer otros derechos de protección de datos:
          </p>
          <p><strong>Correo:</strong> contacto@permisosdigitales.com.mx</p>
          <p><strong>WhatsApp:</strong> +52 55 4943 0313</p>
          <p>
            <strong>Dirección:</strong> Palacio Municipal S/N, Col. Centro, C.P. 40130, 
            Huitzuco de los Figueroa, Guerrero
          </p>
        </section>

        <div className={styles.legalFootnote}>
          <p>
            Esta página cumple con los requisitos de WhatsApp Business API para la eliminación 
            de datos de usuarios. Última actualización: {new Date().toLocaleDateString('es-MX')}
          </p>
        </div>
      </main>

      {!isAuthenticated && <Footer />}
    </div>
  );
};

export default DataDeletionPage;