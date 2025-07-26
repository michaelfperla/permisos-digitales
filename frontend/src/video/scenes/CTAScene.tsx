import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    from: 0.8,
    to: 1,
    durationInFrames: 20,
  });

  const titleOpacity = spring({
    frame: frame - 10,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  const buttonScale = spring({
    frame: frame - 25,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 15,
  });

  const urlOpacity = spring({
    frame: frame - 35,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 15,
  });

  // Pulse animation for button
  const pulseScale = interpolate(
    frame % 30,
    [0, 15, 30],
    [1, 1.05, 1],
    {
      extrapolateRight: 'clamp',
    }
  );

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
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            backgroundColor: 'white',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{fontSize: 50, fontWeight: 'bold', color: '#B5384D'}}>
            PD
          </span>
        </div>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: 56,
          fontWeight: 'bold',
          color: 'white',
          opacity: titleOpacity,
          marginBottom: 40,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
        }}
      >
        Obtén tu permiso ahora
      </h2>

      {/* CTA Button */}
      <div
        style={{
          transform: `scale(${buttonScale * pulseScale})`,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 50,
            padding: '25px 60px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 'bold',
              color: '#B5384D',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            COMENZAR AHORA →
          </span>
        </div>
      </div>

      {/* URL */}
      <p
        style={{
          fontSize: 32,
          color: 'white',
          opacity: urlOpacity,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        permisosdigitales.com.mx
      </p>

      {/* Features list */}
      <div
        style={{
          opacity: urlOpacity,
          marginTop: 40,
          display: 'flex',
          gap: 40,
        }}
      >
        <span style={{fontSize: 20, color: 'rgba(255,255,255,0.8)'}}>
          ✓ Sin filas
        </span>
        <span style={{fontSize: 20, color: 'rgba(255,255,255,0.8)'}}>
          ✓ 100% legal
        </span>
        <span style={{fontSize: 20, color: 'rgba(255,255,255,0.8)'}}>
          ✓ Proceso rápido
        </span>
      </div>
    </AbsoluteFill>
  );
};