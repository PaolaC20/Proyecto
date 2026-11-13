import {cloneMap} from '../utils/MapLoader.js';export class LevelSystem{constructor(){this.level=1}next(game){this.level++;game.level=this.level;game.map=cloneMap(game.map);game.resetRound()}}
