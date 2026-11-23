import {readFile,writeFile} from 'node:fs/promises';
const timelinePath=new URL('../src/demo-timeline.js',import.meta.url);
const analysisPath=new URL('../public/demo/audio/beat-data.json',import.meta.url);
const [timeline,analysis]=await Promise.all([readFile(timelinePath,'utf8'),readFile(analysisPath,'utf8')]);
const source=timeline.replace(/import analysis from '[^']+';/,'const analysis = '+analysis.trim()+';');
const {SHOTS,SYNC_EVENTS}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const anchors=SYNC_EVENTS.map(event=>({...event,label:event.id+'-'+event.kind}));
for(const shot of SHOTS){
  if(shot.from<0 || shot.duration<30 || shot.action>=shot.duration) throw new Error('Invalid shot timing for '+shot.id);
  console.log(shot.id,shot.from,shot.action,shot.duration);
}
await writeFile(new URL('anchors.json',import.meta.url),JSON.stringify(anchors,null,2)+'\n');
