import React from 'react';
import {Composition} from 'remotion';
import {PromoVideo} from './PromoVideo';
import {SimplePromo} from './SimplePromo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={450} // 15 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="SimplePromo"
        component={SimplePromo}
        durationInFrames={150} // 5 seconds at 30fps
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />
    </>
  );
};