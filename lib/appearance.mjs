export const DEFAULT_APPEARANCE = Object.freeze({theme:'moonlight',motion:true,visualizer:'orbit',lights:'breathe'});
export function appearancePatch(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))return {};
  const patch={};
  if(['moonlight','rosewood','candlelight','aurora','sunset','ocean'].includes(value.theme))patch.theme=value.theme;
  if(['orbit','wave','off'].includes(value.visualizer))patch.visualizer=value.visualizer;
  if(['off','glow','breathe'].includes(value.lights))patch.lights=value.lights;
  if(typeof value.motion==='boolean')patch.motion=value.motion;
  return patch;
}
