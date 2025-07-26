import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo } from './compositions/PromoVideo';
import { Scene1Problem } from './compositions/Scene1Problem';
import { Scene2Discovery } from './compositions/Scene2Discovery';
import { Scene3Demo } from './compositions/Scene3Demo';
import { Scene4Success } from './compositions/Scene4Success';
import { Scene5CTA } from './compositions/Scene5CTA';

// Video configuration
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Scene durations in frames
const SCENE_DURATIONS = {
  scene1: 8 * FPS,    // 8 seconds
  scene2: 5 * FPS,    // 5 seconds
  scene3: 20 * FPS,   // 20 seconds
  scene4: 10 * FPS,   // 10 seconds
  scene5: 17 * FPS,   // 17 seconds
};

const TOTAL_DURATION = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main 60-second promo video */}
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          sceneDurations: SCENE_DURATIONS,
        }}
      />

      {/* Individual scenes for testing */}
      <Composition
        id="Scene1"
        component={Scene1Problem}
        durationInFrames={SCENE_DURATIONS.scene1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="Scene2"
        component={Scene2Discovery}
        durationInFrames={SCENE_DURATIONS.scene2}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="Scene3"
        component={Scene3Demo}
        durationInFrames={SCENE_DURATIONS.scene3}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="Scene4"
        component={Scene4Success}
        durationInFrames={SCENE_DURATIONS.scene4}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="Scene5"
        component={Scene5CTA}
        durationInFrames={SCENE_DURATIONS.scene5}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};