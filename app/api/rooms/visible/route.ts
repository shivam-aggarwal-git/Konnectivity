import {NextRequest,NextResponse} from 'next/server';
import {visibleRooms} from '@/lib/rooms.mjs';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){const exclude=request.nextUrl.searchParams.get('exclude')||'';return NextResponse.json({rooms:visibleRooms(exclude)},{headers:{'Cache-Control':'no-store'}});}
