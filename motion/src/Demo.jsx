import React from 'react';
import {AbsoluteFill, Freeze, Html5Audio, Img, OffthreadVideo, Sequence, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {PageCam} from './PageCam';
import {FPS, TOTAL, SHOTS, SFX, MUSIC} from './demo-timeline';
import layout from '../public/demo/ui/layout.json';
import clips from '../public/demo/live/clips.json';
import mobileClips from '../public/demo/mobile/clips.json';
import './demo.css';

const out = Easing.bezier(.18,.8,.26,1);
const dolly = Easing.bezier(.45,0,.18,1);
const go = (f,a,b,easing=out) => interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing});
const ui = (file) => staticFile('demo/ui/'+file);
const mix = (a,b,t) => a+(b-a)*t;
const useRate=()=>useVideoConfig().fps/FPS;
const useEditFrame=()=>useCurrentFrame()/useRate();

function Wordmark(){
  return <span className="d-brand">Lapa<b>KWU</b></span>;
}

function Cursor({frame,action,left,top}){
  const approach=go(frame,action-21,action-5);
  const pulse=go(frame,action,action+18,Easing.linear);
  const recoil=frame<action ? 1 : 1-.16*Math.sin(Math.PI*go(frame,action,action+9,Easing.linear));
  return <div className="d-cursor" style={{left,top,opacity:approach*(1-go(frame,action+24,action+39)),transform:`translate(${mix(135,0,approach)}px,${mix(82,0,approach)-24*Math.sin(Math.PI*approach)}px)`}}>
    {frame>=action && <span className="d-ripple" style={{opacity:.8*(1-pulse),transform:`scale(${.3+1.3*pulse})`}}/>}
    <svg width="47" height="52" viewBox="0 0 47 52" style={{transform:`scale(${recoil})`,transformOrigin:'0 0'}}><path d="M3 3L34 31L20 32L13 45Z" fill="#22313f" stroke="#fff8e6" strokeWidth="3" strokeLinejoin="round"/></svg>
  </div>;
}

function Bezel(){
  return <div className="d-bezel"><i/><i/><i/><span>localhost:3000</span></div>;
}

export const BLEND=17;
const transitionEase=Easing.bezier(.65,0,.25,1);
const transitionStyle=shot=>['map','end'].includes(shot.id)?'iris':['cart','cash','partner','wallet'].includes(shot.id)?'lift':'slice';

const mask=(style,p)=>{
  if(p>=1) return 'none';
  if(style==='iris') return `circle(${p*1340}px at 64% 52%)`;
  if(style==='lift') return `polygon(0 ${100-100*p}%, 100% ${110-110*p}%, 100% 100%, 0 100%)`;
  return `polygon(${Math.max(0,100-107*p)}% 0, 100% 0, 100% 100%, ${Math.max(0,113-113*p)}% 100%)`;
};

function LiveScreen({clip,action,mobile=false}){
  const f=useCurrentFrame();
  const rate=useRate();
  const start=(action-clip.action)*rate;
  const duration=clip.frames*rate;
  const cursor=f-start;
  const video=<OffthreadVideo src={staticFile('demo/'+(mobile?'mobile':'live')+'/'+clip.file)} muted
    style={{width:'100%',height:'100%',display:'block',objectFit:'contain'}}/>;
  if(cursor<0 || cursor>=duration) return <Freeze frame={Math.max(0,Math.min(duration-rate,cursor))}>{video}</Freeze>;
  return <Sequence from={start} durationInFrames={duration} layout="none">{video}</Sequence>;
}

function Phone({shot,drive,entry}){
  const clip=mobileClips[shot.id];
  if(!clip) throw new Error('Mobile capture missing: '+shot.id);
  return <div className="d-iphone" style={{transform:`perspective(1800px) translate3d(${-drive*.5}px,${(1-entry)*37}px,0) rotateY(${(1-entry)*-8}deg) rotateZ(${-1.7+entry*1.3}deg)`}}>
    <div className="d-phone-top"><span>9:41</span><i/><span>●◔ ▰</span></div>
    <div className="d-phone-screen"><LiveScreen clip={clip} action={shot.id==='open'?clip.action:shot.action} mobile/></div>
    <div className="d-phone-bottom"><span/></div>
  </div>;
}

function Browser({shot, page, crop, drive, entry, closeup}){
  const frame=useCurrentFrame();
  const wide=shot.mode==='wide';
  const clip=clips[shot.id];
  const panelW=wide?(clip?1140:1490):1145;
  const panelH=wide?650:675;
  const pageWidth=page.width || 1920;
  const pageHeight=page.height || 1080;
  const detail=page.cutouts[shot.crop];
  const detailW=detail ? Math.min(wide?690:620,Math.max(330,detail.width*1.13),385*detail.width/detail.height) : 0;
  // The camera canvas and the screenshot have independent dimensions.
  const focus=crop || {x:pageWidth/2-460,y:95,width:920,height:530};
  const early={cx:pageWidth/2,cy:wide?focus.y+focus.height*.38:430,zoom:1920/pageWidth,rotX:5,rotY:wide?0:-6,persp:2000};
  const end={cx:focus.x+focus.width/2,cy:focus.y+focus.height/2,
    zoom:Math.min(2.05,Math.max(1.04,Math.min(1690/focus.width,920/focus.height))),
    rotX:1,rotY:0,persp:2150};
  const keys=[{frame:Math.max(0,shot.action-22),...early},{frame:Math.max(24,shot.action-2),...end}];
  const rise=(1-entry)*62;
  const left=wide?(clip?390:215):676;
  const top=wide?258:222;
  return <div className="d-browser" style={{left,top,width:panelW,height:panelH,transform:`translate(${(1-entry)*62-drive*.7}px,${rise}px) scale(${.96+entry*.04})`}}>
    <Bezel/>
    <div className="d-view">
      {clip ? <LiveScreen clip={clip} action={shot.id==='open'?clip.action:shot.action}/> :
      <div style={{position:'absolute',left:0,top:0,width:1920,height:1080,transform:`scale(${panelW/1920})`,transformOrigin:'0 0'}}>
        <PageCam src={'demo/ui/'+shot.page+'-full.png'} pageW={pageWidth} pageH={pageHeight} keys={keys} ease={Easing.bezier(.55,0,.18,1)}/>
      </div>}
    </div>
    {!clip && crop && shot.interaction && <Cursor frame={frame} action={shot.action} left={panelW*.5} top={40+panelW*540/1920}/>}
    {!clip && detail && <div className="d-popout" style={{width:detailW,
      right:wide?-74:-32,bottom:wide?-34:-44,opacity:closeup,
      transform:`translate(${(1-closeup)*84+drive*.38}px,${(1-closeup)*30}px) scale(${.91+closeup*.09})`}}>
      <Img src={ui(shot.crop+'.png')} style={{display:'block',width:'100%'}}/>
    </div>}
  </div>;
}

export function DemoShot({shot,duration,mobile=false}){
  const f=useEditFrame();
  const page=layout.pages[shot.page];
  const crop=page?.cutouts?.[shot.focus || shot.crop];
  const entry=go(f,0,23);
  const drive=88*(go(f,6,Math.min(136,duration-15),dolly)-.5);
  const closeup=go(f,shot.action,shot.action+16);
  const brand=shot.mode==='brand';
  const wide=shot.mode==='wide'&&!mobile;
  const last=shot.mode==='end';
  return <AbsoluteFill className={'d-stage '+(shot.tone || 'd-cream')+(mobile?' d-mobile':'')} style={{
    clipPath:shot.from?mask(transitionStyle(shot),go(f,0,BLEND,transitionEase)):'none',
  }}>
    <div className="d-grid"/>
    <div className="d-sweep" style={{transform:`translateX(${-drive*.35}px) rotate(-12deg)`}}/>
    <div className="d-orbit" style={{transform:`translateX(${-drive*1.4}px) rotate(-25deg)`}}/>
    <div className="d-top"><Wordmark/><span>{shot.chapter}</span></div>
    {last ? <div className="d-final" style={{transform:`scale(${.96+.04*entry})`}}>
      <div className="d-awning"/><Wordmark/><h1>{shot.title}</h1>
      {page && !mobile && <div className="d-end-preview"><Img src={ui(shot.page+'-full.png')}/></div>}
    </div> : <>
      <div className={'d-heading '+(wide?'d-wide':'')+(brand?' d-opening':'')} style={{opacity:.84+.16*entry,transform:`translateY(${(1-entry)*30}px)`}}>
        <div className="d-kicker"><i/>{shot.kicker}</div>
        <h1>{shot.title}</h1>
      </div>
      {mobile ? <Phone shot={shot} drive={drive} entry={entry}/> : page && <Browser shot={shot} page={page} crop={crop} drive={drive} entry={entry} closeup={closeup}/>}
    </>}
    <div className="d-progress" style={{width:1920*(shot.from+f)/TOTAL}}/>
  </AbsoluteFill>;
}

export function DemoCaption({caption}){
  const frame=useEditFrame();
  return <div className="d-caption" style={{opacity:.84+.16*go(frame,0,12),transform:`translate(-50%,${(1-go(frame,0,12))*8}px)`}}>{caption}</div>;
}

export function DemoWipe({tone,variant}){
  const frame=useEditFrame();
  const p=go(frame,0,BLEND,transitionEase);
  const glow=Math.sin(Math.PI*p);
  if(variant==='iris'){
    return <AbsoluteFill style={{pointerEvents:'none',opacity:.77*glow}}>
      <svg width="1920" height="1080"><circle cx="1229" cy="562" r={p*1340} fill="none" stroke={tone} strokeWidth={24*glow}/></svg>
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={{pointerEvents:'none',opacity:.90*glow}}>
    <div style={variant==='lift'
      ? {position:'absolute',left:0,top:`${100-100*p}%`,width:1960,height:29,transform:'skewY(2deg)',background:`linear-gradient(90deg,transparent,${tone},#fff8e6,${tone})`}
      : {position:'absolute',left:`${100-109*p}%`,top:-80,bottom:-80,width:125,transform:'skewX(10deg)',background:`linear-gradient(90deg,transparent,${tone} 84%,#fff8e6)`}}/>
  </AbsoluteFill>;
}

export const CAPTIONS=SHOTS.map(shot=>({id:shot.id+'-caption',from:shot.from,duration:shot.duration,caption:shot.caption}));
export const WIPES=SHOTS.slice(1).map(shot=>({id:shot.id+'-wipe',from:shot.from,duration:BLEND+1,variant:transitionStyle(shot),tone:shot.tone==='d-blue'?'#73A5CA':'#FFCB56'}));

export function ShotWithTail({shot,mobile=false}){
  const frame=useCurrentFrame();
  const duration=shot.duration*useRate();
  return <Freeze frame={duration-1} active={frame>=duration}>
    <DemoShot shot={shot} duration={shot.duration} mobile={mobile}/>
  </Freeze>;
}

export function LapaDemo({bgm=true,mobile=false}){
  const rate=useRate();
  return <AbsoluteFill style={{background:'#fff8e6'}}>
    {SHOTS.map((shot,index)=><Sequence key={shot.id} name={shot.title} from={shot.from*rate} durationInFrames={(shot.duration+(index<SHOTS.length-1?BLEND:0))*rate} premountFor={FPS*rate}><ShotWithTail shot={shot} mobile={mobile}/></Sequence>)}
    {WIPES.map(wipe=><Sequence key={wipe.id} from={wipe.from*rate} durationInFrames={wipe.duration*rate}><DemoWipe tone={wipe.tone} variant={wipe.variant}/></Sequence>)}
    {CAPTIONS.map(cue=><Sequence key={cue.id} name={cue.caption} from={cue.from*rate} durationInFrames={cue.duration*rate}><DemoCaption caption={cue.caption}/></Sequence>)}
    {bgm&&<Html5Audio src={staticFile(MUSIC.src)} volume={MUSIC.volume}/>}
    {SFX.map(cue=><Sequence key={cue.id} name={cue.label} from={cue.from*rate} durationInFrames={cue.duration*rate} premountFor={FPS*rate}><Html5Audio src={staticFile(cue.src)} volume={cue.volume}/></Sequence>)}
  </AbsoluteFill>;
}
