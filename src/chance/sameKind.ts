import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalculator.js';

/**
 * Shared implementation for "same kind" hands (pair / three-of-a-kind /
 * four-of-a-kind). Ported from the duplicated logic in PokerChancePair.js,
 * PokerChanceThreeOfKind.js and PokerChanceFourOfKind.js.
 */
export function checkSameKind(
  probabilityCalculator: ProbabilityCalculator,
  category: number,
  revealedCards: CardData[],
  remainingCards: number,
  sameAmount: number,
  cardsInDeck: number
): ChanceResult {
  const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
    category,
    cards: [],
  };
  let projects: ChanceResult['projects'] = [];
  let totalPerHand = 0;

  if (revealedCards.length + remainingCards < sameAmount) {
    return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
  }

  const minSameKind = sameAmount - remainingCards;
  const sameKindHand = probabilityCalculator.getSameKinds(revealedCards);
  if (minSameKind > 0 && sameKindHand[minSameKind] === 0) {
    return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
  }

  for (let i = 14; i > 1; i--) {
    const project: ChanceResult['projects'][number] = { card: i, perc: 0, project: [] };
    const totalProjectPer = searchSameKindPerc(probabilityCalculator, sameAmount, revealedCards, i, remainingCards, cardsInDeck);
    project.perc = totalProjectPer;
    projects.push(project);
    totalPerHand += totalProjectPer;

    if (totalProjectPer >= 100) {
      foundHand.cards = [];
      const foundHandCards: CardData[] = [];
      const availableCards = probabilityCalculator.getAvailableCard(revealedCards, i, -1, sameAmount);
      for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
        foundHand.cards.push(availableCards[h].value);
        foundHandCards.push(availableCards[h]);
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

export function searchSameKindPerc(
  probabilityCalculator: ProbabilityCalculator,
  sameAmount: number,
  revealedCards: CardData[],
  cardValue: number,
  remainingCards: number,
  cardsInDeck: number
): number {
  const sameAmountNeeded = sameAmount - probabilityCalculator.getValueCount(revealedCards, cardValue);
  if (sameAmountNeeded <= 0) return 100;
  if (remainingCards < sameAmountNeeded) return 0;
  const outs = probabilityCalculator.getOuts(revealedCards, cardValue);
  if (outs < sameAmountNeeded) return 0;
  return probabilityCalculator.getOutsPercentage([sameAmountNeeded], [outs], [true], remainingCards, cardsInDeck);
}

export class ChancePair {
  probabilityCalculator: ProbabilityCalculator;
  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    return checkSameKind(this.probabilityCalculator, PokerHand.OnePair, revealedCards, remainingCards, 2, cardsInDeck);
  }
}

export class ChanceThreeOfKind {
  probabilityCalculator: ProbabilityCalculator;
  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    return checkSameKind(this.probabilityCalculator, PokerHand.ThreeOfKind, revealedCards, remainingCards, 3, cardsInDeck);
  }
}

export class ChanceFourOfKind {
  probabilityCalculator: ProbabilityCalculator;
  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    return checkSameKind(this.probabilityCalculator, PokerHand.FourOfKind, revealedCards, remainingCards, 4, cardsInDeck);
  }
}