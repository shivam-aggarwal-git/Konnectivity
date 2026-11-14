import { cn } from "@/lib/cn";
import {chatTextParts} from '@/lib/chat-text.mjs';
export default function AnimatedChatText({text}: {text:string}) {
 const stripped=text.trim().replace(/[\p{Emoji_Modifier}\uFE0F\u200D\s]/gu,"");
 const large=/^\p{Extended_Pictographic}{1,4}$/u.test(stripped);
 return <span className={cn("kn-chat-text whitespace-pre-wrap break-words",large&&"kn-large-chat-emoji")}>{chatTextParts(text).map((part:{text:string;href?:string},i:number)=>part.href?<a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="kn-chat-link">{part.text}</a>:part.text)}</span>;
}
