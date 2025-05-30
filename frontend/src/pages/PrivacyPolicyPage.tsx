import React from 'react';
import { Link } from 'react-router-dom';

import styles from './LegalPage.module.css';
import Footer from '../components/layout/Footer';
import AppHeaderMobile, { NavLinkItem } from '../components/navigation/AppHeaderMobile/AppHeaderMobile';
import TextLogo from '../components/ui/TextLogo/TextLogo';
import useResponsive from '../hooks/useResponsive';

const PrivacyPolicyPage: React.FC = () => {
  const { isMdDown } = useResponsive();
  const currentDate = new Date().toLocaleDateString('es-MX');

  const authNavLinks: NavLinkItem[] = [
    { to: '/login', label: 'Iniciar Sesión', type: 'link' },
    { to: '/register', label: 'Registrarse', type: 'button-secondary' },
  ];

  return (
    <div className={styles.legalPageContainer}>
      {isMdDown ? (
        <AppHeaderMobile logoPath="/" navLinks={authNavLinks} />
      ) : (
        <header className={styles.desktopHeader}>
          <div className={styles.headerContent}>
            <TextLogo />
            <div className={styles.headerLinks}>
              <Link to="/login" className={styles.headerLink}>
                Iniciar Sesión
              </Link>
              <Link to="/register" className={styles.headerLink}>
                Registrarse
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className={styles.legalContent}>
        <h1 className={styles.legalTitle}>AVISO DE PRIVACIDAD</h1>
        <p className={styles.legalDate}>Fecha de Última Actualización: {currentDate}</p>

        <section className={styles.legalSection}>
          <p>
            La Dirección de Tránsito del H. Ayuntamiento de Huitzuco de los Figueroa, Guerrero (en
            adelante, &quot;Nosotros&quot; o la &quot;Autoridad Emisora&quot;), con domicilio en Calle Benito Juárez No.
            4, Col. Centro, C.P. 40140, Huitzuco de los Figueroa, Guerrero, es el responsable del
            tratamiento de los datos personales que nos proporcione a través de la plataforma de
            Permisos Digitales de Circulación Provisional (en adelante, la &quot;Plataforma&quot;).
          </p>
          <p>
            El presente Aviso de Privacidad tiene como objetivo informarle sobre el tratamiento que
            se dará a sus datos personales cuando utilice nuestra Plataforma, conforme a lo
            establecido en la Ley Número 466 de Protección de Datos Personales en Posesión de
            Sujetos Obligados del Estado de Guerrero.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>1. DATOS PERSONALES RECOLECTADOS</h2>
          <p>
            Para llevar a cabo las finalidades descritas en el presente aviso de privacidad,
            utilizaremos los siguientes datos personales:
          </p>
          <ul className={styles.legalList}>
            <li>
              <strong>Datos de identificación:</strong> Nombre completo, CURP o RFC.
            </li>
            <li>
              <strong>Datos de contacto:</strong> Domicilio, correo electrónico, teléfono.
            </li>
            <li>
              <strong>Datos del vehículo:</strong> Marca, línea, color, número de serie, número de
              motor, año modelo.
            </li>
            <li>
              <strong>Datos de pago:</strong> Información de tarjeta de crédito o débito (procesada
              de forma segura por nuestro proveedor de pagos certificado Conekta, quien cumple con
              estándares PCI DSS de seguridad).
            </li>
            <li>
              <strong>Datos de navegación:</strong> Información técnica como dirección IP, tipo de
              navegador, sistema operativo y páginas visitadas dentro de nuestra Plataforma.
            </li>
          </ul>
          <p>
            Le informamos que no recolectamos datos personales sensibles para la prestación de
            nuestros servicios.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>2. FINALIDADES DEL TRATAMIENTO</h2>
          <p>
            <strong>Finalidades primarias (necesarias para el servicio):</strong>
          </p>
          <ul className={styles.legalList}>
            <li>Emisión de permisos digitales de circulación provisional.</li>
            <li>Verificación de identidad del solicitante.</li>
            <li>Registro del vehículo en la base de datos de permisos temporales.</li>
            <li>Procesamiento de pagos relacionados con el trámite.</li>
            <li>Comunicación sobre el estado de su solicitud.</li>
            <li>Generación de documentos oficiales (permiso, recibo, certificado).</li>
            <li>Cumplimiento de obligaciones legales.</li>
            <li>Atención a solicitudes, dudas, aclaraciones o quejas.</li>
          </ul>

          <p>
            <strong>Finalidades secundarias (no necesarias para el servicio):</strong>
          </p>
          <ul className={styles.legalList}>
            <li>Elaboración de estadísticas y análisis para la mejora del servicio.</li>
            <li>Envío de notificaciones sobre vencimiento y renovación de permisos.</li>
            <li>Comunicación sobre nuevos servicios relacionados.</li>
            <li>Evaluación de la calidad de nuestros servicios.</li>
          </ul>

          <p>
            Si usted no desea que sus datos personales sean tratados para las finalidades
            secundarias, puede manifestar su negativa enviando un correo electrónico a
            contacto@permisosdigitales.com.mx, indicando en el asunto &quot;NEGATIVA FINALIDADES SECUNDARIAS&quot;, o
            bien, marcando la casilla correspondiente durante el proceso de registro en nuestra
            Plataforma.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>3. TRANSFERENCIA DE DATOS</h2>
          <p>Sus datos personales podrán ser transferidos a:</p>
          <ul className={styles.legalList}>
            <li>
              Autoridades gubernamentales federales, estatales o municipales, cuando sea requerido
              por ley o para el cumplimiento de obligaciones derivadas de la relación jurídica entre
              usted y la Autoridad Emisora.
            </li>
            <li>
              Conekta, nuestro proveedor de servicios de pago, únicamente para procesar los pagos
              relacionados con el trámite.
            </li>
            <li>
              Proveedores de servicios tecnológicos que nos ayudan a mantener la seguridad y
              funcionamiento de la Plataforma.
            </li>
          </ul>
          <p>
            No se realizarán transferencias adicionales que requieran su consentimiento, salvo
            aquellas que sean necesarias para cumplir con obligaciones legales o requerimientos de
            autoridades competentes.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>4. DERECHOS ARCO Y REVOCACIÓN DEL CONSENTIMIENTO</h2>
          <p>
            Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los
            utilizamos y las condiciones del uso que les damos (Acceso). Asimismo, es su derecho
            solicitar la corrección de su información personal en caso de que esté desactualizada,
            sea inexacta o incompleta (Rectificación); que la eliminemos de nuestros registros o
            bases de datos cuando considere que la misma no está siendo utilizada conforme a los
            principios, deberes y obligaciones previstas en la normativa (Cancelación); así como
            oponerse al uso de sus datos personales para fines específicos (Oposición).
          </p>
          <p>
            Para el ejercicio de cualquiera de los derechos ARCO, usted deberá presentar la
            solicitud respectiva a través de:
          </p>
          <ul className={styles.legalList}>
            <li>Correo electrónico: contacto@permisosdigitales.com.mx</li>
            <li>
              Presencialmente en: Calle Benito Juárez No. 4, Col. Centro, C.P. 40140, Huitzuco de
              los Figueroa, Guerrero
            </li>
            <li>
              A través de la Plataforma Nacional de Transparencia:{' '}
              <a
                href="http://www.plataformadetransparencia.org.mx"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.plataformadetransparencia.org.mx
              </a>
            </li>
          </ul>
          <p>Su solicitud deberá contener la siguiente información:</p>
          <ul className={styles.legalList}>
            <li>Nombre completo del titular de los datos personales</li>
            <li>
              Descripción clara y precisa de los datos personales respecto de los que se busca
              ejercer alguno de los derechos ARCO
            </li>
            <li>Cualquier documento que facilite la localización de sus datos personales</li>
            <li>En caso de rectificación, documentación que sustente la modificación solicitada</li>
          </ul>
          <p>
            La respuesta a su solicitud será proporcionada en un plazo máximo de 20 días hábiles,
            contados a partir de la fecha de recepción de la misma.
          </p>
          <p>
            Asimismo, usted puede revocar el consentimiento que, en su caso, nos haya otorgado para
            el tratamiento de sus datos personales para las finalidades secundarias. Sin embargo, es
            importante que tenga en cuenta que no en todos los casos podremos atender su solicitud o
            concluir el uso de forma inmediata, ya que es posible que por alguna obligación legal
            requiramos seguir tratando sus datos personales.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>5. USO DE COOKIES Y TECNOLOGÍAS SIMILARES</h2>
          <p>
            Nuestra Plataforma utiliza cookies y tecnologías similares para mejorar su experiencia
            de navegación. Estas tecnologías nos permiten reconocerlo cuando regresa a nuestro sitio
            y nos ayudan a entender cómo los usuarios utilizan nuestra Plataforma.
          </p>
          <p>Las cookies que utilizamos incluyen:</p>
          <ul className={styles.legalList}>
            <li>
              <strong>Cookies técnicas:</strong> Necesarias para el funcionamiento de la Plataforma.
            </li>
            <li>
              <strong>Cookies de análisis:</strong> Nos permiten analizar el comportamiento de los
              usuarios para mejorar nuestros servicios.
            </li>
            <li>
              <strong>Cookies de personalización:</strong> Permiten recordar sus preferencias para
              futuras visitas.
            </li>
          </ul>
          <p>
            Usted puede desactivar el uso de cookies en cualquier momento modificando la
            configuración de su navegador. Sin embargo, esto puede afectar la funcionalidad de
            ciertas partes de nuestra Plataforma.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>6. MEDIDAS DE SEGURIDAD</h2>
          <p>
            Hemos implementado medidas de seguridad administrativas, técnicas y físicas para
            proteger sus datos personales contra daño, pérdida, alteración, destrucción o el uso,
            acceso o tratamiento no autorizado. Sin embargo, ningún método de transmisión por
            Internet o método de almacenamiento electrónico es 100% seguro, por lo que no podemos
            garantizar su seguridad absoluta.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>7. TRANSFERENCIAS INTERNACIONALES</h2>
          <p>
            Para la prestación de nuestros servicios, algunos de sus datos personales pueden ser
            transferidos y procesados en servidores ubicados en Estados Unidos (Amazon Web Services),
            los cuales cuentan con certificaciones de seguridad internacionales y medidas de
            protección equivalentes a las exigidas por la legislación mexicana.
          </p>
          <p>
            Estas transferencias se realizan únicamente para las finalidades descritas en este aviso
            y bajo estrictas medidas de seguridad que garantizan la confidencialidad e integridad de
            sus datos personales.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>8. CAMBIOS AL AVISO DE PRIVACIDAD</h2>
          <p>
            El presente aviso de privacidad puede sufrir modificaciones, cambios o actualizaciones
            derivadas de nuevos requerimientos legales; de nuestras propias necesidades por los
            servicios que ofrecemos; de nuestras prácticas de privacidad; o por otras causas.
          </p>
          <p>
            Nos comprometemos a mantenerlo informado sobre los cambios que pueda sufrir el presente
            aviso de privacidad, a través de nuestra Plataforma o mediante correo electrónico si
            contamos con esta información.
          </p>
          <p>
            Cualquier modificación al presente aviso de privacidad será notificada mediante su
            publicación en nuestra Plataforma, indicando la fecha de la última actualización.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>9. MARCO LEGAL</h2>
          <p>
            Este Aviso de Privacidad se rige por la Ley Número 466 de Protección de Datos Personales
            en Posesión de Sujetos Obligados del Estado de Guerrero, la Ley General de Protección de
            Datos Personales en Posesión de Sujetos Obligados y demás normatividad aplicable.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>10. CONTACTO</h2>
          <p>
            Si tiene alguna duda o comentario respecto a este Aviso de Privacidad, puede
            contactarnos a través de:
          </p>
          <p>Correo electrónico: contacto@permisosdigitales.com.mx</p>
          <p>Teléfono: (727) 333-0142</p>
          <p>
            Dirección: Calle Benito Juárez No. 4, Col. Centro, C.P. 40140, Huitzuco de los Figueroa,
            Guerrero
          </p>
        </section>

        <div className={styles.legalFootnote}>
          <p>Última actualización: {currentDate}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
