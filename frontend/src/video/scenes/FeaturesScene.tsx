import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: '⚡',
    title: 'Rápido',
    description: 'Obtén tu permiso en minutos',
  },
  {
    icon: '🔒',
    title: 'Seguro',
    description: 'Encriptación de nivel bancario',
  },
  {
    icon: '✅',
    title: '100% Legal',
    description: 'Permisos oficiales válidos',
  },
];

export const FeaturesScene: React.FC = () => {
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
        backgroundColor: '#f5f5f5',
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
          color: '#B5384D',
          opacity: titleOpacity,
          marginBottom: 60,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        ¿Por qué elegirnos?
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 60,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {features.map((feature, index) => {
          const featureOpacity = spring({
            frame: frame - (index * 10 + 20),
            fps,
            from: 0,
            to: 1,
            durationInFrames: 20,
          });

          const featureY = interpolate(
            frame,
            [index * 10 + 20, index * 10 + 40],
            [30, 0],
            {
              extrapolateRight: 'clamp',
            }
          );

          return (
            <div
              key={index}
              style={{
                backgroundColor: 'white',
                borderRadius: 20,
                padding: 40,
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                opacity: featureOpacity,
                transform: `translateY(${featureY}px)`,
                textAlign: 'center',
                minWidth: 280,
              }}
            >
              <div style={{fontSize: 72, marginBottom: 20}}>{feature.icon}</div>
              <h3
                style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  marginBottom: 10,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 20,
                  color: '#666',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};