import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalculator.js';

/** ChanceFlush – probability of making a flush. */
export class ChanceFlush {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.Flush,
      cards: [],
    };
    const projects: ChanceResult['projects'] = [];
    let totalProjectPer = 0;
    let minFlushCheck = 5;

    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }

    for (let color = 0; color < 4; color++) {
      if (this.probabilityCalculator.getColorCount(revealedCards, color) + remainingCards >= 5) {
        let colorTotal = 0;
        for (let value = 14; value > minFlushCheck; value--) {
          const project: ChanceResult['projects'][number] = { card: value, perc: 0, project: [] };
          let perc = 0;
          if (
            !this.probabilityCalculator.isCardRevealed(revealedCards, value, color) ||
            this.probabilityCalculator.getOuts(revealedCards, value, color) !== 0
          ) {
            perc = this.searchFlushPerc(revealedCards, value, color, remainingCards, cardsInDeck);
            project.perc = perc;
            projects.push(project);
            if (perc >= 100) {
              if (value > minFlushCheck) {
                minFlushCheck = value;
                foundHand.cards = [];
                const foundHandCards: CardData[] = [];
                for (let v = value; v >= 2 && foundHandCards.length < 5; v--) {
                  if (this.probabilityCalculator.isCardRevealed(revealedCards, v, color)) {
                    foundHand.cards.push(v);
                    foundHandCards.push({ value: v, color });
                  }
                }
                foundHand.foundHandCards = foundHandCards;
              }
              break;
            }
            if (this.probabilityCalculator.isCardRevealed(revealedCards, value, color)) break;
          }
          colorTotal += perc;
        }
        totalProjectPer += this.searchFlushPerc(revealedCards, 0, color, remainingCards, cardsInDeck);
      }
    }

    return {
      total: totalProjectPer,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects,
    };
  }

  searchFlushPerc(
    revealedCards: CardData[], cardValue: number, cardColor: number,
    remainingCards: number, cardsInDeck: number
  ): number {
    const outs: number[] = [];
    const needed: number[] = [];
    const same: boolean[] = [];
    let auxRemainingCard = remainingCards;
    const colorCount = this.probabilityCalculator.getColorCount(revealedCards, cardColor);
    let neededFlush = 5 - colorCount;
    if (neededFlush < 0) neededFlush = 0;

    if (remainingCards < neededFlush) return 0;

    let highestStillNeeded = false;
    if (cardValue > 0 && !this.probabilityCalculator.isCardRevealed(revealedCards, cardValue, cardColor)) {
      const out = this.probabilityCalculator.getOuts(revealedCards, cardValue, cardColor);
      if (out === 0) return 0;
      outs.push(out);
      needed.push(1);
      same.push(true);
      highestStillNeeded = true;
      neededFlush--;
      auxRemainingCard--;
    }

    if (auxRemainingCard < neededFlush) return 0;
    if (neededFlush > 0) {
      let totalOuts = 0;
      const maxVal = cardValue > 0 ? cardValue : 14;
      for (let v = maxVal; v > 1; v--) {
        if (cardValue > 0 && v === cardValue) continue;
        totalOuts += this.probabilityCalculator.getOuts(revealedCards, v, cardColor);
      }
      if (totalOuts < neededFlush) return 0;
      outs.push(totalOuts);
      needed.push(neededFlush);
      same.push(true);
    } else if (neededFlush === 0 && !highestStillNeeded) {
      return 100;
    }
    return this.probabilityCalculator.getOutsPercentage(needed, outs, same, remainingCards, cardsInDeck);
  }
}