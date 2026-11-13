export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const key=(x,y)=>`${x},${y}`;
export function tileOf(entity,tile){return {x:Math.floor(entity.x/tile),y:Math.floor(entity.y/tile)}}
export function centerTile(t,tile){return {x:t.x*tile+tile/2,y:t.y*tile+tile/2}}
