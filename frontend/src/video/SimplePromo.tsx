import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from 'remotion';

export const SimplePromo: React.FC = () => {
  const frame = useCurrentFrame();
  
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  const scale = interpolate(frame, [0, 30], [0.8, 1]);

  return (
    <AbsoluteFill style={{backgroundColor: '#B5384D', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{
        opacity,
        transform: `scale(${scale})`,
        textAlign: 'center',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1 style={{fontSize: 60, marginBottom: 20}}>Permisos Digitales</h1>
        <p style={{fontSize: 30}}>Tu permiso en minutos</p>
        
        <Sequence from={60}>
          <div style={{marginTop: 40}}>
            <p style={{fontSize: 24}}>✓ Sin filas</p>
            <p style={{fontSize: 24}}>✓ 100% Digital</p>
            <p style={{fontSize: 24}}>✓ $99 MXN</p>
          </div>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};