import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  // Title animation
  const titleOpacity = spring({
    frame: frame - 15,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  const titleY = interpolate(frame, [15, 35], [50, 0], {
    extrapolateRight: 'clamp',
  });

  // Subtitle animation
  const subtitleOpacity = spring({
    frame: frame - 30,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #B5384D 0%, #8B2D3D 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
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
            width: 120,
            height: 120,
            borderRadius: '50%',
            backgroundColor: 'white',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{fontSize: 60, fontWeight: 'bold', color: '#B5384D'}}>
            PD
          </span>
        </div>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 'bold',
          color: 'white',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 20,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Permisos Digitales
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 32,
          color: 'white',
          opacity: subtitleOpacity,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          maxWidth: 800,
        }}
      >
        Tu permiso de circulación en minutos
      </p>
    </AbsoluteFill>
  );
};