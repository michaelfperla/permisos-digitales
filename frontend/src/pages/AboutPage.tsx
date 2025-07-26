import React from 'react';
import Card from '../components/ui/Card/Card';
import styles from './AboutPage.module.css';

const AboutPage: React.FC = () => {
  return (
    <div className={styles.aboutPage}>
      <div className={styles.container}>
        <Card className={styles.contentCard}>
          <div className={styles.header}>
            <h1 className={styles.title}>Acerca de Permisos Digitales</h1>
            <p className={styles.subtitle}>
              Plataforma digital para la gestión de permisos vehiculares
            </p>
          </div>

          <div className={styles.content}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>¿Qué es Permisos Digitales?</h2>
              <p className={styles.text}>
                Permisos Digitales es una plataforma moderna que facilita la solicitud, 
                gestión y seguimiento de permisos vehiculares de manera completamente digital. 
                Nuestro objetivo es simplificar los procesos administrativos y brindar una 
                experiencia más eficiente para los usuarios.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Características principales</h2>
              <ul className={styles.featureList}>
                <li className={styles.feature}>
                  <strong>Solicitud en línea:</strong> Realiza tus solicitudes de permisos 
                  desde cualquier dispositivo, las 24 horas del día.
                </li>
                <li className={styles.feature}>
                  <strong>Seguimiento en tiempo real:</strong> Monitorea el estado de tu 
                  solicitud en cada etapa del proceso.
                </li>
                <li className={styles.feature}>
                  <strong>Pagos seguros:</strong> Procesamiento seguro de pagos con múltiples 
                  opciones de pago.
                </li>
                <li className={styles.feature}>
                  <strong>Documentos digitales:</strong> Recibe y almacena tus permisos 
                  de forma digital y segura.
                </li>
                <li className={styles.feature}>
                  <strong>Soporte multicanal:</strong> Asistencia disponible a través de 
                  diferentes medios de comunicación.
                </li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Nuestra misión</h2>
              <p className={styles.text}>
                Transformar la gestión de permisos vehiculares mediante tecnología innovadora, 
                ofreciendo un servicio confiable, eficiente y accesible que mejore la experiencia 
                de los usuarios y optimice los procesos administrativos.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Compromiso con la seguridad</h2>
              <p className={styles.text}>
                La seguridad y privacidad de tus datos es nuestra prioridad. Utilizamos 
                las mejores prácticas de seguridad informática y cumplimos con todas las 
                regulaciones de protección de datos aplicables.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AboutPage;