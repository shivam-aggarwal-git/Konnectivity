/** Buffering/app echoes are not intent. A native resume must survive a recent sync seek. */
export function nativeTransportIntent({state,desiredPlaying,holding,ready,command,commandUntil,now,lastSeek,requestedAt}){
 if(!ready)return null;
 if(commandUntil>now&&state===command)return null;
 if(state===1&&!desiredPlaying)return true;
 if(state===2&&desiredPlaying&&!holding&&now-requestedAt>=1000&&now-lastSeek>=400)return false;
 return null;
}
