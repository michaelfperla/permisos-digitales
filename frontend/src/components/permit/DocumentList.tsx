import React from 'react';
import { FaDownload, FaFilePdf, FaExclamationTriangle, FaBook, FaMobile } from 'react-icons/fa';
import styles from '../../pages/PermitDetailsPage.module.css';
import { isMobileDevice } from '../../utils/deviceDetection';

interface Document {
  type: 'permiso' | 'certificado' | 'placas' | 'recomendaciones';
  path?: string;
  name: string;
  icon?: React.ReactNode;
}

interface DocumentListProps {
  applicationData: any;
  onDownload: (type: 'permiso' | 'certificado' | 'placas' | 'recomendaciones') => void;
  isDownloading: boolean;
  downloadingTypes?: Set<string>;
}

const DocumentList: React.FC<DocumentListProps> = ({ applicationData, onDownload, isDownloading, downloadingTypes }) => {
  const isMobile = isMobileDevice();
  
  // Define all possible documents - recommendations are always available (generated on-demand)
  const allPossibleDocuments: Document[] = [
    { type: 'permiso', path: applicationData?.application?.permit_file_path, name: 'Certificado Principal del Permiso.pdf' },
    { type: 'certificado', path: applicationData?.application?.certificado_file_path, name: 'Inspección Vehicular.pdf' },
    { type: 'placas', path: applicationData?.application?.placas_file_path, name: 'Anexo Adicional.pdf' },
    { type: 'recomendaciones', path: applicationData?.application?.recomendaciones_file_path || 'always_available', name: 'Recomendaciones de Seguridad.pdf', icon: <FaBook className={styles.documentIcon} /> },
  ];

  // Filter documents: government PDFs need paths, recommendations are always available
  const documents = allPossibleDocuments.filter(doc =>
    doc.type === 'recomendaciones' || doc.path
  );

  if (documents.length === 0) {
    return (
      <div className={styles.noDocumentsMessage}>
        <FaExclamationTriangle className={styles.warningIcon} />
        <p>Los documentos estarán disponibles cuando el permiso esté listo.</p>
      </div>
    );
  }

  return (
    <div className={styles.documentsContainer}>
      {/* Download All Button */}
      {documents.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.downloadButton} ${styles.downloadAllButton}`}
            onClick={() => {
              if (isMobile) {
                // Mobile: Download all immediately without delays to avoid popup blocking
                documents.forEach((doc) => {
                  onDownload(doc.type);
                });
              } else {
                // Desktop: Use staggered timing for better UX
                documents.forEach((doc, index) => {
                  setTimeout(() => {
                    onDownload(doc.type);
                  }, index * 500);
                });
              }
            }}
            disabled={isDownloading}
          >
            {isMobile && <FaMobile className={styles.downloadIcon} />}
            {!isMobile && <FaDownload className={styles.downloadIcon} />}
            <span>{isDownloading ? 'Descargando...' : 'Descargar Todos los Documentos'}</span>
          </button>
          
          {/* Mobile-specific note */}
          {isMobile && documents.length > 1 && (
            <div className={styles.mobileDownloadNote}>
              <small>💡 En móviles, los archivos se descargan uno por uno. Si algún archivo no se descarga, inténtelo individualmente.</small>
            </div>
          )}
        </>
      )}
      
      {/* Individual Documents */}
      <div className={styles.documentsList}>
        {documents.map(doc => (
          <div className={styles.documentItem} key={doc.type}>
            <div className={styles.documentInfo}>
              {doc.icon || <FaFilePdf className={styles.documentIcon} />}
              <span className={styles.documentName}>{doc.name}</span>
            </div>
            <button
              type="button"
              className={`${styles.downloadButton} ${styles.documentDownloadButton}`}
              onClick={() => onDownload(doc.type)}
              disabled={downloadingTypes?.has(doc.type) || false}
            >
              <FaDownload className={styles.downloadIcon} />
              <span>{downloadingTypes?.has(doc.type) ? 'Descargando...' : 'Descargar'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentList;