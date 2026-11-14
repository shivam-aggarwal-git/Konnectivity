import {NextRequest,NextResponse} from 'next/server';
import {recommendedTracks} from '@/lib/recommendations.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams,title=p.get('title')?.trim(),artist=p.get('artist')?.trim()||'';
 if(!title)return NextResponse.json({results:[],source:'none'});
 const page=Math.min(5,Math.max(0,Number(p.get('page'))||0)),limit=Math.min(8,Math.max(1,Number(p.get('limit'))||5));
 try{const rows=await recommendedTracks({title,artist,videoId:p.get('videoId')||''},{limit:40});const offset=rows.length?page*limit%rows.length:0;return NextResponse.json({results:[...rows.slice(offset),...rows.slice(0,offset)].slice(0,limit),source:'artist',seedArtist:artist},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({results:[],error:'Similar songs are unavailable. Try again.'},{status:502});}
}
