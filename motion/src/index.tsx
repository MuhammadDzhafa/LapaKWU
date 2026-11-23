import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {LapaDemo} from './Demo';
import {FPS, TOTAL} from './demo-timeline';

registerRoot(()=> <>
  <Composition id="LapaKWU-Demo55" component={LapaDemo} width={1920} height={1080} fps={FPS} durationInFrames={TOTAL} defaultProps={{bgm:true}}/>
  <Composition id="LapaKWU-Mobile55" component={LapaDemo} width={1920} height={1080} fps={60} durationInFrames={TOTAL*2} defaultProps={{bgm:true,mobile:true}}/>
</>);
