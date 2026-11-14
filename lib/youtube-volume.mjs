export function reconcileYouTubeVolume(previous,{desired,actual,audible,now}){
 desired=Math.max(0,Math.min(100,Math.round(desired)));actual=Math.max(0,Math.min(100,Math.round(actual)));
 const state={...previous,prop:desired,audible};
 if(!audible)return {state:{...state,applied:0,pending:null},apply:actual===0?null:0,notify:null};
 if(previous.pending!=null&&now<previous.until&&desired!==previous.pending&&desired===previous.prop)return {state,apply:null,notify:null};
 if(previous.audible&&desired===previous.prop&&previous.applied!=null&&actual!==previous.applied){return {state:{...state,applied:actual,pending:actual,until:now+2500},apply:null,notify:actual/100};}
 return {state:{...state,applied:desired,pending:null},apply:actual===desired?null:desired,notify:null};
}
