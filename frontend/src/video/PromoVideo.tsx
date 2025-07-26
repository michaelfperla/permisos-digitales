import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import {IntroScene} from './scenes/IntroScene';
import {FeaturesScene} from './scenes/FeaturesScene';
import {ProcessScene} from './scenes/ProcessScene';
import {PaymentScene} from './scenes/PaymentScene';
import {BenefitsScene} from './scenes/BenefitsScene';
import {CTAScene} from './scenes/CTAScene';

export const PromoVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Scene durations in frames
  const introDuration = 90; // 3 seconds
  const featuresDuration = 90; // 3 seconds
  const processDuration = 90; // 3 seconds
  const paymentDuration = 60; // 2 seconds
  const benefitsDuration = 60; // 2 seconds
  const ctaDuration = 60; // 2 seconds

  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a1a'}}>
      <Sequence from={0} durationInFrames={introDuration}>
        <IntroScene />
      </Sequence>

      <Sequence from={introDuration} durationInFrames={featuresDuration}>
        <FeaturesScene />
      </Sequence>

      <Sequence from={introDuration + featuresDuration} durationInFrames={processDuration}>
        <ProcessScene />
      </Sequence>

      <Sequence 
        from={introDuration + featuresDuration + processDuration} 
        durationInFrames={paymentDuration}
      >
        <PaymentScene />
      </Sequence>

      <Sequence 
        from={introDuration + featuresDuration + processDuration + paymentDuration} 
        durationInFrames={benefitsDuration}
      >
        <BenefitsScene />
      </Sequence>

      <Sequence 
        from={introDuration + featuresDuration + processDuration + paymentDuration + benefitsDuration} 
        durationInFrames={ctaDuration}
      >
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};