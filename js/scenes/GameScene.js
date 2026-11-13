export class GameScene{constructor(game){this.game=game}enter(){this.game.startRound()}update(dt){this.game.update(dt)}draw(ctx){this.game.draw(ctx)}}
