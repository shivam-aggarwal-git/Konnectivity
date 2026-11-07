import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/guard';
import {limitedJson} from '@/lib/request-body';
import {callSettingsStatus,updateCallSettings} from '@/lib/call-settings.mjs';
export const dynamic='force-dynamic';
export async function GET(){const denied=await requireAdmin();if(denied)return denied;return NextResponse.json({settings:callSettingsStatus()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){const denied=await requireAdmin();if(denied)return denied;try{return NextResponse.json({settings:await updateCallSettings(await limitedJson(req))},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
