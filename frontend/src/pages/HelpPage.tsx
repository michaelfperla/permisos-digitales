import React from 'react';
import Card from '../components/ui/Card/Card';
import Accordion, { AccordionItem } from '../components/ui/Accordion/Accordion';
import styles from './HelpPage.module.css';

const HelpPage: React.FC = () => {
  const faqData: AccordionItem[] = [
    {
      id: 'solicitud',
      title: '¿Cómo solicito un permiso vehicular?',
      content: (
        <div>
          <p>Para solicitar un permiso vehicular, sigue estos pasos:</p>
          <ol>
            <li>Regístrate en la plataforma o inicia sesión si ya tienes cuenta</li>
            <li>Haz clic en "Nuevo Permiso" o "Solicitar Permiso"</li>
            <li>Completa el formulario con la información requerida</li>
            <li>Sube los documentos necesarios</li>
            <li>Realiza el pago correspondiente</li>
            <li>Recibe la confirmación y sigue el estado de tu solicitud</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'documentos',
      title: '¿Qué documentos necesito para solicitar un permiso?',
      content: (
        <div>
          <p>Los documentos requeridos incluyen:</p>
          <ul>
            <li>Identificación oficial vigente (INE, pasaporte o cédula profesional)</li>
            <li>Licencia de conducir vigente</li>
            <li>Tarjeta de circulación del vehículo</li>
            <li>Póliza de seguro vigente</li>
            <li>Comprobante de domicilio (no mayor a 3 meses)</li>
          </ul>
          <p><strong>Nota:</strong> Los documentos pueden variar según el tipo de permiso solicitado.</p>
        </div>
      ),
    },
    {
      id: 'pagos',
      title: '¿Qué métodos de pago aceptan?',
      content: (
        <div>
          <p>Aceptamos los siguientes métodos de pago:</p>
          <ul>
            <li><strong>Tarjetas de crédito:</strong> Visa, MasterCard, American Express</li>
            <li><strong>Tarjetas de débito:</strong> Con tecnología de pago seguro</li>
            <li><strong>OXXO:</strong> Pago en efectivo en tiendas OXXO</li>
            <li><strong>Transferencia bancaria:</strong> Transferencias SPEI</li>
          </ul>
          <p>Todos los pagos son procesados de forma segura y están protegidos por encriptación SSL.</p>
        </div>
      ),
    },
    {
      id: 'seguimiento',
      title: '¿Cómo puedo dar seguimiento a mi solicitud?',
      content: (
        <div>
          <p>Puedes dar seguimiento a tu solicitud de varias maneras:</p>
          <ul>
            <li>Ingresa a tu cuenta y ve a la sección "Mis Permisos"</li>
            <li>Recibirás notificaciones por correo electrónico sobre cambios de estado</li>
            <li>Puedes ver el progreso en tiempo real desde tu dashboard</li>
            <li>Contacta a nuestro equipo de soporte para consultas específicas</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'tiempos',
      title: '¿Cuánto tiempo tarda el proceso?',
      content: (
        <div>
          <p>Los tiempos de procesamiento varían según el tipo de permiso:</p>
          <ul>
            <li><strong>Permisos temporales:</strong> 1-3 días hábiles</li>
            <li><strong>Permisos anuales:</strong> 3-5 días hábiles</li>
            <li><strong>Permisos especiales:</strong> 5-10 días hábiles</li>
          </ul>
          <p>Estos tiempos pueden extenderse durante temporadas de alta demanda o si se requiere documentación adicional.</p>
        </div>
      ),
    },
    {
      id: 'problemas',
      title: '¿Qué hago si tengo problemas con mi solicitud?',
      content: (
        <div>
          <p>Si experimentas algún problema:</p>
          <ol>
            <li>Verifica que todos los documentos estén completos y legibles</li>
            <li>Revisa el estado de tu solicitud en tu dashboard</li>
            <li>Contacta a nuestro equipo de soporte:</li>
          </ol>
          <ul>
            <li><strong>Email:</strong> soporte@permisosdigitales.com</li>
            <li><strong>Teléfono:</strong> 55-1234-5678</li>
            <li><strong>Chat en vivo:</strong> Disponible en horario de oficina</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.helpPage}>
      <div className={styles.container}>
        <Card className={styles.headerCard}>
          <div className={styles.header}>
            <h1 className={styles.title}>Centro de Ayuda</h1>
            <p className={styles.subtitle}>
              Encuentra respuestas a las preguntas más frecuentes sobre nuestros servicios
            </p>
          </div>
        </Card>

        <Card className={styles.contentCard}>
          <h2 className={styles.sectionTitle}>Preguntas Frecuentes</h2>
          <Accordion items={faqData} />
        </Card>

        <Card className={styles.contactCard}>
          <h2 className={styles.sectionTitle}>¿Necesitas más ayuda?</h2>
          <div className={styles.contactGrid}>
            <div className={styles.contactMethod}>
              <h3 className={styles.contactTitle}>Correo Electrónico</h3>
              <p className={styles.contactInfo}>soporte@permisosdigitales.com</p>
              <p className={styles.contactDescription}>
                Respuesta en 24-48 horas hábiles
              </p>
            </div>
            
            <div className={styles.contactMethod}>
              <h3 className={styles.contactTitle}>WhatsApp</h3>
              <p className={styles.contactInfo}>+52 55 4943 0313</p>
              <p className={styles.contactDescription}>
                Lunes a Domingo: 9:00 AM - 6:00 PM
              </p>
            </div>
            
            <div className={styles.contactMethod}>
              <h3 className={styles.contactTitle}>Chat en Vivo</h3>
              <p className={styles.contactInfo}>Disponible en la plataforma</p>
              <p className={styles.contactDescription}>
                Respuesta inmediata en horario de oficina
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HelpPage;