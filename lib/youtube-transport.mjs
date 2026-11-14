/** Native user transport only; buffering, app commands and sync holds are not user intent. */
export function nativeTransportIntent({state,desiredPlaying,holding,ready,command,commandUntil,now,lastSeek,requestedAt}){
 if(!ready||holding||now-requestedAt<1000||now-lastSeek<400)return null;
 if(commandUntil>now&&state===command)return null;
 if(state===2&&desiredPlaying)return false;
 if(state===1&&!desiredPlaying)return true;
 return null;
}
