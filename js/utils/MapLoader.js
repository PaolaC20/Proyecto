import {TILE} from './Constants.js';
export const DEFAULT_MAP=[
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
[1,4,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,3,1],
[1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,0,0,1],
[1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
[1,0,1,1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1,0,1],
[1,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1],
[1,1,1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
[1,0,1,1,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,1,1,0,1],
[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
[1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1],
[1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1],
[1,0,1,0,1,1,1,1,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0,1],
[1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];
export function cloneMap(map=DEFAULT_MAP){return map.map(r=>[...r])}
export function isWall(map,x,y){return !map[y]||map[y][x]===1}
export function renderMap(ctx,map){ctx.fillStyle='#050816';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){const v=map[y][x],px=x*TILE,py=y*TILE;if(v===1){ctx.fillStyle='#173b68';ctx.fillRect(px,py,TILE,TILE);ctx.strokeStyle='#285b91';ctx.strokeRect(px+1,py+1,TILE-2,TILE-2)}else{ctx.fillStyle='#071326';ctx.fillRect(px,py,TILE,TILE);if(v===2){ctx.fillStyle='#8fe9ff';ctx.beginPath();ctx.arc(px+16,py+16,4,0,Math.PI*2);ctx.fill()}if(v===3){ctx.strokeStyle='#eaa9ff';ctx.lineWidth=3;ctx.strokeRect(px+6,py+6,20,20)}if(v===4){ctx.fillStyle='#55ffbb';ctx.fillRect(px+10,py+10,12,12)}}}}
