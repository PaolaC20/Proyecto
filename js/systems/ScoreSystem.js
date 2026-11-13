export class ScoreSystem{constructor(){this.base=200}resetCombo(game){game.combo=this.base}enemyDestroyed(game){game.score+=game.combo;game.combo*=2}}
