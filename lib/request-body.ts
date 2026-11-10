export async function limitedBytes(req:Request,max:number){const reader=req.body?.getReader();if(!reader)return new Uint8Array();const parts:Uint8Array[]=[];let size=0;for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('Request body is too large');}parts.push(value);}const output=new Uint8Array(size);let offset=0;for(const p of parts){output.set(p,offset);offset+=p.length;}return output;}
export async function limitedJson(req:Request,max=16384){return JSON.parse(await limitedText(req,max)||'{}');}

export async function limitedText(req:Request,max=16384){return new TextDecoder().decode(await limitedBytes(req,max));}
