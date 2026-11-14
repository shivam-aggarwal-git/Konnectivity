/** Only web links become navigation targets; text is always rendered as text. */
export function chatTextParts(text){
 const parts=[];let cursor=0;
 for(const match of text.matchAll(/https?:\/\/[^\s<>]+/giu)){
  const raw=match[0],url=raw.replace(/[.,!?;:)\]}]+$/u,'');
  if(match.index>cursor)parts.push({text:text.slice(cursor,match.index)});
  parts.push({text:url,href:url});cursor=match.index+url.length;
 }
 if(cursor<text.length)parts.push({text:text.slice(cursor)});
 return parts;
}
