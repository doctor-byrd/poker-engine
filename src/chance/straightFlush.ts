import { PokerHand, CardData, ChanceResult } from '../constants.js';
import { ProbabilityCalculator } from './probabilityCalcuator.js';

/**
 * Shared straight-flush search used by ChanceStraightFlush and ChanceRoyalFlush.
 * (Both classes had identical search logic in the original JS.)
 */
export function searchStraightFlushPerc(
  probabilityCalculator: ProbabilityCalculator,
  revealedCards: CardData[], cardValue: number, cardColor: number,
  remainingCards: number, cardsInDeck: number, straightPattern: string[]
): number {
  const cardsNeed: number[] = [];
  let checked = 0;
  let lastLoopStarted = false;

  for (let i = cardValue; i > cardValue - 5 && !lastLoopStarted; i--) {
    let val = i;
    if (val === 1) {
      lastLoopStarted = true;
      val = 14;
    }
    if (!probabilityCalculator.isCardRevealed(revealedCards, val, cardColor)) {
      if (remainingCards < ++checked) return 0;
      cardsNeed.push(val);
    }
  }
  const amount = cardsNeed.length;
  if (amount === 0) return 100;
  if (remainingCards < amount) return 0;

  const pattern = cardsNeed.join();
  for (let i = cardValue + 1; i <= cardValue + 5 && i <= 14; i++) {
    if (straightPattern[i]! === pattern) return 0;
  }
  straightPattern[cardValue] = pattern;

  const outs: number[] = [];
  for (let i = 0; i < amount; i++) {
    const out = probabilityCalculator.getOuts(revealedCards, cardsNeed[i]!, cardColor);
    if (out === 0) return 0;
    outs.push(out);
  }
  return probabilityCalculator.getOutsPercentage([amount], outs, [false], remainingCards, cardsInDeck);
}

/** ChanceStraightFlush – probability of making a straight flush. */
export class ChanceStraightFlush {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.StraightFlush,
      cards: [],
    };
    const projects: ChanceResult['projects'] = [];
    let totalPerHand = 0;
    let minStraightCheck = 4;

    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }

    for (let color = 0; color < 4; color++) {
      if (this.probabilityCalculator.getColorCount(revealedCards, color) + remainingCards >= 5) {
        const straightPattern: string[] = [];
        for (let value = 13; value >= minStraightCheck; value--) {
          const project: ChanceResult['projects'][number] = { card: value, perc: 0, project: [] };
          const perc = searchStraightFlushPerc(
            this.probabilityCalculator, revealedCards, value, color, remainingCards, cardsInDeck, straightPattern
          );
          project.perc = perc;
          projects.push(project);
          totalPerHand += perc;
          if (perc >= 100) {
            if (value > minStraightCheck) {
              minStraightCheck = value;
              foundHand.cards = [];
              const foundHandCards: CardData[] = [];
              for (let v = value; v > 0 && foundHandCards.length < 5; v--) {
                const val = v === 1 ? 14 : v;
                const availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, val, -1, 1);
                if (availableCards.length) {
                  foundHand.cards.push(availableCards[0]!.value);
                  foundHandCards.push(availableCards[0]!);
                }
              }
              foundHand.foundHandCards = foundHandCards;
            }
            break;
          }
        }
      }
    }

    return {
      total: totalPerHand,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects,
    };
  }
}

/** ChanceRoyalFlush – probability of making a royal flush (A-K-Q-J-10 suited). */
export class ChanceRoyalFlush {
  probabilityCalculator: ProbabilityCalculator;

  constructor(probabilityCalculator: ProbabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }

  check(revealedCards: CardData[], _ownCards: CardData[], remainingCards: number, cardsInDeck: number): ChanceResult {
    const foundHand: NonNullable<ChanceResult['foundHand']> & { foundHandCards?: CardData[] } = {
      category: PokerHand.RoyalFlush,
      cards: [],
    };
    const projects: ChanceResult['projects'] = [];
    let totalPerHand = 0;
    const straightPattern: string[][] = [[], [], [], []];

    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }

    for (let color = 0; color < 4; color++) {
      if (this.probabilityCalculator.getColorCount(revealedCards, color) + remainingCards >= 5) {
        const project: ChanceResult['projects'][number] = { card: 14, perc: 0, project: [] };
        const perc = searchStraightFlushPerc(
          this.probabilityCalculator, revealedCards, 14, color, remainingCards, cardsInDeck, straightPattern[color]!
        );
        project.perc = perc;
        projects.push(project);
        totalPerHand += perc;
        if (perc >= 100) {
          foundHand.cards = [];
          const foundHandCards: CardData[] = [];
          for (let v = 14; v > 9; v--) {
            const availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, v, -1, 1);
            if (availableCards.length) {
              foundHand.cards.push(availableCards[0]!.value);
              foundHandCards.push(availableCards[0]!);
            }
          }
          foundHand.foundHandCards = foundHandCards;
          break;
        }
      }
    }

    return {
      total: totalPerHand,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects,
    };
  }
}