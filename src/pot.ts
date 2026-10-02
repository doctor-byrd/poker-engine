/** Serializable snapshot of a Pot. */
export interface PotData {
  betInTable: number;
}

/**
 * Represents the pot in a poker hand: all chips wagered during the hand.
 */
export class Pot {
  betInTable: number; // total chips in pot

  constructor(betInTable = 0) {
    this.betInTable = betInTable;
  }

  /** Add chips to the pot. */
  add(bet = 0): void {
    if (bet > 0) this.betInTable += bet;
  }

  /** Clear the pot and return a copy (used when awarding pot to winners). */
  takeAll(): Pot {
    const potCopy = new Pot(this.betInTable);
    this.betInTable = 0;
    return potCopy;
  }

  toJSON(): PotData {
    return { betInTable: this.betInTable };
  }

  static from(data: PotData): Pot {
    return new Pot(data.betInTable);
  }
}