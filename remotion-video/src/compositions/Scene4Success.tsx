import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  random,
} from 'remotion';
import { theme } from '../config/theme';

export const Scene4Success: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animations
  const checkmarkScale = spring({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
    },
  });

  const messageOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const permitScale = spring({
    frame: frame - fps * 1.5,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  const permitRotation = interpolate(
    frame,
    [fps * 1.5, fps * 2.5],
    [-10, 0],
    {
      extrapolateRight: 'clamp',
    }
  );

  // Confetti particles
  const particles = Array(50).fill(0).map((_, i) => ({
    x: random(`particle-x-${i}`) * width,
    y: -50,
    rotation: random(`particle-rot-${i}`) * 360,
    scale: 0.5 + random(`particle-scale-${i}`) * 0.5,
    color: i % 2 === 0 ? theme.colors.secondary : theme.colors.primary,
    delay: random(`particle-delay-${i}`) * fps * 0.5,
  }));

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(to bottom, ${theme.colors.successDark} 0%, ${theme.colors.success} 100%)`,
      }}
    >
      {/* Confetti */}
      {particles.map((particle, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: particle.x,
            top: interpolate(
              frame,
              [particle.delay, particle.delay + fps * 3],
              [particle.y, height + 100],
              {
                extrapolateRight: 'clamp',
              }
            ),
            width: 20 * particle.scale,
            height: 20 * particle.scale,
            backgroundColor: particle.color,
            borderRadius: '50%',
            transform: `rotate(${particle.rotation + frame * 5}deg)`,
            opacity: frame > particle.delay ? 1 : 0,
          }}
        />
      ))}

      {/* Success checkmark */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: '50%',
          transform: `translateX(-50%) scale(${checkmarkScale})`,
          width: 200,
          height: 200,
          backgroundColor: theme.colors.white,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            fontSize: 120,
            color: theme.colors.success,
            fontWeight: 'bold',
          }}
        >
          ✓
        </div>
      </div>

      {/* Success message */}
      <Sequence from={fps * 0.5}>
        <div
          style={{
            position: 'absolute',
            top: 450,
            width: '100%',
            textAlign: 'center',
            opacity: messageOpacity,
          }}
        >
          <h2
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: theme.colors.white,
              marginBottom: 20,
            }}
          >
            ¡Pago exitoso!
          </h2>
          <p
            style={{
              fontSize: 32,
              color: theme.colors.white,
              opacity: 0.9,
            }}
          >
            Tu permiso está siendo generado...
          </p>
        </div>
      </Sequence>

      {/* Permit preview */}
      <Sequence from={fps * 1.5}>
        <div
          style={{
            position: 'absolute',
            bottom: 150,
            left: '50%',
            transform: `translateX(-50%) scale(${permitScale}) rotate(${permitRotation}deg)`,
            width: 500,
            backgroundColor: theme.colors.white,
            borderRadius: 20,
            padding: 40,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          <h3
            style={{
              fontSize: 28,
              color: theme.colors.primary,
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            Permiso de Circulación Digital
          </h3>
          
          <div style={{ marginBottom: 15 }}>
            <strong>Folio:</strong> PD-2024-0012345
          </div>
          <div style={{ marginBottom: 15 }}>
            <strong>Vigencia:</strong> 30 días
          </div>
          <div style={{ marginBottom: 15 }}>
            <strong>Vehículo:</strong> Toyota Corolla 2023
          </div>
          <div style={{ marginBottom: 20 }}>
            <strong>Titular:</strong> María González Hernández
          </div>
          
          {/* QR Code placeholder */}
          <div
            style={{
              width: '100%',
              height: 100,
              backgroundColor: theme.colors.gray[100],
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 30,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                backgroundColor: theme.colors.text,
                opacity: 0.2,
                borderRadius: 5,
              }}
            />
          </div>
          
          {/* Holographic effect overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(45deg, 
                transparent 30%, 
                rgba(255, 255, 255, 0.2) 50%, 
                transparent 70%)`,
              transform: `translateX(${interpolate(
                frame,
                [0, fps * 3],
                [-100, 100],
                {
                  extrapolateRight: 'wrap',
                }
              )}%)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </Sequence>

      {/* Download button */}
      <Sequence from={fps * 5}>
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            left: '50%',
            transform: `translateX(-50%) scale(${spring({
              frame: frame - fps * 5,
              fps,
              config: {
                damping: 10,
                stiffness: 100,
              },
            })})`,
          }}
        >
          <button
            style={{
              padding: '20px 60px',
              backgroundColor: theme.colors.white,
              color: theme.colors.success,
              border: 'none',
              borderRadius: 50,
              fontSize: 24,
              fontWeight: 'bold',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}
          >
            📥 Descargar PDF
          </button>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};