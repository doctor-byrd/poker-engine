import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalcuator.js';

/**
 * ChanceHighestCard – probability of making the best high-card hand.
 */
export class ChanceHighestCard {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], ownCards: CardData[], _remainingCards: number, cardsInDeck: number): ChanceResult {
    let found = false;
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.HighCard,
      cards: [],
    };
    let projects: ChanceResult['projects'] = [];
    let totalPerHand = 0;

    const remainingCardAux = ownCards.length > 0 ? 0 : 2;

    for (let i = 14; i > 2; i--) {
      let totalProjectPer = 0;
      const project: ChanceResult['projects'][number] = { card: i, perc: 0, project: [] };
      for (let j = i - 1; j > 1; j--) {
        const perc =
          i === j ? 0 : this.searchHighCardPerc(revealedCards, i, j, remainingCardAux, cardsInDeck);
        const subProject = { card: j, perc };
        project.project.push(subProject);
        totalProjectPer += perc;
        if (perc >= 100) {
          foundHand.cards = [i, j];
          const foundHandCards: CardData[] = [];
          let availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, i, -1, 1);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            foundHandCards.push(availableCards[h]!);
          }
          availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, j, -1, 1);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            foundHandCards.push(availableCards[h]!);
          }
          foundHand.foundHandCards = foundHandCards;
          found = true;
          break;
        }
      }
      project.perc = totalProjectPer;
      projects.push(project);
      totalPerHand += totalProjectPer;
      if (found) break;
    }

    return {
      total: totalPerHand,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects,
    };
  }

  searchHighCardPerc(
    revealedCards: CardData[], cardValue: number, cardValue2: number,
    remainingCards: number, cardsInDeck: number
  ): number {
    const outs: number[] = [];
    const needed: number[] = [];
    const same: boolean[] = [];
    let out = 0;

    if (this.probabilityCalculator.getValueCount(revealedCards, cardValue) === 0) {
      out = this.probabilityCalculator.getOuts(revealedCards, cardValue);
      if (out < 1) return 0;
      outs.push(out);
      needed.push(1);
      same.push(true);
    }
    if (this.probabilityCalculator.getValueCount(revealedCards, cardValue2) === 0) {
      out = this.probabilityCalculator.getOuts(revealedCards, cardValue2);
      if (out < 1) return 0;
      outs.push(out);
      needed.push(1);
      same.push(true);
    }
    if (outs.length === 0) return 100;
    return this.probabilityCalculator.getOutsPercentage(needed, outs, same, remainingCards, cardsInDeck);
  }
}