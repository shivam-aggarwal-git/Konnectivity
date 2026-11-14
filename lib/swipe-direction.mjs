export function verticalSwipe(start,end){
 const dx=end.x-start.x,dy=end.y-start.y;
 if(Math.abs(dy)<36||Math.abs(dy)<Math.abs(dx)*1.2)return 0;
 return dy<0?1:-1;
}
