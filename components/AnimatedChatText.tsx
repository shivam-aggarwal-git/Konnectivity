import { cn } from "@/lib/cn";

export default function AnimatedChatText({text}: {text:string}) {
  const stripped=text.trim().replace(/[\p{Emoji_Modifier}\uFE0F\u200D\s]/gu,"");
  const large=/^\p{Extended_Pictographic}{1,4}$/u.test(stripped);
  return <span className={cn("whitespace-pre-wrap break-words",large&&"kn-large-chat-emoji")}>{text}</span>;
}
