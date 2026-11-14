import{NextRequest,NextResponse}from'next/server';
import{recommendedTracks}from'@/lib/recommendations.mjs';
import{searchYouTubeVideos}from'@/lib/links.mjs';
import{matchingRecommendations}from'@/lib/recommendation-match.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){const p=request.nextUrl.searchParams;const seed={videoId:p.get('videoId')||'',title:(p.get('title')||'').slice(0,200),artist:(p.get('artist')||'').slice(0,100)};if(!/^[\w-]{11}$/.test(seed.videoId)||!seed.title)return NextResponse.json({results:[]});try{let rows=await recommendedTracks(seed,{limit:6});if(!rows.length)rows=matchingRecommendations(await searchYouTubeVideos(`${seed.artist==='Unknown'?'':seed.artist} ${seed.title}`,10),seed);return NextResponse.json({results:rows.slice(0,6).map((track:object)=>({...track,mediaType:'video'}))},{headers:{'Cache-Control':'private,max-age=60'}});}catch{return NextResponse.json({results:[]},{status:502});}}
