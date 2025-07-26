import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaEnvelope, FaFileAlt, FaShieldAlt } from 'react-icons/fa';

import styles from './LegalPage.module.css';
import Footer from '../components/layout/Footer';
import AppHeaderMobile, { NavLinkItem } from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import StandardDesktopHeader, {
  HeaderNavLink,
} from '../components/navigation/StandardDesktopHeader';
import useResponsive from '../hooks/useResponsive';
import Icon from '../shared/components/ui/Icon/Icon';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';

const TermsAndConditionsPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  const { isAuthenticated } = useAuth();
  const currentDate = new Date().toLocaleDateString('es-MX');

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
        <h1 className={styles.legalTitle}>
          TÉRMINOS Y CONDICIONES DE USO – PERMISO DIGITAL DE CIRCULACIÓN PROVISIONAL
        </h1>
        <p className={styles.legalDate}>Fecha de Última Actualización: {currentDate}</p>

        <section className={styles.legalSection}>
          <p>
            Bienvenido a la plataforma de emisión de Permisos Digitales de Circulación Provisional
            (en adelante, la &quot;Plataforma&quot;) operada por la Dirección de Tránsito del H. Ayuntamiento
            de Huitzuco de los Figueroa, Guerrero (en adelante, &quot;Nosotros&quot; o la &quot;Autoridad
            Emisora&quot;).
          </p>
          <p>
            Estos Términos y Condiciones (en adelante, los &quot;Términos&quot;) rigen el acceso y uso de la
            Plataforma y la solicitud, emisión y uso de los Permisos Digitales de Circulación
            Provisional (en adelante, el &quot;Permiso&quot;) para vehículos automotores. Al solicitar,
            obtener o utilizar un Permiso a través de esta Plataforma, usted (en adelante, el
            &quot;Usuario&quot;) acepta y se obliga a cumplir con los presentes Términos en su totalidad. Si
            no está de acuerdo con estos Términos, no deberá utilizar la Plataforma ni solicitar un
            Permiso.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>1. OBJETO DEL PERMISO</h2>
          <p>
            El Permiso es un documento digital oficial de carácter provisional que autoriza la
            circulación de un vehículo automotor particular dentro del territorio especificado y por
            el periodo indicado, en tanto el Usuario gestiona y obtiene la documentación vehicular
            definitiva (placas, tarjeta de circulación, engomado).
          </p>
          <p>
            1.1. El Permiso es válido únicamente para vehículos de uso particular. No ampara
            vehículos de transporte público, de carga (salvo excepciones especificadas por la
            Autoridad Emisora), o aquellos con restricciones legales para su circulación.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>2. VIGENCIA Y VALIDEZ</h2>
          <p>
            2.1. La validez del Permiso es de 30 (treinta) días naturales, contados a partir de la
            fecha de emisión consignada en el mismo.
          </p>
          <p>
            2.2. Durante la vigencia del Permiso, y siempre que se cumplan todas las condiciones
            aquí establecidas y las disposiciones de tránsito aplicables, el vehículo podrá circular
            sin portar placas físicas, engomado, ni tarjeta de circulación física, siendo el Permiso
            impreso y/o su certificado de autenticidad los documentos que acreditan la autorización
            para circular.
          </p>
          <p>
            2.3. El Permiso digital tiene la misma validez legal que un permiso físico tradicional,
            respaldado por la firma electrónica avanzada de la autoridad emisora.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>3. PROCESO DE EMISIÓN Y SOLICITUD</h2>
          <p>
            3.1. El Usuario es el único responsable de la veracidad, exactitud y legitimidad de la
            información y documentación proporcionada durante el proceso de solicitud del Permiso.
            Cualquier falsedad u omisión podrá invalidar el Permiso y sujetar al Usuario a las
            sanciones correspondientes.
          </p>
          <p>
            3.2. Horario de Emisión y Días Inhábiles: El sistema de emisión de la Plataforma opera
            de manera continua. Sin embargo, para efectos de la fecha de inicio de vigencia del
            Permiso:
          </p>
          <p className={styles.legalIndent}>
            a. Los Permisos solicitados y pagados (con pago confirmado) en días sábado o domingo
            podrán ser emitidos con fecha de inicio de vigencia del día viernes inmediato anterior.
          </p>
          <p className={styles.legalIndent}>
            b. El Usuario podrá, en algunos casos, recibir una notificación con la opción de emitir
            su Permiso con fecha del día lunes siguiente a su solicitud. En este supuesto, el
            Usuario reconoce y acepta que el vehículo podría no contar con cobertura legal para
            circular durante los días sábado y domingo intermedios si el permiso anterior ha
            vencido.
          </p>
          <p>
            3.3. La Autoridad Emisora se reserva el derecho de rechazar cualquier solicitud de
            Permiso que no cumpla con los requisitos establecidos o si se detectan irregularidades.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>4. OBLIGACIONES DEL USUARIO</h2>
          <p>
            4.1. Portación y Visibilidad: Una vez emitido, el Permiso debe ser impreso a color.
            Deberá colocarse en un lugar visible en el interior del vehículo (generalmente en el
            parabrisas delantero o medallón trasero). Para motocicletas, se recomienda su enmicado
            para protegerlo de las inclemencias del tiempo y portarlo junto con la documentación del
            conductor.
          </p>
          <p>
            4.2. Retiro de Placas Anteriores: Mientras el Permiso esté vigente, es obligatorio que
            el vehículo NO porte placas físicas de ninguna entidad federativa ni la tarjeta de
            circulación asociada a dichas placas. El Permiso sustituye provisionalmente esta
            documentación.
          </p>
          <p>
            4.3. Verificación de Autenticidad: El Usuario y cualquier autoridad competente podrán
            verificar la autenticidad del Permiso a través de:
          </p>
          <p className={styles.legalIndent}>a. El escaneo del código QR impreso en el Permiso.</p>
          <p className={styles.legalIndent}>
            b. La presentación del certificado de autenticidad digital que acompaña al Permiso.
          </p>
          <p className={styles.legalIndent}>
            c. Ingresando el folio del Permiso en la página web oficial de verificación:{' '}
            <a
              href="https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/verificar-permiso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/verificar-permiso
            </a>
          </p>
          <p>
            4.4. Cumplimiento Normativo: Es responsabilidad exclusiva del Usuario conocer y cumplir
            con el Reglamento de Tránsito vigente en la(s) localidad(es) donde circule, incluyendo
            horarios, días permitidos, restricciones ambientales (ej. &quot;Hoy No Circula&quot; si aplicara),
            y cualquier otra condición para la circulación de vehículos con permiso provisional.
          </p>
          <p>
            4.5. Uso Personal e Intransferible: El Permiso es para el vehículo especificado en el
            mismo y no es transferible a otro vehículo o persona.
          </p>
          <p>
            4.6. No Alteración: Queda estrictamente prohibido alterar, modificar o falsificar el
            Permiso. Dichas acciones constituyen un delito y serán sancionadas conforme a la ley.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>5. RESPONSABILIDAD Y EXCLUSIONES</h2>
          <p>
            5.1. La Autoridad Emisora no se hace responsable por el uso indebido o fraudulento del
            Permiso por parte del Usuario o terceros.
          </p>
          <p>
            5.2. La Autoridad Emisora no será responsable por infracciones de tránsito, multas,
            sanciones, o cualquier consecuencia legal o económica derivada del desconocimiento,
            negligencia o incumplimiento por parte del Usuario de los presentes Términos, del
            Reglamento de Tránsito aplicable, o de cualquier otra disposición legal.
          </p>
          <p>
            5.3. La Plataforma se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos
            que la Plataforma esté libre de errores o interrupciones.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>6. RENOVACIÓN DEL PERMISO</h2>
          <p>
            6.1. El Usuario podrá solicitar la renovación de su Permiso hasta 3 días antes de la
            fecha de vencimiento del mismo.
          </p>
          <p>
            6.2. La renovación implica la emisión de un nuevo Permiso y el pago correspondiente.
          </p>
          <p>
            6.3. La Autoridad Emisora se reserva el derecho de limitar el número de renovaciones
            consecutivas para un mismo vehículo, con el fin de promover la regularización definitiva
            del mismo.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>7. REQUISITOS TÉCNICOS</h2>
          <p>
            7.1. Para acceder a la Plataforma y visualizar correctamente el Permiso digital, se
            recomienda utilizar navegadores web actualizados como Chrome, Firefox, Safari o Edge.
          </p>
          <p>
            7.2. Para la impresión del Permiso se requiere un lector de archivos PDF (como Adobe
            Reader o similar) y una impresora a color.
          </p>
          <p>
            7.3. Para la verificación mediante código QR, se requiere un dispositivo con cámara y
            aplicación de lectura de códigos QR.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>8. CANCELACIONES Y DEVOLUCIONES</h2>
          <p>
            <strong>8.1. Política de No Cancelación:</strong> Una vez que el Permiso Digital de
            Circulación Provisional ha sido emitido y entregado al Usuario, NO se aceptarán
            cancelaciones ni se realizarán devoluciones del pago efectuado.
          </p>
          <p>
            <strong>8.2. Carácter Definitivo del Pago:</strong> El pago realizado por el Usuario
            para la obtención del Permiso tiene carácter definitivo e irrevocable. Al completar
            el proceso de pago, el Usuario acepta expresamente esta condición.
          </p>
          <p>
            <strong>8.3. Justificación:</strong> Esta política se fundamenta en que:
          </p>
          <ul className={styles.legalList}>
            <li>El Permiso es un documento oficial que se genera inmediatamente tras el pago confirmado.</li>
            <li>Los recursos administrativos y tecnológicos se emplean de manera inmediata para la emisión.</li>
            <li>El documento otorga derechos de circulación que entran en vigor de forma inmediata.</li>
            <li>La naturaleza del servicio público no permite reversión una vez prestado.</li>
          </ul>
          <p>
            <strong>8.4. Excepciones:</strong> Únicamente en casos de error técnico comprobable
            del sistema o duplicación involuntaria de pagos, se evaluará la procedencia de
            ajustes, previa verificación y autorización de la Autoridad Emisora.
          </p>
          <p>
            <strong>8.5. Derechos del Consumidor:</strong> Sin perjuicio de lo anterior, el Usuario
            conserva sus derechos como consumidor conforme a la Ley Federal de Protección al
            Consumidor, en lo que resulte aplicable a servicios públicos digitales.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>9. LIMITACIÓN DE RESPONSABILIDAD</h2>
          <p>
            <strong>9.1. Alcance del Servicio:</strong> La Autoridad Emisora se limita a proporcionar
            el servicio de emisión de Permisos Digitales de Circulación Provisional conforme a la
            normatividad aplicable. No garantiza que el Permiso exima al Usuario de cumplir con
            otras obligaciones legales o administrativas relacionadas con la circulación vehicular.
          </p>
          <p>
            <strong>9.2. Responsabilidad del Usuario:</strong> El Usuario es el único responsable del
            uso adecuado del Permiso y del cumplimiento de las disposiciones de tránsito vigentes.
            La Autoridad Emisora no se hace responsable por infracciones, accidentes o daños que
            pudieran derivarse del uso del vehículo durante la vigencia del Permiso.
          </p>
          <p>
            <strong>9.3. Disponibilidad del Sistema:</strong> Si bien procuramos mantener la
            Plataforma disponible las 24 horas, no garantizamos su funcionamiento ininterrumpido
            debido a mantenimientos programados, fallas técnicas o causas de fuerza mayor.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>10. PROTECCIÓN DE DATOS PERSONALES</h2>
          <p>
            El tratamiento de los datos personales proporcionados por el Usuario para la emisión del
            Permiso se regirá por nuestro{' '}
            <Link to="/politica-de-privacidad">Aviso de Privacidad</Link>. Al solicitar un Permiso,
            el Usuario manifiesta haber leído, entendido y aceptado dicho Aviso de Privacidad.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>11. MODIFICACIONES A LOS TÉRMINOS</h2>
          <p>
            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Cualquier
            modificación será efectiva a partir de su publicación en la Plataforma. Es
            responsabilidad del Usuario revisar periódicamente estos Términos. El uso continuado de
            un Permiso emitido o la solicitud de nuevos Permisos después de la publicación de
            cambios constituirá su aceptación de dichas modificaciones.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>12. LEY APLICABLE Y JURISDICCIÓN</h2>
          <p>
            Estos Términos se regirán e interpretarán de conformidad con las leyes vigentes en los
            Estados Unidos Mexicanos y, en particular, del Estado de Guerrero. Para cualquier
            controversia derivada de la interpretación o cumplimiento de estos Términos, las partes
            se someten expresamente a la jurisdicción de los tribunales competentes en la ciudad de
            Huitzuco de los Figueroa, Guerrero, renunciando a cualquier otro fuero que pudiera
            corresponderles por razón de sus domicilios presentes o futuros.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>13. SERVICIO DE NOTIFICACIONES POR WHATSAPP</h2>
          
          <h3>13.1. Naturaleza del Servicio</h3>
          <p>
            El servicio de notificaciones por WhatsApp es opcional y complementario. Su objetivo es mantener informado al Usuario sobre el estado de su solicitud de permiso mediante mensajes transaccionales automatizados.
          </p>

          <h3>13.2. Consentimiento y Activación</h3>
          <p>
            Al proporcionar su número de WhatsApp durante el registro o solicitud, el Usuario otorga su consentimiento expreso para recibir notificaciones relacionadas exclusivamente con su trámite de permiso.
          </p>

          <h3>13.3. Tipos de Mensajes</h3>
          <p>El Usuario recibirá únicamente:</p>
          <ul className={styles.legalList}>
            <li>Confirmaciones de solicitud recibida</li>
            <li>Actualizaciones del estado del trámite</li>
            <li>Notificaciones de documentos listos para descarga</li>
            <li>Recordatorios de vencimiento (cuando aplique)</li>
          </ul>

          <h3>13.4. Revocación de Consentimiento (Opt-Out)</h3>
          <p>
            El Usuario puede revocar su consentimiento en cualquier momento mediante cualquiera de los siguientes métodos:
          </p>

          <h4>Comandos de Baja Inmediata:</h4>
          <p>Envíe cualquiera de los siguientes comandos a nuestro número de WhatsApp:</p>
          <ul className={styles.legalList}>
            <li><strong>"STOP"</strong></li>
            <li><strong>"BAJA"</strong></li>
            <li><strong>"DETENER"</strong></li>
            <li><strong>"CANCELAR SUSCRIPCION"</strong></li>
            <li><strong>"NO MAS MENSAJES"</strong></li>
          </ul>

          <h3>13.5. Procesamiento de la Baja</h3>
          <ul className={styles.legalList}>
            <li>La baja es procesada automáticamente e inmediatamente</li>
            <li>Se enviará un único mensaje de confirmación de baja</li>
            <li>Su número será agregado permanentemente a nuestra lista de exclusión</li>
            <li>No se enviarán más mensajes después de la confirmación</li>
            <li>Las notificaciones importantes continuarán por correo electrónico</li>
            <li>Para reactivar, debe hacerlo desde la plataforma web</li>
          </ul>

          <h3>13.6. Lista de Exclusión Permanente</h3>
          <ul className={styles.legalList}>
            <li>Los números dados de baja se mantienen en una lista de exclusión permanente</li>
            <li>Esta lista previene el reenvío accidental de mensajes</li>
            <li>La reactivación requiere consentimiento explícito a través de la web</li>
            <li>La lista de exclusión se mantiene incluso si crea una nueva cuenta</li>
          </ul>

          <h3>13.7. Limitaciones del Servicio</h3>
          <p>
            La Autoridad Emisora no garantiza la entrega inmediata de mensajes de WhatsApp debido a factores técnicos externos. Las notificaciones por correo electrónico siguen siendo el medio oficial de comunicación.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>14. PROTECCIÓN DE DATOS Y DERECHOS DEL USUARIO</h2>

          <h3>14.1. Exportación de Datos</h3>
          <p>El Usuario tiene derecho a solicitar una copia de todos sus datos:</p>
          <ul className={styles.legalList}>
            <li>Envíe correo a contacto@permisosdigitales.com.mx con asunto "SOLICITUD DE EXPORTACIÓN DE DATOS"</li>
            <li>Incluya su correo electrónico registrado y nombre completo</li>
            <li>Recibirá sus datos en formato JSON en un plazo de 48 horas</li>
            <li>Incluye: perfil, permisos, pagos, notificaciones de WhatsApp</li>
          </ul>

          <h3>14.2. Eliminación de Cuenta</h3>
          <p>El Usuario puede solicitar la eliminación permanente de su cuenta:</p>
          <ul className={styles.legalList}>
            <li>Envíe correo a contacto@permisosdigitales.com.mx con asunto "SOLICITUD DE ELIMINACIÓN DE CUENTA"</li>
            <li>Esta acción es irreversible una vez procesada</li>
            <li>Se eliminarán todos los datos personales</li>
            <li>Se conservarán solo datos requeridos por ley (5 años para registros fiscales)</li>
            <li>No se puede procesar si tiene permisos activos</li>
            <li>Recibirá confirmación por correo en 48 horas</li>
          </ul>

          <h3>14.3. Auditoría de Consentimiento</h3>
          <p>Mantenemos un registro auditable de:</p>
          <ul className={styles.legalList}>
            <li>Cuándo otorgó consentimiento para WhatsApp</li>
            <li>Desde qué IP y dispositivo</li>
            <li>Cambios en sus preferencias</li>
            <li>Solicitudes de baja o eliminación</li>
          </ul>

          <h3>14.4. Retención de Datos</h3>
          <p>Períodos de conservación:</p>
          <ul className={styles.legalList}>
            <li><strong>Conversaciones WhatsApp:</strong> 1 hora</li>
            <li><strong>Registros de notificaciones:</strong> 90 días</li>
            <li><strong>Auditoría de consentimiento:</strong> 2 años</li>
            <li><strong>Datos fiscales:</strong> 5 años (ley mexicana)</li>
          </ul>
        </section>

        <section className={styles.legalSection}>
          <h2>15. CONTACTO</h2>
          <p>
            Para cualquier duda o aclaración respecto a estos Términos o el uso del Permiso, puede
            contactarnos a través de:
          </p>
          <p>Correo electrónico: contacto@permisosdigitales.com.mx</p>
          <p>WhatsApp: +52 55 4943 0313</p>
        </section>

        <div className={styles.legalFootnote}>
          <p>Última actualización: {currentDate}</p>
        </div>
      </main>

      {!isAuthenticated && <Footer />}
    </div>
  );
};

export default TermsAndConditionsPage;
