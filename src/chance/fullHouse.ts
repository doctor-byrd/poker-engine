import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalculator.js';

/** ChanceFullHouse – probability of making a full house. */
export class ChanceFullHouse {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.FullHouse,
      cards: [],
    };
    const projects: ChanceResult['projects'] = [];
    let totalPerHand = 0;

    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }

    const sameKinds = this.probabilityCalculator.getSameKinds(revealedCards);
    const pairAmount = sameKinds[2];
    let amountNeeded = 0;
    if (sameKinds[3] > 0) {
      if (pairAmount < 2) amountNeeded++;
    } else {
      amountNeeded++;
      if (pairAmount < 2) amountNeeded += 2 - pairAmount;
    }
    if (remainingCards - amountNeeded < 0)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };

    for (let i = 14; i > 1; i--) {
      const project: ChanceResult['projects'][number] = { card: i, perc: 0, project: [] };
      let totalProjectPer = 0;
      let auxRemaining = remainingCards;
      const needThree = 3 - this.probabilityCalculator.getValueCount(revealedCards, i);
      if (needThree > 0) {
        if (auxRemaining < needThree) continue;
        auxRemaining -= needThree;
      }
      let broke = false;
      for (let j = 14; j > 1; j--) {
        if (i === j) continue;
        const subProject = { card: j, perc: 0 };
        const needPair = 2 - this.probabilityCalculator.getValueCount(revealedCards, j);
        if (auxRemaining < needPair) continue;
        const perc = this.searchFullHousePerc(revealedCards, i, j, remainingCards, cardsInDeck);
        subProject.perc = perc;
        project.project.push(subProject);
        totalProjectPer += perc;
        if (perc >= 100) {
          foundHand.cards = [i, j];
          const foundHandCards: CardData[] = [];
          let availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, i, -1, 3);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            foundHandCards.push(availableCards[h]);
            if (h < 2) foundHand.cards.push(availableCards[h].value);
          }
          availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, j, -1, 2);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            foundHandCards.push(availableCards[h]);
            if (h < 1) foundHand.cards.push(availableCards[h].value);
          }
          foundHand.foundHandCards = foundHandCards;
          broke = true;
          break;
        }
      }
      project.perc = totalProjectPer;
      projects.push(project);
      totalPerHand += totalProjectPer;
      if (broke) break;
    }

    return {
      total: totalPerHand,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects,
    };
  }

  searchFullHousePerc(
    revealedCards: CardData[], threeKindValue: number, pairValue: number,
    remainingCards: number, cardsInDeck: number
  ): number {
    const outs: number[] = [];
    const needed: number[] = [];
    const same: boolean[] = [];
    let auxRemainingCards = remainingCards;

    const needThree = 3 - this.probabilityCalculator.getValueCount(revealedCards, threeKindValue);
    if (needThree > 0) {
      if (auxRemainingCards < needThree) return 0;
      auxRemainingCards -= needThree;
      const out = this.probabilityCalculator.getOuts(revealedCards, threeKindValue);
      if (out < needThree) return 0;
      outs.push(out);
      needed.push(needThree);
      same.push(true);
    }
    const needPair = 2 - this.probabilityCalculator.getValueCount(revealedCards, pairValue);
    if (needPair > 0) {
      if (auxRemainingCards < needPair) return 0;
      const out = this.probabilityCalculator.getOuts(revealedCards, pairValue);
      if (out < needPair) return 0;
      outs.push(out);
      needed.push(needPair);
      same.push(true);
    }
    if (outs.length === 0) return 100;
    return this.probabilityCalculator.getOutsPercentage(needed, outs, same, remainingCards, cardsInDeck);
  }
}