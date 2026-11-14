'use client';
import {useState} from 'react';
import {Search,X,ArrowRight} from 'lucide-react';
import {searchSettings,SETTINGS_INDEX} from '@/lib/settings-search.mjs';
export default function SettingsSearch({host,owner,scoped,onSelect}:{host:boolean;owner:boolean;scoped:boolean;onSelect:(id:string)=>void}){
 const[query,setQuery]=useState('');
 const entries=SETTINGS_INDEX.filter(item=>!(['hosts','permissions','saved'].includes(item.id)&&!host)&&!(item.id==='integrations'&&!owner)&&!(item.id==='discovery'&&(!host||!scoped)));
 const results=searchSettings(query,entries);
 return <div className="kn-settings-search"><div className="kn-settings-search-field"><Search size={18}/><input type="search" aria-label="Search all settings" placeholder="Search all settings…" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setQuery('');}if(e.key==='Enter'&&results[0]){e.preventDefault();onSelect(results[0].id);setQuery('');}}}/>{query&&<button type="button" aria-label="Clear settings search" onClick={()=>setQuery('')}><X size={18}/></button>}</div>{query.trim()&&<div className="kn-settings-search-results" aria-label="Settings search results"><p role="status">{results.length?`${results.length} matching settings`:'No matching settings. Try “cookies”, “theme” or “host”.'}</p>{results.map(item=><button key={item.id} type="button" onClick={()=>{onSelect(item.id);setQuery('');}}><span><strong>{item.label}</strong><small>{item.path}</small></span><ArrowRight size={16}/></button>)}</div>}</div>;
}
