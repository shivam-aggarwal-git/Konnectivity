'use client';
const dots:Record<number,number[]>={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
export default function GameDie({value,rolling,name}:{value?:number;rolling:boolean;name:string}){
 return <div className="kn-die-player"><div className="kn-die-scene" role="img" aria-label={`${name}: ${rolling?'rolling':value||'not rolled'}`}><div className="kn-die" data-rolling={rolling} key={value||0}>{Array.from({length:9},(_,i)=><i key={i} data-dot={Boolean(value&&dots[value]?.includes(i+1))}/>)}</div></div><strong>{name}</strong><small>{rolling?'Rolling…':value?`${value}`:'Ready to roll'}</small></div>;
}
