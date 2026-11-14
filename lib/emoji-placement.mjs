/** A transformed dialog is the fixed-position containing block for its portal. */
export function emojiPlacement(trigger,container,viewport){
 const bounds=container||{left:0,top:0,width:viewport.width,height:viewport.height};
 const width=Math.min(320,bounds.width-24,viewport.width-24),height=Math.min(420,bounds.height-24,viewport.height*.5);
 return {left:Math.max(12,Math.min(bounds.width-width-12,trigger.right-bounds.left-width)),top:Math.max(12,Math.min(bounds.height-height-12,trigger.top-bounds.top-height-8)),width,maxHeight:height};
}
