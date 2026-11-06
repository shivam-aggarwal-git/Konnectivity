import { cn } from "@/lib/cn";
const SIZES = { sm: "size-8", md: "size-10", lg: "size-16" } as const;
export default function Logo({size = "sm", tint, animated, className}: {size?: keyof typeof SIZES; tint?: "brand" | "art"; animated?: boolean; className?: string}) {
  return <img src="/konnectivity-icon.png" alt="" aria-hidden="true" width={512} height={512} className={cn("shrink-0 rounded-xl object-contain", SIZES[size], className)} />;
}
export function Wordmark({size = "sm", className}: {size?: keyof typeof SIZES; className?: string}) {
  return <span className={cn("flex items-center gap-2.5",className)}><Logo size={size}/><span className="font-display text-base font-extrabold tracking-tight">Konnect<span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">ivity</span></span></span>;
}
