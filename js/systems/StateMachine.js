export class StateMachine{constructor(owner){this.owner=owner}set(state){this.owner.setState(state)}get(){return this.owner.state}}
