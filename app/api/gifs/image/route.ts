import { NextRequest, NextResponse } from "next/server";
import { gifUploadOrigin, gifUploadPath } from "@/lib/gif-image";

export const dynamic = "force-dynamic";
const maxBytes = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file") || "";
  if (file.length > 1024 || !gifUploadPath(file)) return new NextResponse(null,{status:400});
  try {
    const source = await fetch(gifUploadOrigin + file, {
      redirect:"error", signal:AbortSignal.timeout(10000), cache:"no-store",
      headers:{"User-Agent":"Konnectivity (https://github.com/shivam-aggarwal-git/Konnectivity)","Accept":"image/gif"},
    });
    if (!source.ok || !source.body || !/^image\/gif(?:;|$)/i.test(source.headers.get("content-type") || "") ||
        Number(source.headers.get("content-length")) > maxBytes) {
      await source.body?.cancel();
      return new NextResponse(null,{status:404});
    }
    const reader=source.body.getReader();
    const stream=new ReadableStream<Uint8Array>({
      async pull(controller) {
        const {done,value}=await reader.read();
        if (done) { controller.close(); return; }
        bytes+=value.byteLength;
        if (bytes>maxBytes) { await reader.cancel();controller.error(Error("GIF exceeds size limit"));return; }
        controller.enqueue(value);
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    let bytes=0;
    return new NextResponse(stream,{headers:{
      "Content-Type":"image/gif","X-Content-Type-Options":"nosniff","Cache-Control":"private, max-age=300",
    }});
  } catch { return new NextResponse(null,{status:502}); }
}
