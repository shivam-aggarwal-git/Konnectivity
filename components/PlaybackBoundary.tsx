"use client";
import {Component,type ReactNode} from 'react';
/** Keep media-view/preload errors away from the room's audio and transport. */
export default class PlaybackBoundary extends Component<{children:ReactNode;silent?:boolean;onMusic?:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 componentDidCatch(error:Error){console.error('Playback view could not load',error);}
 render(){
  if(!this.state.failed)return this.props.children;
  if(this.props.silent)return null;
  return <section className="kn-player-recovery" role="alert"><p>The player view could not load. Your room controls are still available.</p><div><button type="button" onClick={()=>this.setState({failed:false})}>Retry player</button>{this.props.onMusic&&<button type="button" onClick={this.props.onMusic}>Play as music</button>}</div></section>;
 }
}
