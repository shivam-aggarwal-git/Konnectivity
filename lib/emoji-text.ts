const emoticons:Record<string,string>={":)":"🙂",":-)":"🙂",":D":"😄",":-D":"😄",":P":"😛",":p":"😛",":-P":"😛",";)":"😉",";-)":"😉",":(":"🙁",":-(":"🙁","<3":"❤️"};
export function normalizeEmojiText(text:string){return text.replace(/(^|\s)(:-?\)|:-?[DPp]|;-?\)|:-?\(|<3)(?=\s|$)/g,(_,space,face)=>space+(emoticons[face]||face));}
