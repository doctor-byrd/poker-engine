/**
 * Represents the pot in a poker hand.
 * Contains cash (chips / stablecoin dollars) and wagered house NFTs (by ID).
 */
export class Pot {
  betInTable: number; // total cash chips in pot (whole dollars)
  houseId: string[]; // array of house UUIDs (or token IDs) wagered

  constructor(betInTable = 0, houseId: string[] = []) {
    this.betInTable = betInTable;
    this.houseId = [...houseId];
  }

  /** Add cash and/or houses to the pot. */
  add(bet = 0, houseIds: string[] = []): void {
    if (bet > 0) this.betInTable += bet;
    if (houseIds.length) this.houseId.push(...houseIds);
  }

  /** Clear the pot and return a copy (used when awarding pot to winners). */
  takeAll(): Pot {
    const potCopy = new Pot(this.betInTable, this.houseId);
    this.betInTable = 0;
    this.houseId = [];
    return potCopy;
  }

  /** Total value (cash + sum of house values) – requires external house value mapping. */
  totalValue(houseValueMap: Record<string, number>): number {
    let houseTotal = 0;
    for (const id of this.houseId) {
      houseTotal += houseValueMap[id] || 0;
    }
    return this.betInTable + houseTotal;
  }

  toJSON(): { betInTable: number; houseId: string[] } {
    return { betInTable: this.betInTable, houseId: [...this.houseId] };
  }

  static from(data: { betInTable: number; houseId: string[] }): Pot {
    return new Pot(data.betInTable, data.houseId);
  }
}