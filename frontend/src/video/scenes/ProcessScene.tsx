import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

interface Step {
  number: string;
  title: string;
  icon: string;
}

const steps: Step[] = [
  {
    number: '1',
    title: 'Registra tus datos',
    icon: '📝',
  },
  {
    number: '2',
    title: 'Realiza el pago',
    icon: '💳',
  },
  {
    number: '3',
    title: 'Descarga tu permiso',
    icon: '📄',
  },
];

export const ProcessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 15,
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #B5384D 0%, #8B2D3D 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <h2
        style={{
          fontSize: 56,
          fontWeight: 'bold',
          color: 'white',
          opacity: titleOpacity,
          marginBottom: 80,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Proceso Simple en 3 Pasos
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 40,
          alignItems: 'center',
        }}
      >
        {steps.map((step, index) => {
          const stepOpacity = spring({
            frame: frame - (index * 15 + 20),
            fps,
            from: 0,
            to: 1,
            durationInFrames: 20,
          });

          const stepScale = spring({
            frame: frame - (index * 15 + 20),
            fps,
            from: 0.8,
            to: 1,
            durationInFrames: 20,
          });

          // Animated connecting line
          const lineWidth = index < steps.length - 1
            ? interpolate(
                frame,
                [(index + 1) * 15 + 30, (index + 1) * 15 + 45],
                [0, 100],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }
              )
            : 0;

          return (
            <React.Fragment key={index}>
              <div
                style={{
                  opacity: stepOpacity,
                  transform: `scale(${stepScale})`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 20,
                }}
              >
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  }}
                >
                  <span style={{fontSize: 48}}>{step.icon}</span>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: '#B5384D',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {step.number}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 24,
                    color: 'white',
                    fontWeight: '500',
                    fontFamily: 'Inter, sans-serif',
                    textAlign: 'center',
                    maxWidth: 200,
                  }}
                >
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  style={{
                    width: `${lineWidth}px`,
                    height: 4,
                    backgroundColor: 'white',
                    opacity: 0.5,
                    marginBottom: 60,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};