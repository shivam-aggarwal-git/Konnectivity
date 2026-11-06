// Decode off the playback process; only a bounded primary still image is kept.
import decode from 'heic-decode';
import sharp from 'sharp';
process.once('message',async buffer=>{
 let images;
 try{
  images=await decode.all({buffer:Buffer.from(buffer)});const image=images[0];
  if(!image||image.width*image.height>50000000||image.width>12000||image.height>12000)throw Error('Image dimensions too large');
  const frame=await image.decode();
  const result=await sharp(Buffer.from(frame.data),{raw:{width:frame.width,height:frame.height,channels:4}}).resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
  process.send?.({ok:true,data:result},()=>process.exit(0));
 }catch{process.send?.({ok:false},()=>process.exit(1));}finally{images?.dispose();}
});
