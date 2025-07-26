import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from 'remotion';
import { theme } from '../config/theme';

export const Scene5CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  const logoRotation = interpolate(frame, [0, fps], [-5, 0], {
    extrapolateRight: 'clamp',
  });

  // Text animations
  const taglineOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const ctaScale = spring({
    frame: frame - fps * 1.5,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
    },
  });

  const urlOpacity = interpolate(frame, [fps * 2, fps * 2.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Social proof counter animation
  const counterProgress = interpolate(
    frame,
    [fps * 3, fps * 5],
    [0, 50000],
    {
      extrapolateRight: 'clamp',
    }
  );

  // Pulsing effect for CTA button
  const pulseScale = 1 + Math.sin(frame * 0.1) * 0.05;

  // Background gradient animation
  const gradientAngle = interpolate(frame, [0, fps * 17], [0, 360], {
    extrapolateRight: 'wrap',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradientAngle}deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
      }}
    >
      {/* Animated background pattern */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0.1,
          background: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255, 255, 255, 0.1) 10px,
            rgba(255, 255, 255, 0.1) 20px
          )`,
          transform: `translateX(${(frame % 100) * 2}px)`,
        }}
      />

      {/* Logo */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: '50%',
          transform: `translateX(-50%) scale(${logoScale}) rotate(${logoRotation}deg)`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: theme.colors.white,
            textShadow: '0 10px 40px rgba(0,0,0,0.3)',
            marginBottom: 20,
          }}
        >
          Permisos Digitales
        </h1>
        
        <Sequence from={fps * 0.5}>
          <p
            style={{
              fontSize: 40,
              color: theme.colors.white,
              opacity: taglineOpacity * 0.9,
              fontWeight: 300,
            }}
          >
            Tu tiempo vale
          </p>
        </Sequence>
      </div>

      {/* CTA Button */}
      <Sequence from={fps * 1.5}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${ctaScale * pulseScale})`,
          }}
        >
          <a
            href="#"
            style={{
              display: 'inline-block',
              padding: '30px 80px',
              backgroundColor: theme.colors.white,
              color: theme.colors.primary,
              textDecoration: 'none',
              borderRadius: 60,
              fontSize: 32,
              fontWeight: 'bold',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            Obtén tu permiso AHORA
            
            {/* Shine effect */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: -100,
                width: 100,
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                transform: `translateX(${interpolate(
                  frame,
                  [0, fps * 2],
                  [-100, 500],
                  {
                    extrapolateRight: 'wrap',
                  }
                )}px)`,
              }}
            />
          </a>
        </div>
      </Sequence>

      {/* URL */}
      <Sequence from={fps * 2}>
        <div
          style={{
            position: 'absolute',
            bottom: 250,
            width: '100%',
            textAlign: 'center',
            opacity: urlOpacity,
          }}
        >
          <p
            style={{
              fontSize: 36,
              color: theme.colors.white,
              opacity: 0.9,
            }}
          >
            permisosdigitales.com.mx
          </p>
        </div>
      </Sequence>

      {/* Social proof */}
      <Sequence from={fps * 3}>
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            width: '100%',
            textAlign: 'center',
            opacity: interpolate(frame - fps * 3, [0, fps], [0, 1]),
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '20px 40px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 50,
              backdropFilter: 'blur(10px)',
            }}
          >
            <p
              style={{
                fontSize: 28,
                color: theme.colors.white,
                fontWeight: 'bold',
              }}
            >
              <span style={{ fontSize: 40, color: theme.colors.secondary }}>
                {Math.floor(counterProgress).toLocaleString()}+
              </span>
              {' '}permisos emitidos
            </p>
          </div>
        </div>
      </Sequence>

      {/* Trust badges */}
      <Sequence from={fps * 5}>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: 40,
            opacity: interpolate(frame - fps * 5, [0, fps], [0, 1]),
          }}
        >
          <div style={{ color: theme.colors.white, fontSize: 18, opacity: 0.8 }}>
            ✓ 100% Legal
          </div>
          <div style={{ color: theme.colors.white, fontSize: 18, opacity: 0.8 }}>
            ✓ Pago Seguro
          </div>
          <div style={{ color: theme.colors.white, fontSize: 18, opacity: 0.8 }}>
            ✓ Soporte 24/7
          </div>
        </div>
      </Sequence>

      {/* Floating elements for visual interest */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: '50%',
            backgroundColor: theme.colors.secondary,
            opacity: 0.1,
            left: `${20 + i * 15}%`,
            top: `${70 + Math.sin(i) * 20}%`,
            transform: `scale(${1 + Math.sin(frame * 0.02 + i) * 0.3})`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};