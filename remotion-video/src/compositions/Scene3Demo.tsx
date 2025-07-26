import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Img,
} from 'remotion';
import { theme } from '../config/theme';

export const Scene3Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Progress animation
  const step1Progress = interpolate(frame, [0, fps * 2], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const step2Progress = interpolate(frame, [fps * 6, fps * 8], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const step3Progress = interpolate(frame, [fps * 12, fps * 14], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Form field animations
  const field1Opacity = interpolate(frame, [fps * 2, fps * 2.5], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const field2Opacity = interpolate(frame, [fps * 3, fps * 3.5], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const field3Opacity = interpolate(frame, [fps * 4, fps * 4.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Typing animations
  const nameTyping = interpolate(frame, [fps * 2.5, fps * 3.5], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const emailTyping = interpolate(frame, [fps * 3.5, fps * 4.5], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const phoneTyping = interpolate(frame, [fps * 4.5, fps * 5.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const formScale = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  // Helper function to simulate typing
  const getTypedText = (text: string, progress: number) => {
    return text.substring(0, Math.floor(text.length * progress));
  };

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          width: '100%',
          textAlign: 'center',
          fontSize: 64,
          fontWeight: 'bold',
          color: theme.colors.white,
        }}
      >
        3 simples pasos
      </div>

      {/* Form mockup */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${formScale})`,
          width: 700,
          backgroundColor: theme.colors.white,
          borderRadius: 30,
          padding: 60,
          boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
        }}
      >
        {/* Progress indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 60,
            position: 'relative',
          }}
        >
          {/* Progress line */}
          <div
            style={{
              position: 'absolute',
              top: 25,
              left: 60,
              right: 60,
              height: 2,
              backgroundColor: theme.colors.gray[300],
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 25,
              left: 60,
              height: 2,
              backgroundColor: theme.colors.primary,
              width: `${(step1Progress + step2Progress + step3Progress) * 33.33}%`,
              transition: 'width 0.5s ease',
            }}
          />

          {/* Step 1 */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                backgroundColor: step1Progress > 0 ? theme.colors.primary : theme.colors.gray[300],
                color: theme.colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                transition: 'all 0.3s ease',
                transform: step1Progress > 0 ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {step1Progress === 1 ? '✓' : '1'}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: theme.colors.textLight }}>
              Registro
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                backgroundColor: step2Progress > 0 ? theme.colors.primary : theme.colors.gray[300],
                color: theme.colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                transition: 'all 0.3s ease',
                transform: step2Progress > 0 ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {step2Progress === 1 ? '✓' : '2'}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: theme.colors.textLight }}>
              Vehículo
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                backgroundColor: step3Progress > 0 ? theme.colors.primary : theme.colors.gray[300],
                color: theme.colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                transition: 'all 0.3s ease',
                transform: step3Progress > 0 ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {step3Progress === 1 ? '✓' : '3'}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: theme.colors.textLight }}>
              Pago
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div style={{ opacity: field1Opacity }}>
          <label
            style={{
              display: 'block',
              marginBottom: 10,
              fontSize: 16,
              fontWeight: '500',
              color: theme.colors.text,
            }}
          >
            Nombre completo
          </label>
          <input
            style={{
              width: '100%',
              padding: '16px 20px',
              border: `2px solid ${theme.colors.gray[300]}`,
              borderRadius: 12,
              fontSize: 18,
              marginBottom: 30,
              outline: 'none',
            }}
            value={getTypedText('María González Hernández', nameTyping)}
            readOnly
          />
        </div>

        <div style={{ opacity: field2Opacity }}>
          <label
            style={{
              display: 'block',
              marginBottom: 10,
              fontSize: 16,
              fontWeight: '500',
              color: theme.colors.text,
            }}
          >
            Correo electrónico
          </label>
          <input
            style={{
              width: '100%',
              padding: '16px 20px',
              border: `2px solid ${theme.colors.gray[300]}`,
              borderRadius: 12,
              fontSize: 18,
              marginBottom: 30,
              outline: 'none',
            }}
            value={getTypedText('maria.gonzalez@email.com', emailTyping)}
            readOnly
          />
        </div>

        <div style={{ opacity: field3Opacity }}>
          <label
            style={{
              display: 'block',
              marginBottom: 10,
              fontSize: 16,
              fontWeight: '500',
              color: theme.colors.text,
            }}
          >
            Teléfono
          </label>
          <input
            style={{
              width: '100%',
              padding: '16px 20px',
              border: `2px solid ${theme.colors.gray[300]}`,
              borderRadius: 12,
              fontSize: 18,
              outline: 'none',
            }}
            value={getTypedText('55 1234 5678', phoneTyping)}
            readOnly
          />
        </div>

        {/* Continue button */}
        <Sequence from={fps * 6}>
          <button
            style={{
              width: '100%',
              marginTop: 40,
              padding: '20px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.white,
              border: 'none',
              borderRadius: 12,
              fontSize: 20,
              fontWeight: 'bold',
              cursor: 'pointer',
              transform: `scale(${spring({
                frame: frame - fps * 6,
                fps,
                config: {
                  damping: 10,
                  stiffness: 100,
                },
              })})`,
            }}
          >
            Continuar
          </button>
        </Sequence>
      </div>

      {/* Time indicator */}
      <Sequence from={fps * 15}>
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 48,
            fontWeight: 'bold',
            color: theme.colors.white,
            opacity: interpolate(frame - fps * 15, [0, fps], [0, 1]),
          }}
        >
          ⏱ Total: 5 minutos
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};