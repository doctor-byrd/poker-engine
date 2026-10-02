import { CardData, PlayerLike } from './constants.js';

/** A human (or generic) player at the table. */
export class Player implements PlayerLike {
  chair: number;
  chips: number;
  isFirstDecision = true;
  bet = 0;
  lose: boolean;
  showHand = false;
  hand: CardData[] = [];
  wins = 0;
  successiveWins = 0;
  successiveLose = 0;
  onFire = 0;
  lucky = false;
  roundPosition = -1;
  decisionCounter = 1;
  userId?: string;
  isHuman = false;

  constructor(chair: number, chips: number) {
    this.chair = chair;
    this.chips = chips;
    this.lose = chips === 0;
  }

  /** Force a bet (blinds, calls); capped by remaining chips. Returns actual amount bet. */
  forcedBet(bet: number): number {
    const actualBet = Math.min(bet, this.chips);
    this.bet += actualBet;
    this.chips -= actualBet;
    return actualBet;
  }

  setHand(newHand: CardData[]): void {
    this.hand = [...newHand];
  }

  getMinRaiseAmount(chipNeedToCall: number, bigBlind: number): number {
    return chipNeedToCall === 0 ? bigBlind : 2 * chipNeedToCall;
  }

  getChips(): number { return this.chips; }
  getHand(): CardData[] { return this.hand; }
  addChips(chips: number): void { this.chips += chips; }

  win(): void {
    this.wins++;
    this.successiveWins++;
    this.successiveLose = 0;
  }

  toLose(): void {
    this.successiveLose++;
    this.onFire = 0;
    this.lucky = false;
    this.successiveWins = 0;
  }

  getBet(): number { return this.bet; }
  fold(): void { this.lose = true; }
  resetCards(): void { this.hand = []; }

  resetLose(): void {
    this.hand = [];
    this.lose = false;
    this.isFirstDecision = true;
    this.showHand = false;
    this.decisionCounter = 1;
  }

  resetBet(): void { this.bet = 0; }
}