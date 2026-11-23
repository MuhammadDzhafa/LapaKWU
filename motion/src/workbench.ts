import {BLEND, CAPTIONS, WIPES, DemoCaption, ShotWithTail, DemoWipe, LapaDemo} from './Demo';
import {FPS, TOTAL, SHOTS, SFX, MUSIC} from './demo-timeline';

export const WORKBENCH={
  name:'LapaKWU · Demo 55 detik',
  fps:FPS,width:1920,height:1080,total:TOTAL,
  background:'#fff8e6',
  shots:SHOTS.map((shot,index)=>({id:shot.id,label:shot.title,from:shot.from,
    duration:shot.duration+(index<SHOTS.length-1?BLEND:0),
    component:ShotWithTail,props:{shot},cardId:'lapakwu-shot'})),
  transitions:WIPES.map(wipe=>({...wipe,label:'Transisi',component:DemoWipe,props:{tone:wipe.tone,variant:wipe.variant}})),
  captions:CAPTIONS.map(cue=>({...cue,label:cue.caption,component:DemoCaption,
    props:{caption:cue.caption},schema:[{key:'caption',type:'textarea',label:'Caption',default:cue.caption}]})),
  sfx:SFX,bgm:[{from:0,duration:TOTAL,...MUSIC}],
  order:['transitions','captions','overlays'],
  original:LapaDemo,
};
