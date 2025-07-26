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

export const Scene2Discovery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const phoneScale = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  const phoneRotation = interpolate(frame, [0, fps * 0.5], [5, 0], {
    extrapolateRight: 'clamp',
  });

  const searchBarOpacity = interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const typingProgress = interpolate(
    frame,
    [fps * 1, fps * 2.5],
    [0, 1],
    {
      extrapolateRight: 'clamp',
    }
  );

  const resultsOpacity = interpolate(frame, [fps * 2.5, fps * 3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const highlightScale = spring({
    frame: frame - fps * 3.5,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
    },
  });

  const searchText = 'permiso circulación en línea';
  const typedText = searchText.substring(0, Math.floor(searchText.length * typingProgress));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at center, #1a1a1a 0%, #000 100%)`,
      }}
    >
      {/* Phone mockup */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${phoneScale}) rotate(${phoneRotation}deg)`,
          width: 400,
          height: 800,
          backgroundColor: '#1f1f1f',
          borderRadius: 60,
          padding: 20,
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Phone screen */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: theme.colors.white,
            borderRadius: 40,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Search interface */}
          <div style={{ padding: 40 }}>
            {/* Search bar */}
            <div
              style={{
                backgroundColor: theme.colors.gray[100],
                padding: '20px 30px',
                borderRadius: 40,
                fontSize: 20,
                color: theme.colors.text,
                marginBottom: 40,
                opacity: searchBarOpacity,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ marginRight: 15, fontSize: 24 }}>🔍</span>
              <span>{typedText}</span>
              <span
                style={{
                  width: 2,
                  height: 24,
                  backgroundColor: theme.colors.text,
                  marginLeft: 2,
                  opacity: Math.sin(frame * 0.1) > 0 ? 1 : 0,
                }}
              />
            </div>

            {/* Search results */}
            <Sequence from={fps * 2.5}>
              <div style={{ opacity: resultsOpacity }}>
                {/* Result 1 */}
                <div
                  style={{
                    padding: 20,
                    borderBottom: `1px solid ${theme.colors.gray[200]}`,
                    fontSize: 18,
                    color: theme.colors.textLight,
                  }}
                >
                  Trámites tradicionales - Gov.mx
                  <div style={{ fontSize: 14, marginTop: 5 }}>
                    Horario: 8:00 - 14:00 hrs
                  </div>
                </div>

                {/* Result 2 - Highlighted */}
                <div
                  style={{
                    padding: 20,
                    borderBottom: `1px solid ${theme.colors.gray[200]}`,
                    backgroundColor: '#FFE5B4',
                    transform: `scale(${highlightScale})`,
                    transformOrigin: 'center',
                    position: 'relative',
                    zIndex: 10,
                    boxShadow: highlightScale > 0 ? '0 10px 30px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.primary }}>
                    ✨ Permisos Digitales - 5 minutos
                  </div>
                  <div style={{ fontSize: 16, marginTop: 8, color: theme.colors.text }}>
                    ✓ Sin filas ✓ 24/7 ✓ $150 MXN
                  </div>
                </div>

                {/* Result 3 */}
                <div
                  style={{
                    padding: 20,
                    fontSize: 18,
                    color: theme.colors.textLight,
                  }}
                >
                  Gestorías - Desde $500
                  <div style={{ fontSize: 14, marginTop: 5 }}>
                    Servicio de terceros
                  </div>
                </div>
              </div>
            </Sequence>
          </div>

          {/* Cursor */}
          <Sequence from={fps * 3.5}>
            <div
              style={{
                position: 'absolute',
                left: 200,
                top: 350,
                width: 0,
                height: 0,
                borderLeft: '20px solid transparent',
                borderRight: '20px solid transparent',
                borderTop: `32px solid ${theme.colors.secondary}`,
                transform: 'rotate(45deg)',
                transformOrigin: '20% 40%',
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                animation: 'pulse 0.8s ease-in-out infinite',
              }}
            />
          </Sequence>
        </div>
      </div>

      {/* Discovery text */}
      <Sequence from={fps * 1}>
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 48,
            fontWeight: 'bold',
            color: theme.colors.white,
            opacity: interpolate(frame - fps, [0, fps * 0.5], [0, 1]),
          }}
        >
          ¿Y si hubiera una mejor manera?
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};