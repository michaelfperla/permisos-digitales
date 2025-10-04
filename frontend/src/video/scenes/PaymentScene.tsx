import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

export const PaymentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 15,
  });

  const priceScale = spring({
    frame: frame - 20,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  const cardOpacity = spring({
    frame: frame - 30,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 15,
  });

  const oxxoOpacity = spring({
    frame: frame - 35,
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
          marginBottom: 40,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Precio Único
      </h2>

      <div
        style={{
          transform: `scale(${priceScale})`,
          backgroundColor: 'white',
          borderRadius: 30,
          padding: '40px 80px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          marginBottom: 60,
        }}
      >
        <div style={{textAlign: 'center'}}>
          <span
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: '#B5384D',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            $99
          </span>
          <span
            style={{
              fontSize: 40,
              color: '#666',
              marginLeft: 10,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            MXN
          </span>
        </div>
        <p
          style={{
            fontSize: 24,
            color: '#666',
            marginTop: 10,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Por 30 días de validez
        </p>
      </div>

      <div style={{display: 'flex', gap: 40}}>
        <div
          style={{
            opacity: cardOpacity,
            backgroundColor: 'white',
            borderRadius: 20,
            padding: '30px 50px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 15,
          }}
        >
          <span style={{fontSize: 48}}>💳</span>
          <p
            style={{
              fontSize: 24,
              fontWeight: '500',
              color: '#1a1a1a',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Tarjeta de Crédito/Débito
          </p>
          <p
            style={{
              fontSize: 18,
              color: '#10B981',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Procesamiento instantáneo
          </p>
        </div>

        <div
          style={{
            opacity: oxxoOpacity,
            backgroundColor: 'white',
            borderRadius: 20,
            padding: '30px 50px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 15,
          }}
        >
          <span style={{fontSize: 48}}>🏪</span>
          <p
            style={{
              fontSize: 24,
              fontWeight: '500',
              color: '#1a1a1a',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Pago en OXXO
          </p>
          <p
            style={{
              fontSize: 18,
              color: '#F59E0B',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            1-4 horas de proceso
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};