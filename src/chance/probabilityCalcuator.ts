import { CardData, ChanceResult } from '../constants.js';

/**
 * ProbabilityCalculator – card counting and combinatorial probability.
 * Used by all Chance* classes. The Pascal-triangle `getPatterns` may be
 * overridden (injected) by the HandEvaluator with config.pattern; a built-in
 * implementation is provided as fallback so the class works standalone.
 */
export class ProbabilityCalculator {
  /** Number of unseen cards of a given rank (or suit, or both). */
  getOuts(revealedCards: CardData[], value: number, color = -1): number {
    if (value === -1) {
      return 13 - this.getColorCount(revealedCards, color);           // by suit
    } else if (color === -1) {
      return 4 - this.getValueCount(revealedCards, value);             // by rank
    } else {
      return this.isCardRevealed(revealedCards, value, color) ? 0 : 1; // exact card
    }
  }

  /** Probability (%) of drawing needed cards (multiple independent groups). */
  getOutsPercentage(
    needed: number[], outs: number[], same: boolean[],
    remainingCard: number, cardsInDeck: number
  ): number {
    let totalNeeded = 0;
    let totalOutsPattern = 1;
    for (let i = 0; i < needed.length; i++) {
      if (same[i]) {
        totalOutsPattern *= this.getPatterns(needed[i]!, outs[i]!);
      } else {
        totalOutsPattern *= this.multiplyOuts(outs);
      }
      totalNeeded += needed[i]!;
    }
    const deckAmountTemp = cardsInDeck - totalNeeded;
    const newCardsLeft = remainingCard - totalNeeded;
    if (newCardsLeft > 0) {
      totalOutsPattern *= this.getPatterns(newCardsLeft, deckAmountTemp);
    } else if (newCardsLeft < 0) {
      return 0;
    }
    return (100 * totalOutsPattern) / this.getPatterns(remainingCard, cardsInDeck);
  }

  /** Count how many cards of a given suit are already revealed. */
  getColorCount(revealedCards: CardData[], color: number): number {
    let count = 0;
    for (let i = 0; i < revealedCards.length; i++) {
      if (revealedCards[i]!.color === color) count++;
    }
    return count;
  }

  /** Count how many cards of a given rank are already revealed. */
  getValueCount(revealedCards: CardData[], value: number): number {
    let count = 0;
    for (let i = 0; i < revealedCards.length; i++) {
      if (revealedCards[i]!.value === value) count++;
    }
    return count;
  }

  /** Check if a specific card (value + suit) is already revealed. */
  isCardRevealed(revealedCards: CardData[], value: number, color: number): boolean {
    for (let i = 0; i < revealedCards.length; i++) {
      if (
        (value === -1 || revealedCards[i]!.value === value) &&
        (color === -1 || revealedCards[i]!.color === color)
      ) {
        return true;
      }
    }
    return false;
  }

  /** Combination C(amount, newCard). May be overridden by HandEvaluator with config table. */
  getPatterns(newCard: number, amount: number): number {
    if (newCard <= 0) return 1;
    let result = 1;
    for (let i = 1; i <= newCard; i++) {
      result = (result * (amount - i + 1)) / i;
    }
    return Math.round(result);
  }

  multiplyOuts(outs: number[]): number {
    let total = 1;
    for (let i = 0; i < outs.length; i++) total *= outs[i]!;
    return total;
  }

  /** Returns plain card objects that are not yet revealed (up to `amount`). */
  getAvailableCard(revealedCards: CardData[], value: number, color: number, amount = -1): CardData[] {
    const available: CardData[] = [];
    if (value !== -1) {
      if (color === -1) {
        for (let c = 0; c < 4; c++) {
          if (!this.isCardRevealed(revealedCards, value, c)) {
            available.push({ value, color: c });
            if (amount !== -1 && available.length >= amount) break;
          }
        }
      } else {
        if (!this.isCardRevealed(revealedCards, value, color)) {
          available.push({ value, color });
        }
      }
    } else {
      // find highest rank of given color not revealed
      for (let v = 14; v >= 2; v--) {
        if (!this.isCardRevealed(revealedCards, v, color)) {
          available.push({ value: v, color });
          if (amount !== -1 && available.length >= amount) break;
        }
      }
    }
    return available;
  }

  /**
   * Returns an array where index = number of identical ranks, value = count of such groups.
   * e.g., [0,0,1,0,0] means one pair.
   */
  getSameKinds(revealedCards: CardData[]): number[] {
    const sameKind = [0, 0, 0, 0, 0];
    const copy = [...revealedCards];
    while (copy.length) {
      const val = copy[0]!.value;
      const count = this.getValueCount(copy, val);
      sameKind[count]!++;
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i]!.value === val) copy.splice(i, 1);
      }
    }
    return sameKind;
  }
}

/** Common interface implemented by every Chance* evaluator. */
export interface ChanceHand {
  check(
    revealedCards: CardData[],
    ownCards: CardData[],
    remainingCards: number,
    cardsInDeck: number
  ): ChanceResult;
}