import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalculator.js';

/** ChanceTwoPair – probability of making two pair. */
export class ChanceTwoPair {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    let found = false;
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.TwoPair,
      cards: [],
    };
    const projects: ChanceResult['projects'] = [];
    let totalPerHand = 0;

    if (revealedCards.length + remainingCards < 4) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }

    const sameKindHand = this.probabilityCalculator.getSameKinds(revealedCards);
    const minSameKind = 2 - remainingCards;
    if (minSameKind > 0 && sameKindHand[minSameKind]! === 0)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    if (remainingCards === 0 && sameKindHand[2] < 2)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    if (remainingCards === 1 && sameKindHand[2]! === 0)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };

    for (let i = 14; i > 2; i--) {
      const project: ChanceResult['projects'][number] = { card: i, perc: 0, project: [] };
      let totalProjectPer = 0;
      for (let j = i - 1; j > 1; j--) {
        const perc =
          i === j ? 0 : this.searchTwoPairPerc(revealedCards, i, j, remainingCards, cardsInDeck);
        const subProject = { card: j, perc };
        project.project.push(subProject);
        totalProjectPer += perc;
        if (perc >= 100) {
          foundHand.cards = [i, j];
          const foundHandCards: CardData[] = [];
          let availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, i, -1, 2);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            if (h < 1) foundHand.cards.push(availableCards[h]!.value);
            foundHandCards.push(availableCards[h]);
          }
          availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, j, -1, 2);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            if (h < 1) foundHand.cards.push(availableCards[h]!.value);
            foundHandCards.push(availableCards[h]);
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

  searchTwoPairPerc(
    revealedCards: CardData[], cardValue: number, cardValue2: number,
    remainingCards: number, cardsInDeck: number
  ): number {
    const outs: number[] = [];
    const needed: number[] = [];
    const same: boolean[] = [];
    let auxRemainingCards = remainingCards;

    const need1 = 2 - this.probabilityCalculator.getValueCount(revealedCards, cardValue);
    if (need1 > 0) {
      if (need1 > auxRemainingCards) return 0;
      auxRemainingCards -= need1;
      const out = this.probabilityCalculator.getOuts(revealedCards, cardValue);
      if (out < need1) return 0;
      outs.push(out);
      needed.push(need1);
      same.push(true);
    }
    const need2 = 2 - this.probabilityCalculator.getValueCount(revealedCards, cardValue2);
    if (need2 > auxRemainingCards) return 0;
    if (need2 > 0) {
      const out = this.probabilityCalculator.getOuts(revealedCards, cardValue2);
      if (out < need2) return 0;
      outs.push(out);
      needed.push(need2);
      same.push(true);
    }
    if (outs.length === 0) return 100;
    return this.probabilityCalculator.getOutsPercentage(needed, outs, same, remainingCards, cardsInDeck);
  }
}