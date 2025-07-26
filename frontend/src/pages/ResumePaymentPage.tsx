import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaExclamationCircle, FaClock, FaCreditCard } from 'react-icons/fa';
import { getApplicationById, type ApplicationDetails, type ApplicationStatus } from '../services/applicationService';
import { getDetailedCountdown } from '../utils/dateUtils';
import UnifiedPaymentFlow from '../components/payment/UnifiedPaymentFlow';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { logger } from '../utils/logger';

const ResumePaymentPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApplicationDetails | null>(null);
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplication = async () => {
      if (!applicationId) {
        setError('ID de solicitud no válido');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getApplicationById(applicationId);
        
        if (response.success && response.application) {
          const app = response.application;
          const currentStatus = response.status?.currentStatus;
          
          // Check if application is in a valid state for payment
          const validStatuses = ['AWAITING_PAYMENT', 'AWAITING_OXXO_PAYMENT', 'PAYMENT_PROCESSING'];
          if (currentStatus && !validStatuses.includes(currentStatus)) {
            setError('Esta solicitud no requiere pago o ya ha sido procesada');
            setLoading(false);
            return;
          }

          // Check if application has expired
          if (response.expiresAt) {
            const { isExpired } = getDetailedCountdown(response.expiresAt);
            if (isExpired) {
              setError('Esta solicitud ha expirado. Por favor, crea una nueva solicitud');
              setLoading(false);
              return;
            }
          }

          setApplication(app);
          setStatus(currentStatus || null);
        } else {
          setError(response.message || 'No se pudo cargar la solicitud');
        }
      } catch (err) {
        logger.error('Error fetching application:', err);
        setError('Error al cargar la solicitud');
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [applicationId]);

  const handleCardPaymentSuccess = (paymentIntentId: string) => {
    navigate('/dashboard', { 
      state: { 
        message: 'Pago procesado exitosamente. Te notificaremos cuando tu permiso esté listo.' 
      }
    });
  };

  const handleOxxoPaymentCreated = (oxxoDetails: any) => {
    navigate('/oxxo-confirmation', { 
      state: { 
        oxxoData: oxxoDetails,
        applicationId: application?.id 
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <FaExclamationCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Regresar al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <FaExclamationCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Solicitud no encontrada</h2>
          <p className="text-gray-600 mb-4">No se pudo encontrar la solicitud especificada.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Regresar al Dashboard
          </button>
        </div>
      </div>
    );
  }

  const countdown = application?.dates?.fecha_vencimiento ? getDetailedCountdown(application.dates.fecha_vencimiento) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Completar Pago
              </h1>
              <p className="text-gray-600">
                Solicitud de permiso para {application.vehicleInfo.marca} {application.vehicleInfo.linea} {application.vehicleInfo.ano_modelo}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Solicitante: {application.ownerInfo.nombre_completo}
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ${application.importe || 150}.00 MXN
              </p>
              {countdown && (
                <div className={`flex items-center justify-end space-x-1 text-sm font-medium ${
                  countdown.urgencyLevel === 'critical' 
                    ? 'text-red-600' 
                    : countdown.urgencyLevel === 'warning'
                    ? 'text-yellow-600'
                    : 'text-gray-600'
                }`}>
                  {countdown.urgencyLevel === 'critical' && <FaExclamationCircle className="w-4 h-4" />}
                  {countdown.urgencyLevel === 'warning' && <FaClock className="w-4 h-4" />}
                  <span>Vence en: {countdown.timeRemaining}</span>
                </div>
              )}
            </div>
          </div>

          {/* Expiration Warning */}
          {countdown && countdown.isExpiringSoon && (
            <div className={`mt-4 p-3 rounded-md ${
              countdown.urgencyLevel === 'critical'
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-center space-x-2">
                <FaExclamationCircle className={`w-5 h-5 ${
                  countdown.urgencyLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <div>
                  <p className={`text-sm font-medium ${
                    countdown.urgencyLevel === 'critical' ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {countdown.urgencyLevel === 'critical' 
                      ? '¡Atención! Tu solicitud expira pronto' 
                      : 'Tu solicitud expirará pronto'
                    }
                  </p>
                  <p className={`text-xs ${
                    countdown.urgencyLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    Complete el pago antes de que expire para evitar perder su solicitud.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <FaCreditCard className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Selecciona tu método de pago
            </h2>
          </div>

          <UnifiedPaymentFlow
            applicationId={String(application.id)}
            customerId={""} // Will be handled by the component
            onPrevious={() => navigate('/dashboard')}
            onCardPaymentSuccess={handleCardPaymentSuccess}
            onOxxoPaymentCreated={handleOxxoPaymentCreated}
          />
        </div>
      </div>
    </div>
  );
};

export default ResumePaymentPage;