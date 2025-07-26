import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  FaExclamationTriangle,
  FaSync,
  FaUpload,
  FaEye,
  FaClock,
  FaCheckCircle,
  FaClipboard,
  FaDownload,
  FaTimes,
} from 'react-icons/fa';

import styles from './FailedPermitsPage.module.css';
import Button from '../../components/ui/Button/Button';
import Card from '../../components/ui/Card/Card';
import Icon from '../../shared/components/ui/Icon';
import { useToast } from '../../shared/hooks/useToast';
import { getFailedApplications, retryPuppeteer, markApplicationResolved } from '../services/adminService';
import { ApplicationStatus, PermitErrorCategory, PermitErrorSeverity } from '../../constants/application.constants';

interface FailedApplication {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userPhone?: string;
  errorTime: string;
  errorMessage: string;
  screenshotPath?: string;
  applicationData: {
    marca: string;
    linea: string;
    ano_modelo: number;
    color: string;
    numero_serie: string;
    numero_motor: string;
    nombre_completo: string;
    curp_rfc: string;
    domicilio: string;
    importe: number;
  };
  errorCategory?: PermitErrorCategory;
  severity?: PermitErrorSeverity;
  suggestion?: string;
  adminReviewRequired: boolean;
  resolvedAt?: string;
  resolvedByAdmin?: string;
  adminNotes?: string;
}

const FailedPermitsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApplication, setSelectedApplication] = useState<FailedApplication | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch failed applications
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['failedApplications'],
    queryFn: () => getFailedApplications(),
    refetchInterval: 60000, // Refresh every minute
    refetchIntervalInBackground: false, // Stop polling when tab is not visible
    refetchOnWindowFocus: true, // Refresh when tab becomes visible again
  });

  // Retry puppeteer mutation
  const retryMutation = useMutation({
    mutationFn: (applicationId: number) => retryPuppeteer(applicationId),
    onSuccess: (_, applicationId) => {
      showToast('Reintento de generación iniciado', 'success');
      queryClient.invalidateQueries({ queryKey: ['failedApplications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', applicationId.toString()] });
    },
    onError: (error: any) => {
      showToast(`Error al reintentar: ${error.message}`, 'error');
    },
  });

  // Mark as resolved mutation
  const resolveMutation = useMutation({
    mutationFn: ({ applicationId, notes }: { applicationId: number; notes: string }) =>
      markApplicationResolved(applicationId, notes),
    onSuccess: () => {
      showToast('Aplicación marcada como resuelta', 'success');
      queryClient.invalidateQueries({ queryKey: ['failedApplications'] });
      setSelectedApplication(null);
      setAdminNotes('');
    },
    onError: (error: any) => {
      showToast(`Error al marcar como resuelta: ${error.message}`, 'error');
    },
  });

  // Calculate metrics
  const metrics = React.useMemo(() => {
    if (!data?.applications) return null;

    const now = new Date();
    const failures = data.applications;
    
    const over24Hours = failures.filter(app => {
      const errorTime = new Date(app.errorTime);
      const hoursSince = (now.getTime() - errorTime.getTime()) / (1000 * 60 * 60);
      return hoursSince > 24 && !app.resolvedAt;
    }).length;

    const last24Hours = failures.filter(app => {
      const errorTime = new Date(app.errorTime);
      const hoursSince = (now.getTime() - errorTime.getTime()) / (1000 * 60 * 60);
      return hoursSince <= 24 && !app.resolvedAt;
    }).length;

    const categoryCounts = failures.reduce((acc, app) => {
      const category = app.errorCategory || PermitErrorCategory.UNKNOWN;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      over24Hours,
      last24Hours,
      total: failures.length,
      unresolved: failures.filter(app => !app.resolvedAt).length,
      categoryCounts,
    };
  }, [data]);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (hours < 1) return 'Hace menos de 1 hora';
    if (hours === 1) return 'Hace 1 hora';
    if (hours < 24) return `Hace ${hours} horas`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hace 1 día';
    return `Hace ${days} días`;
  };

  // Copy form data to clipboard
  const copyFormData = (applicationData: FailedApplication['applicationData']) => {
    const formattedData = `
MARCA: ${applicationData.marca}
LÍNEA: ${applicationData.linea}
MODELO: ${applicationData.ano_modelo}
COLOR: ${applicationData.color}
NO. SERIE: ${applicationData.numero_serie}
NO. MOTOR: ${applicationData.numero_motor}
NOMBRE: ${applicationData.nombre_completo}
RFC/CURP: ${applicationData.curp_rfc}
DOMICILIO: ${applicationData.domicilio}
IMPORTE: $${applicationData.importe}
    `.trim();

    navigator.clipboard.writeText(formattedData);
    showToast('Datos copiados al portapapeles', 'success');
  };

  // Get severity color
  const getSeverityColor = (severity?: PermitErrorSeverity) => {
    switch (severity) {
      case PermitErrorSeverity.CRITICAL: return styles.severityCritical;
      case PermitErrorSeverity.HIGH: return styles.severityHigh;
      case PermitErrorSeverity.MEDIUM: return styles.severityMedium;
      case PermitErrorSeverity.LOW: return styles.severityLow;
      default: return styles.severityUnknown;
    }
  };

  // Get category icon
  const getCategoryIcon = (category?: PermitErrorCategory) => {
    switch (category) {
      case PermitErrorCategory.TIMEOUT: return FaClock;
      case PermitErrorCategory.AUTH_FAILURE: return FaExclamationTriangle;
      case PermitErrorCategory.PORTAL_CHANGED: return FaExclamationTriangle;
      default: return FaExclamationTriangle;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando aplicaciones fallidas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <Icon IconComponent={FaExclamationTriangle} size="xl" color="var(--color-danger)" />
        <h2>Error al cargar aplicaciones fallidas</h2>
        <p>{error instanceof Error ? error.message : 'Error desconocido'}</p>
      </div>
    );
  }

  const failedApplications = data?.applications || [];
  const unresolvedApplications = failedApplications.filter(app => !app.resolvedAt);

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1>Permisos Fallidos - Acción Requerida</h1>
        <p className={styles.subtitle}>
          Aplicaciones que requieren intervención manual
        </p>
      </header>

      {/* Metrics Summary */}
      {metrics && (
        <div className={styles.metricsGrid}>
          <Card className={`${styles.metricCard} ${styles.urgent}`}>
            <Icon IconComponent={FaExclamationTriangle} size="lg" color="var(--color-danger)" />
            <div className={styles.metricContent}>
              <h3>Necesita Acción Ahora</h3>
              <p className={styles.metricValue}>{metrics.over24Hours}</p>
              <span className={styles.metricLabel}>Más de 24 horas</span>
            </div>
          </Card>

          <Card className={styles.metricCard}>
            <Icon IconComponent={FaClock} size="lg" color="var(--color-warning)" />
            <div className={styles.metricContent}>
              <h3>Fallas Recientes</h3>
              <p className={styles.metricValue}>{metrics.last24Hours}</p>
              <span className={styles.metricLabel}>Últimas 24 horas</span>
            </div>
          </Card>

          <Card className={styles.metricCard}>
            <Icon IconComponent={FaSync} size="lg" color="var(--color-primary)" />
            <div className={styles.metricContent}>
              <h3>Sin Resolver</h3>
              <p className={styles.metricValue}>{metrics.unresolved}</p>
              <span className={styles.metricLabel}>De {metrics.total} total</span>
            </div>
          </Card>
        </div>
      )}

      {/* Error Category Summary */}
      {metrics?.categoryCounts && Object.keys(metrics.categoryCounts).length > 0 && (
        <Card className={styles.categoryCard}>
          <h3>Tipos de Error Más Comunes</h3>
          <div className={styles.categoryGrid}>
            {Object.entries(metrics.categoryCounts).map(([category, count]) => (
              <div key={category} className={styles.categoryItem}>
                <Icon IconComponent={getCategoryIcon(category as PermitErrorCategory)} size="sm" />
                <span className={styles.categoryName}>{category}</span>
                <span className={styles.categoryCount}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Failed Applications List */}
      <div className={styles.applicationsList}>
        {unresolvedApplications.length === 0 ? (
          <Card className={styles.emptyState}>
            <Icon IconComponent={FaCheckCircle} size="xl" color="var(--color-success)" />
            <h3>¡Todo está al día!</h3>
            <p>No hay aplicaciones fallidas sin resolver.</p>
          </Card>
        ) : (
          unresolvedApplications.map((application) => (
            <Card key={application.id} className={`${styles.applicationCard} ${getSeverityColor(application.severity)}`}>
              <div className={styles.cardHeader}>
                <div className={styles.headerInfo}>
                  <h3>Aplicación #{application.id}</h3>
                  <span className={styles.timeAgo}>{formatTimeAgo(application.errorTime)}</span>
                </div>
                <div className={styles.headerBadges}>
                  <span className={`${styles.categoryBadge} ${styles[`category${application.errorCategory}`]}`}>
                    {application.errorCategory || PermitErrorCategory.UNKNOWN}
                  </span>
                  <span className={`${styles.severityBadge} ${getSeverityColor(application.severity)}`}>
                    {application.severity || PermitErrorSeverity.MEDIUM}
                  </span>
                </div>
              </div>

              <div className={styles.userInfo}>
                <p><strong>{application.userName}</strong></p>
                <p>{application.userEmail} {application.userPhone && `| ${application.userPhone}`}</p>
              </div>

              <div className={styles.errorDetails}>
                <p className={styles.errorMessage}>
                  <Icon IconComponent={FaExclamationTriangle} size="sm" />
                  {application.errorMessage}
                </p>
                {application.suggestion && (
                  <p className={styles.suggestion}>
                    💡 {application.suggestion}
                  </p>
                )}
              </div>

              <div className={styles.vehicleInfo}>
                <span className={styles.vehicleLabel}>Vehículo:</span>
                <span className={styles.vehicleValue}>
                  {application.applicationData.marca} {application.applicationData.linea} ({application.applicationData.ano_modelo})
                </span>
              </div>

              <div className={styles.actions}>
                {application.screenshotPath && (
                  <Button
                    variant="secondary"
                    size="small"
                    icon={<Icon IconComponent={FaEye} size="sm" />}
                    onClick={() => window.open(application.screenshotPath, '_blank')}
                  >
                    Ver Screenshot
                  </Button>
                )}
                
                <Button
                  variant="secondary"
                  size="small"
                  icon={<Icon IconComponent={FaClipboard} size="sm" />}
                  onClick={() => copyFormData(application.applicationData)}
                >
                  Copiar Datos
                </Button>

                <Button
                  variant="primary"
                  size="small"
                  icon={<Icon IconComponent={FaSync} size="sm" />}
                  onClick={() => retryMutation.mutate(application.id)}
                  disabled={retryMutation.isPending}
                >
                  Reintentar
                </Button>

                <Button
                  variant="secondary"
                  size="small"
                  icon={<Icon IconComponent={FaUpload} size="sm" />}
                  onClick={() => {
                    setSelectedApplication(application);
                    setShowUploadModal(true);
                  }}
                >
                  Subir PDFs
                </Button>

                <Button
                  variant="success"
                  size="small"
                  icon={<Icon IconComponent={FaCheckCircle} size="sm" />}
                  onClick={() => {
                    setSelectedApplication(application);
                    const notes = prompt('Notas sobre la resolución:');
                    if (notes !== null) {
                      resolveMutation.mutate({ applicationId: application.id, notes });
                    }
                  }}
                >
                  Marcar Resuelto
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Upload PDFs Modal */}
      {showUploadModal && selectedApplication && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Subir PDFs Manualmente</h2>
              <Button
                variant="text"
                size="icon"
                className={styles.modalClose}
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedApplication(null);
                }}
                icon={<Icon IconComponent={FaTimes} size="md" />}
                aria-label="Cerrar modal"
              />
            </div>
            <div className={styles.modalBody}>
              <p>Aplicación #{selectedApplication.id}</p>
              <p className={styles.modalSubtext}>
                Suba los PDFs que descargó manualmente del portal gubernamental.
              </p>
              
              {/* This would be a proper file upload component */}
              <div className={styles.uploadSection}>
                <div className={styles.uploadField}>
                  <label>Permiso PDF:</label>
                  <input type="file" accept=".pdf" />
                </div>
                <div className={styles.uploadField}>
                  <label>Certificado PDF:</label>
                  <input type="file" accept=".pdf" />
                </div>
                <div className={styles.uploadField}>
                  <label>Placas PDF:</label>
                  <input type="file" accept=".pdf" />
                </div>
              </div>

              <textarea
                className={styles.notesField}
                placeholder="Notas sobre la resolución manual..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.modalFooter}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedApplication(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" icon={<Icon IconComponent={FaUpload} size="sm" />}>
                Subir y Resolver
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FailedPermitsPage;