import React from 'react';
import { Series, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene1Problem } from './Scene1Problem';
import { Scene2Discovery } from './Scene2Discovery';
import { Scene3Demo } from './Scene3Demo';
import { Scene4Success } from './Scene4Success';
import { Scene5CTA } from './Scene5CTA';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

interface PromoVideoProps {
  sceneDurations: {
    scene1: number;
    scene2: number;
    scene3: number;
    scene4: number;
    scene5: number;
  };
}

export const PromoVideo: React.FC<PromoVideoProps> = ({ sceneDurations }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#000',
        fontFamily,
      }}
    >
      <Series>
        <Series.Sequence durationInFrames={sceneDurations.scene1}>
          <Scene1Problem />
        </Series.Sequence>

        <Series.Sequence durationInFrames={sceneDurations.scene2}>
          <Scene2Discovery />
        </Series.Sequence>

        <Series.Sequence durationInFrames={sceneDurations.scene3}>
          <Scene3Demo />
        </Series.Sequence>

        <Series.Sequence durationInFrames={sceneDurations.scene4}>
          <Scene4Success />
        </Series.Sequence>

        <Series.Sequence durationInFrames={sceneDurations.scene5}>
          <Scene5CTA />
        </Series.Sequence>
      </Series>

      {/* Optional: Add background music */}
      {/* <Audio src={staticFile('music.mp3')} volume={0.3} /> */}
    </div>
  );
};