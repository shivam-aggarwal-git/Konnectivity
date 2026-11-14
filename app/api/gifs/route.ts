import {NextRequest,NextResponse} from 'next/server';
import {searchGiphy,giphyConfigured} from '@/lib/giphy-service.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const q=request.nextUrl.searchParams.get('q')?.trim()||'';
 if(q.length>70)return NextResponse.json({error:'Search up to 70 characters.'},{status:400});
 if(!giphyConfigured())return NextResponse.json({error:'Configure GIPHY once in server settings to enable GIFs in every room.'},{status:503});
 try{return NextResponse.json(await searchGiphy(q,Number(request.nextUrl.searchParams.get('offset'))||0),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'GIPHY is unavailable. Try again shortly.'},{status:502});}
}
