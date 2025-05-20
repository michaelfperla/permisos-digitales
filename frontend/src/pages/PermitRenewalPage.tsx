import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import applicationService, { Application } from '../services/applicationService';
import { RenewalFormData } from '../types/application.types';
import styles from './PermitRenewalPage.module.css';
import Button from '../components/ui/Button/Button';

const PermitRenewalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [originalApplication, setOriginalApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    message: string;
    daysUntilExpiration?: number;
    expirationDate?: string;
  } | null>(null);
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [renewalApplication, setRenewalApplication] = useState<Application | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<{
    amount: number;
    currency: string;
    reference: string;
    paymentMethods: string[];
    nextSteps: string[];
  } | null>(null);

  const [formData, setFormData] = useState<RenewalFormData>({
    domicilio: '',
    color: '',
    renewal_reason: 'Renovación regular',
    renewal_notes: ''
  });

  useEffect(() => {
    if (id) {
      fetchApplicationAndEligibility(id);
    }
  }, [id]);

  const fetchApplicationAndEligibility = async (applicationId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch the original application
      const response = await applicationService.getApplicationById(applicationId);

      if (!response.success || !response.application) {
        setError('No se pudo obtener la información del permiso original');
        return;
      }

      setOriginalApplication(response.application);

      // Pre-fill form data from original application
      setFormData({
        domicilio: response.application.domicilio || '',
        color: response.application.color || '',
        renewal_reason: 'Renovación regular',
        renewal_notes: ''
      });

      // Check renewal eligibility
      const eligibilityResponse = await applicationService.checkRenewalEligibility(applicationId);
      setEligibility(eligibilityResponse);

      if (!eligibilityResponse.eligible) {
        showToast(eligibilityResponse.message, 'warning');
      }
    } catch (err) {
      console.error('Error fetching application or eligibility:', err);
      setError('Error al cargar la información del permiso');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !originalApplication) {
      showToast('Información del permiso original no disponible', 'error');
      return;
    }

    if (!eligibility?.eligible) {
      showToast('Este permiso no es elegible para renovación', 'error');
      return;
    }

    // Basic form validation
    if (!formData.domicilio.trim()) {
      showToast('El domicilio es obligatorio', 'error');
      return;
    }

    if (!formData.color.trim()) {
      showToast('El color del vehículo es obligatorio', 'error');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await applicationService.createRenewalApplication(id, formData);

      if (response.success && response.application) {
        showToast('Solicitud de renovación creada exitosamente', 'success');

        // Store the renewal application and payment instructions
        setRenewalApplication(response.application);
        setPaymentInstructions(response.paymentInstructions || {
          amount: 1500, // Default amount if not provided by API
          currency: 'MXN',
          reference: `REF-${response.application.id}`,
          paymentMethods: [
            'Transferencia bancaria',
            'Pago en ventanilla bancaria',
            'Pago en línea'
          ],
          nextSteps: [
            'Realice el pago utilizando la referencia proporcionada',
            'Suba el comprobante de pago en la sección de detalles del permiso',
            'Espere la verificación del pago (1-2 días hábiles)'
          ]
        });

        // Set success state instead of navigating
        setRenewalSuccess(true);
      } else {
        showToast(response.message || 'Error al crear la solicitud de renovación', 'error');
      }
    } catch (err) {
      console.error('Error creating renewal application:', err);
      showToast('Error al crear la solicitud de renovación', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/permits/${id}`);
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando información del permiso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error}</p>
        <Button
          variant="primary"
          onClick={() => id && fetchApplicationAndEligibility(id)}
          className={styles.retryButton}
        >
          Reintentar
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate('/dashboard')}
          className={styles.backButton}
        >
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  if (!originalApplication) {
    return (
      <div className={styles.errorContainer}>
        <h2>Permiso no encontrado</h2>
        <p>No se pudo encontrar la información del permiso solicitado.</p>
        <Button
          variant="secondary"
          onClick={() => navigate('/dashboard')}
          className={styles.backButton}
        >
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  if (renewalSuccess && renewalApplication && paymentInstructions) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Renovación Exitosa</h1>
          <p className={styles.subtitle}>Permiso de Renovación #{renewalApplication.id}</p>
        </div>

        <div className={styles.successContainer}>
          <h2 className={styles.sectionTitle}>Solicitud de Renovación Creada</h2>
          <p className={styles.formDescription}>
            Su solicitud de renovación ha sido creada exitosamente. Para completar el proceso, por favor realice el pago
            siguiendo las instrucciones a continuación.
          </p>

          <div className={styles.applicationSummary}>
            <h3 className={styles.sectionTitle}>Información del Permiso de Renovación</h3>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Número de Solicitud:</span>
              <span className={styles.summaryValue}>{renewalApplication.id}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Vehículo:</span>
              <span className={styles.summaryValue}>
                {renewalApplication.marca} {renewalApplication.linea} ({renewalApplication.ano_modelo})
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Estado:</span>
              <span className={styles.summaryValue}>{renewalApplication.status}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Fecha de Solicitud:</span>
              <span className={styles.summaryValue}>
                {new Date(renewalApplication.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className={styles.applicationSummary}>
            <h3 className={styles.sectionTitle}>Instrucciones de Pago</h3>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Importe:</span>
              <span className={styles.summaryValue}>
                {paymentInstructions.amount.toLocaleString('es-MX')} {paymentInstructions.currency}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Referencia:</span>
              <span className={styles.summaryValue}>{paymentInstructions.reference}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Métodos de Pago:</span>
              <div className={styles.summaryValue}>
                <ul className={styles.list}>
                  {paymentInstructions.paymentMethods.map((method, index) => (
                    <li key={index}>{method}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Próximos Pasos:</span>
              <div className={styles.summaryValue}>
                <ol className={styles.list}>
                  {paymentInstructions.nextSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className={styles.secondaryButton}
            >
              Ir al Dashboard
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/permits/${renewalApplication.id}`)}
              className={styles.primaryButton}
            >
              Ver Detalles del Permiso
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Renovación de Permiso</h1>
          <p className={styles.subtitle}>Permiso #{originalApplication.id}</p>
        </div>

        <div className={styles.ineligibleContainer}>
          <h2 className={styles.ineligibleTitle}>No Elegible para Renovación</h2>
          <p className={styles.ineligibleMessage}>{eligibility.message}</p>

          <div className={styles.applicationSummary}>
            <h3>Información del Permiso Original</h3>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Vehículo:</span>
              <span className={styles.summaryValue}>
                {originalApplication.marca} {originalApplication.linea} ({originalApplication.ano_modelo})
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Estado:</span>
              <span className={styles.summaryValue}>{originalApplication.status}</span>
            </div>
            {originalApplication.fecha_vencimiento && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Fecha de Vencimiento:</span>
                <span className={styles.summaryValue}>
                  {new Date(originalApplication.fecha_vencimiento).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => navigate(`/permits/${id}`)}
              className={styles.secondaryButton}
            >
              Volver a Detalles del Permiso
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/dashboard')}
              className={styles.primaryButton}
            >
              Ir al Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Renovación de Permiso</h1>
        <p className={styles.subtitle}>Permiso #{originalApplication.id}</p>
      </div>

      <div className={styles.content}>
        <div className={styles.applicationSummary}>
          <h2 className={styles.sectionTitle}>Información del Permiso Original</h2>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Vehículo:</span>
            <span className={styles.summaryValue}>
              {originalApplication.marca} {originalApplication.linea} ({originalApplication.ano_modelo})
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Color:</span>
            <span className={styles.summaryValue}>{originalApplication.color}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Número de Serie:</span>
            <span className={styles.summaryValue}>{originalApplication.numero_serie}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Número de Motor:</span>
            <span className={styles.summaryValue}>{originalApplication.numero_motor}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Solicitante:</span>
            <span className={styles.summaryValue}>{originalApplication.nombre_completo}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>CURP/RFC:</span>
            <span className={styles.summaryValue}>{originalApplication.curp_rfc}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Domicilio:</span>
            <span className={styles.summaryValue}>{originalApplication.domicilio}</span>
          </div>
          {originalApplication.fecha_vencimiento && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Fecha de Vencimiento:</span>
              <span className={styles.summaryValue}>
                {new Date(originalApplication.fecha_vencimiento).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.renewalForm}>
          <h2 className={styles.sectionTitle}>Información para Renovación</h2>
          <p className={styles.formDescription}>
            Por favor, revise y actualice la información necesaria para la renovación de su permiso.
            Los campos marcados con * son obligatorios. El nuevo permiso tendrá una validez de 30 días a partir de la fecha de expedición.
          </p>

          <div className={styles.formGroup}>
            <label htmlFor="domicilio" className={styles.label}>
              Domicilio *
            </label>
            <input
              type="text"
              id="domicilio"
              name="domicilio"
              value={formData.domicilio}
              onChange={handleInputChange}
              className={styles.input}
              required
            />
            <p className={styles.helperText}>
              Actualice su domicilio si ha cambiado desde la solicitud original.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="color" className={styles.label}>
              Color del Vehículo *
            </label>
            <input
              type="text"
              id="color"
              name="color"
              value={formData.color}
              onChange={handleInputChange}
              className={styles.input}
              required
            />
            <p className={styles.helperText}>
              Actualice el color si ha cambiado desde la solicitud original.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="renewal_reason" className={styles.label}>
              Motivo de Renovación *
            </label>
            <select
              id="renewal_reason"
              name="renewal_reason"
              value={formData.renewal_reason}
              onChange={handleInputChange}
              className={styles.select}
              required
            >
              <option value="Renovación regular">Renovación regular</option>
              <option value="Cambio de domicilio">Cambio de domicilio</option>
              <option value="Cambio de color">Cambio de color</option>
              <option value="Otro">Otro (especificar en notas)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="renewal_notes" className={styles.label}>
              Notas Adicionales
            </label>
            <textarea
              id="renewal_notes"
              name="renewal_notes"
              value={formData.renewal_notes}
              onChange={handleInputChange}
              className={styles.textarea}
              rows={4}
              placeholder="Ingrese cualquier información adicional relevante para la renovación"
            />
          </div>

          <div className={styles.formActions}>
            <Button
              variant="secondary"
              onClick={handleCancel}
              className={styles.secondaryButton}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              htmlType="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Solicitar Renovación'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermitRenewalPage;
