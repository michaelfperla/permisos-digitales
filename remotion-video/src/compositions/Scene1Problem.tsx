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

export const Scene1Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animations
  const peopleProgress = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  const clockRotation = interpolate(frame, [0, fps * 8], [0, 720], {
    extrapolateRight: 'clamp',
  });

  const textOpacity = interpolate(frame, [fps * 2, fps * 2.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const frustrationScale = spring({
    frame: frame - fps * 3,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
    },
  });

  // Clock time animation
  const startMinutes = 47;
  const endMinutes = startMinutes + Math.floor((frame / fps) * 15);
  const hours = 11 + Math.floor(endMinutes / 60);
  const minutes = endMinutes % 60;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(to bottom, ${theme.colors.gray[200]} 0%, ${theme.colors.gray[300]} 100%)`,
      }}
    >
      {/* Clock */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          right: 100,
          width: 200,
          height: 200,
          backgroundColor: theme.colors.white,
          borderRadius: '50%',
          border: `8px solid ${theme.colors.text}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          fontWeight: 'bold',
          color: theme.colors.text,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        }}
      >
        {hours}:{minutes.toString().padStart(2, '0')}
        
        {/* Clock hands */}
        <div
          style={{
            position: 'absolute',
            width: 4,
            height: 60,
            backgroundColor: theme.colors.text,
            bottom: '50%',
            transformOrigin: 'center bottom',
            transform: `rotate(${clockRotation}deg)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 2,
            height: 80,
            backgroundColor: theme.colors.text,
            bottom: '50%',
            transformOrigin: 'center bottom',
            transform: `rotate(${clockRotation * 12}deg)`,
          }}
        />
      </div>

      {/* Queue of people */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: '60%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-evenly',
          padding: '0 100px',
        }}
      >
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 80,
              height: 220,
              backgroundColor: theme.colors.gray[600],
              borderRadius: '40px 40px 0 0',
              opacity: interpolate(
                peopleProgress,
                [i * 0.1, i * 0.1 + 0.1],
                [0, 1]
              ),
              transform: `translateY(${interpolate(
                peopleProgress,
                [i * 0.1, i * 0.1 + 0.1],
                [100, 0]
              )}px)`,
            }}
          >
            {/* Head */}
            <div
              style={{
                position: 'absolute',
                top: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 60,
                height: 60,
                backgroundColor: theme.colors.gray[700],
                borderRadius: '50%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Ticket number */}
      <Sequence from={fps * 1.5}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: theme.colors.white,
            padding: '60px 80px',
            borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            fontSize: 72,
            fontWeight: 'bold',
            color: theme.colors.text,
            opacity: textOpacity,
          }}
        >
          C-125
        </div>
      </Sequence>

      {/* Frustration text */}
      <Sequence from={fps * 3}>
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: `translateX(-50%) scale(${frustrationScale})`,
            fontSize: 64,
            fontWeight: 'bold',
            color: theme.colors.primary,
            textShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}
        >
          4 horas perdidas...
        </div>
      </Sequence>

      {/* Current serving number */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 100,
          padding: '20px 40px',
          backgroundColor: theme.colors.gray[800],
          color: theme.colors.white,
          borderRadius: 10,
          fontSize: 24,
          opacity: textOpacity,
        }}
      >
        Atendiendo: A-047
      </div>
    </AbsoluteFill>
  );
};