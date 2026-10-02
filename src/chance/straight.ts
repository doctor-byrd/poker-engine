import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalculator.js';

/** ChanceStraight – probability of making a straight. */
export class ChanceStraight {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.Straight,
      cards: [],
    };
    const projects: ChanceResult['projects'] = [];
    let totalPerHand = 0;
    const straightPattern: string[] = [];

    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }

    for (let i = 14; i > 4; i--) {
      const project: ChanceResult['projects'][number] = { card: i, perc: 0, project: [] };
      const totalProjectPer = this.searchStraightPerc(
        revealedCards, i, remainingCards, cardsInDeck, straightPattern
      );
      project.perc = totalProjectPer;
      projects.push(project);
      totalPerHand += totalProjectPer;
      if (totalProjectPer >= 100) {
        foundHand.cards = [];
        const foundHandCards: CardData[] = [];
        for (let h = i; h > 0 && foundHandCards.length < 5; h--) {
          const val = h === 1 ? 14 : h;
          const availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, val, -1, 1);
          if (availableCards.length) {
            foundHand.cards.push(availableCards[0]!.value);
            foundHandCards.push(availableCards[0]);
          }
        }
        foundHand.foundHandCards = foundHandCards;
        break;
      }
    }

    return {
      total: totalPerHand,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects,
    };
  }

  searchStraightPerc(
    revealedCards: CardData[], cardValue: number, remainingCards: number,
    cardsInDeck: number, straightPattern: string[]
  ): number {
    const cardsNeed: number[] = [];
    let auxNeed = 0;
    const cardInitStraight = cardValue - 5;
    for (let i = cardValue; i > cardInitStraight; i--) {
      const val = i === 1 ? 14 : i;
      if (this.probabilityCalculator.getValueCount(revealedCards, val) === 0) {
        if (remainingCards < ++auxNeed) return 0;
        cardsNeed.push(i);
      }
    }
    const amount = cardsNeed.length;
    if (amount === 0) return 100;
    if (remainingCards < amount) return 0;

    const pattern = cardsNeed.join();
    const cardInitCheck = cardValue + 5;
    for (let i = cardValue + 1; i < cardInitCheck && i <= 14; i++) {
      if (straightPattern[i]! === pattern) return 0;
    }
    straightPattern[cardValue] = pattern;

    const outs: number[] = [];
    for (let i = 0; i < amount; i++) {
      const out = this.probabilityCalculator.getOuts(revealedCards, cardsNeed[i]);
      if (out === 0) return 0;
      outs.push(out);
    }
    return this.probabilityCalculator.getOutsPercentage([amount], outs, [false], remainingCards, cardsInDeck);
  }
}