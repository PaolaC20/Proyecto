export const TILE=32;
export const ROWS=15;
export const COLS=25;
export const WIDTH=COLS*TILE;
export const HEIGHT=ROWS*TILE;
export const STATE={SPAWN:'SPAWN',SCATTER:'SCATTER',CHASE:'CHASE',FRIGHTENED:'FRIGHTENED',RETURN:'RETURN'};
export const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0},none:{x:0,y:0}};
export const KEY={up:['ArrowUp','w','W'],down:['ArrowDown','s','S'],left:['ArrowLeft','a','A'],right:['ArrowRight','d','D']};
