import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/guard';
import {testCallConfiguration} from '@/lib/call-settings.mjs';
export const dynamic='force-dynamic';
export async function POST(){const denied=await requireAdmin();if(denied)return denied;try{return NextResponse.json(await testCallConfiguration(),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
