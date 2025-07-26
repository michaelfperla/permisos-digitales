import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Use software rendering for better compatibility
Config.setChromiumOpenGlRenderer('angle');

// Set concurrency for faster rendering
Config.setConcurrency(1);

// Set default props
Config.setStillImageFormat('png');

export {};