import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

interface Benefit {
  icon: string;
  text: string;
}

const benefits: Benefit[] = [
  {icon: '⏰', text: 'Sin filas ni esperas'},
  {icon: '📱', text: '100% digital desde tu celular'},
  {icon: '🔐', text: 'Datos protegidos y seguros'},
  {icon: '✨', text: 'Más de 10,000 usuarios satisfechos'},
];

export const BenefitsScene: React.FC = () => {
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
        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
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
          marginBottom: 60,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Beneficios que marcan la diferencia
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 40,
          maxWidth: 900,
        }}
      >
        {benefits.map((benefit, index) => {
          const benefitOpacity = spring({
            frame: frame - (index * 8 + 20),
            fps,
            from: 0,
            to: 1,
            durationInFrames: 20,
          });

          const benefitX = interpolate(
            frame,
            [index * 8 + 20, index * 8 + 35],
            [index % 2 === 0 ? -50 : 50, 0],
            {
              extrapolateRight: 'clamp',
            }
          );

          return (
            <div
              key={index}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: 20,
                padding: 30,
                opacity: benefitOpacity,
                transform: `translateX(${benefitX}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <span style={{fontSize: 48}}>{benefit.icon}</span>
              <p
                style={{
                  fontSize: 24,
                  color: 'white',
                  fontWeight: '500',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {benefit.text}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};