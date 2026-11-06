export const DEFAULT_APPEARANCE = Object.freeze({theme:'moonlight',motion:true,visualizer:'orbit',lights:'breathe',background:'none',backgroundImageId:null,backgroundDim:.58,showArtwork:true,backgroundFit:"cover",backgroundX:50,backgroundY:50,backgroundZoom:1,backgroundBlur:0});
export function appearancePatch(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))return {};
  const patch={};
  if(['moonlight','rosewood','candlelight','aurora','sunset','ocean'].includes(value.theme))patch.theme=value.theme;
  if(['orbit','wave','off'].includes(value.visualizer))patch.visualizer=value.visualizer;
  if(['off','glow','breathe'].includes(value.lights))patch.lights=value.lights;
  if(typeof value.motion==='boolean')patch.motion=value.motion;
  if(['none','photo','artwork'].includes(value.background))patch.background=value.background;
  if(value.backgroundImageId===null || (typeof value.backgroundImageId==='string'&&/^[a-f0-9]{32}$/.test(value.backgroundImageId)))patch.backgroundImageId=value.backgroundImageId;
  if(typeof value.backgroundDim==='number'&&Number.isFinite(value.backgroundDim))patch.backgroundDim=Math.max(.25,Math.min(.85,value.backgroundDim));
  if(typeof value.showArtwork==='boolean')patch.showArtwork=value.showArtwork;
  if(['cover','contain'].includes(value.backgroundFit))patch.backgroundFit=value.backgroundFit;
  for(const [key,min,max] of [['backgroundX',0,100],['backgroundY',0,100],['backgroundZoom',1,3],['backgroundBlur',0,20]]){
    if(typeof value[key]==='number'&&Number.isFinite(value[key]))patch[key]=Math.max(min,Math.min(max,value[key]));
  }
  return patch;
}
