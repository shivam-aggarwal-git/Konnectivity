import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { BRANDING_MAX_BYTES } from "@/lib/branding-limit.mjs";
import { requireAdmin } from "@/lib/guard";
import { limitedBytes } from "@/lib/request-body";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ asset: string }> };
const directory = path.resolve(process.env.DATA_DIR || "./data", "branding");

function assetFile(asset: string) {
  if (asset === "logo" || asset === "favicon") return path.join(directory, asset + ".png");
  return null;
}

export async function GET(req: Request, { params }: Context) {
  const { asset } = await params;
  const file = assetFile(asset);
  if (!file) return new Response(null, { status: 404 });

  const query = new URL(req.url).searchParams;
  const size = query.get("size");
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "image/png" });
  try {
    const original = await readFile(file);
    const bytes = asset === "favicon" && (size === "32" || size === "192")
      ? await sharp(original).resize(Number(size)).png().toBuffer()
      : original;
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (asset === "logo") {
    const light = query.get("theme") === "light";
    headers.set("Content-Type", "image/webp");
    return new Response(new Uint8Array(await readFile(
      path.join("public", light ? "konnectivity-logo-light.webp" : "konnectivity-logo.webp"),
    )), { headers });
  }

  const fallback = size === "32" ? "konnectivity-favicon-light.png"
    : size === "192" ? "icon-light-192.png" : "konnectivity-logo-light.png";
  return new Response(new Uint8Array(await readFile(path.join("public", fallback))), { headers });
}

export async function PUT(req: Request, { params }: Context) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const file = assetFile((await params).asset);
  if (!file) return new Response(null, { status: 404 });

  let bytes: Uint8Array;
  try {
    bytes = await limitedBytes(req, BRANDING_MAX_BYTES);
  } catch {
    return NextResponse.json({ error: "Image must be 4 MB or smaller." }, { status: 413 });
  }

  let png: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000 });
    const { format } = await image.metadata();
    if (format !== "jpeg" && format !== "png" && format !== "webp") throw new Error();
    png = await image.rotate().resize(512, 512, {
      fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
  } catch {
    return NextResponse.json({ error: "Use a valid PNG, JPEG or WebP up to 16 megapixels." }, { status: 415 });
  }

  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = file + "." + randomUUID();
  try {
    await writeFile(temporary, png, { mode: 0o600 });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Context) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const file = assetFile((await params).asset);
  if (!file) return new Response(null, { status: 404 });
  await rm(file, { force: true });
  return NextResponse.json({ ok: true });
}
