import type {Motion} from './schema';

// Share timing between the rendered strike and its non-interruptible input window.
export const ATTACK_SPEED=1.5;
export const ATTACK_DURATION=1.9/ATTACK_SPEED;
export function isAttack(motion:Motion):boolean{
 return motion==='attack'||motion==='attackLateral'||motion==='walkAttackLateral'||motion==='runAttackLateral'||motion==='backwardAttackLateral';
}
