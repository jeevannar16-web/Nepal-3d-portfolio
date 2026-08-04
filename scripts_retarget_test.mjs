import { readFileSync } from 'fs'
function parseGLB(path){const buf=readFileSync(path);const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);let off=12,json=null;while(off<buf.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);const start=off+8;if(type===0x4e4f534a){json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer,buf.byteOffset+start,len)));break}off+=8+len+((len%4)?(4-len%4):0)}return json}
for (const [label,path] of [['SOLDIER','public/models/soldier.glb'],['AVATURN','avaturn.glb']]) {
  const g=parseGLB(path)
  const nameOf=i=>g.nodes[i].name
  const parentOf=new Array(g.nodes.length).fill(-1)
  g.nodes.forEach((n,i)=>n.children?.forEach(c=>parentOf[c]=i))
  console.log(`\n=== ${label} ===`)
  for (const nm of ['Hips','Spine','Spine1','Spine2','Neck','Head','LeftUpLeg','LeftLeg','LeftFoot']) {
    const i=g.nodes.findIndex(n=>n.name===nm||n.name==="mixamorig:"+nm)
    const n=g.nodes[i]
    console.log(nm.padEnd(10),'parent:',parentOf[i]>=0?nameOf(parentOf[i]):'ROOT', '| localT:', JSON.stringify(n.translation??[0,0,0]), '| localQ:', JSON.stringify(n.rotation?n.rotation.map(x=>+x.toFixed(3)):[0,0,0,1]))
  }
}
