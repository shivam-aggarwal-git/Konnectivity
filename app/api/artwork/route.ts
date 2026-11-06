import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
/** Fixed upstream only: never fetch a client-supplied URL or forward cookies. */
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('videoId')||'';
 if(!/^[\w-]{11}$/.test(id))return NextResponse.json({error:'invalid_video'},{status:400});
 try{
  const response=await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,{signal:AbortSignal.timeout(7000),redirect:'error'});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/jpeg'))throw Error();
  const reader=response.body?.getReader();if(!reader)throw Error();
  const chunks:Uint8Array[]=[];let total=0;
  for(;;){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>512*1024){await reader.cancel();throw Error();}chunks.push(value);}
  const body=new Uint8Array(total);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  return new NextResponse(body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
 }catch{return NextResponse.json({error:'artwork_unavailable'},{status:502});}
}
