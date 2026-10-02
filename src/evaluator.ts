import { CardData, ChanceResult, GamePhase, HandWin, ObserverLike, PercentageHands, Rankings } from './constants.js';
import { ProbabilityCalculator } from './chance/probabilityCalculator.js';
import { ChanceHighestCard } from './chance/highestCard.js';
import { ChancePair, ChanceThreeOfKind, ChanceFourOfKind } from './chance/sameKind.js';
import { ChanceTwoPair } from './chance/twoPair.js';
import { ChanceStraight } from './chance/straight.js';
import { ChanceFlush } from './chance/flush.js';
import { ChanceFullHouse } from './chance/fullHouse.js';
import { ChanceStraightFlush, ChanceRoyalFlush } from './chance/straightFlush.js';

/** Shape of the (sub-)config required by the evaluator. */
export interface EvaluatorConfig {
  pattern: number[][]; // Pascal triangle: pattern[n][k-1] = C(n,k)
  minHandValues: number[][];
  maxHandValues: number[][];
  subHandValues: number[][];
  secondPartValues: number[][];
}

/**
 * HandEvaluator – finds the best hand, compares hands, and computes
 * probabilistic hand rankings used by the bots.
 * Ported from PokerHandEvaluator.js.
 */
export class HandEvaluator {
  gameObserver: ObserverLike;
  config: EvaluatorConfig;
  probabilityCalculator: ProbabilityCalculator;
  chanceHands: ReturnType<HandEvaluator['createChanceHands']>;
  firstPartPerc!: number[][];
  secondPartPerc!: number[][];

  constructor(gameObserver: ObserverLike, config: EvaluatorConfig) {
    this.gameObserver = gameObserver;
    this.config = config;
    this.probabilityCalculator = new ProbabilityCalculator();
    // Inject pattern table into probability calculator
    this.probabilityCalculator.getPatterns = (newCard: number, amount: number) => {
      return this.config.pattern[amount][newCard - 1];
    };
    this.chanceHands = this.createChanceHands();
    this.initPartPerc();
  }

  initPartPerc(): void {
    const amount = this.config.subHandValues.length;
    this.firstPartPerc = [];
    this.secondPartPerc = [];
    for (let i = 0; i < amount; i++) {
      this.firstPartPerc[i] = [];
      this.secondPartPerc[i] = [];
      const subHandValues = this.config.subHandValues[i];
      const secondPartValues = this.config.secondPartValues[i];
      const maxPercValueFirstPart = subHandValues[subHandValues.length - 1];
      const maxPercValueSecondPart = secondPartValues[secondPartValues.length - 1];
      for (let j = 0; j < subHandValues.length; j++) {
        this.firstPartPerc[i][j] = (110 * subHandValues[j]) / maxPercValueFirstPart;
        this.secondPartPerc[i][j] = (110 * secondPartValues[j]) / maxPercValueSecondPart;
      }
    }
  }

  createChanceHands() {
    const pc = this.probabilityCalculator;
    const hands: ChanceResult[] & Record<number, any> = [] as any;
    hands[0] = new ChanceHighestCard(pc);
    hands[1] = new ChancePair(pc);
    hands[2] = new ChanceTwoPair(pc);
    hands[3] = new ChanceThreeOfKind(pc);
    hands[4] = new ChanceStraight(pc);
    hands[5] = new ChanceFlush(pc);
    hands[6] = new ChanceFullHouse(pc);
    hands[7] = new ChanceFourOfKind(pc);
    hands[8] = new ChanceStraightFlush(pc);
    hands[9] = new ChanceRoyalFlush(pc);
    return hands;
  }

  compareTwoHands(hand1: CardData[], hand2: CardData[]): number {
    const tableCards = this.gameObserver.getCardsInTable();
    const best1 = this.getBestHand([...hand1, ...tableCards], hand1);
    const best2 = this.getBestHand([...hand2, ...tableCards], hand2);
    if ((best1.foundHand?.category ?? -1) > (best2.foundHand?.category ?? -1)) return HandWin.hand1;
    if ((best1.foundHand?.category ?? -1) < (best2.foundHand?.category ?? -1)) return HandWin.hand2;
    for (let i = 0; i < (best1.foundHand?.cards.length ?? 0); i++) {
      if (best1.foundHandCards[i].value > best2.foundHandCards[i].value) return HandWin.hand1;
      if (best1.foundHandCards[i].value < best2.foundHandCards[i].value) return HandWin.hand2;
    }
    return HandWin.tie;
  }

  getBestCategory(hand: CardData[]): number {
    const tableCards = this.gameObserver.getCardsInTable();
    const allCards = [...hand, ...tableCards];
    const bestHand = this.getBestHand(allCards, hand);
    return bestHand.foundHand ? bestHand.foundHand.category : 0;
  }

  getBestHand(revealedCards: CardData[], ownCards: CardData[]) {
    const handResult = this.getHandPercentage(revealedCards, ownCards, 0);
    if (handResult.handFound !== -1) {
      return handResult.chanceHandData[handResult.handFound];
    }
    return { total: 0, foundHand: null, foundHandCards: [] as CardData[], projects: [] };
  }

  getHandPercentage(revealedCards: CardData[], ownCards: CardData[], remainingCards: number): PercentageHands {
    const chanceHandList: ChanceResult[] = [];
    let handFound = -1;
    let handCardAmount = 0;
    const cardsInDeck = this.gameObserver.getCardsInDeck();
    for (let i = this.chanceHands.length - 1; i >= 0; i--) {
      const chanceHand: ChanceResult & { foundHandCards?: CardData[] } = this.chanceHands[i].check(
        revealedCards, ownCards, remainingCards, cardsInDeck
      );
      if (chanceHand.total > 100) chanceHand.total = 100;
      chanceHandList[i] = chanceHand;
      if (chanceHand.foundHand && chanceHand.foundHand.cards.length > 0) {
        handFound = i;
        handCardAmount = chanceHand.foundHandCards.length;
        if (i === 0 /* HighCard */) handCardAmount = 1;
        this.addKickerCards(chanceHand, revealedCards);
        break;
      }
    }
    return { chanceHandData: chanceHandList, handCardAmount, handFound };
  }

  addKickerCards(chanceHand: ChanceResult & { foundHand: NonNullable<ChanceResult['foundHand']> }, revealedCards: CardData[]): void {
    let amount = chanceHand.foundHandCards.length;
    if (amount >= 5) return;
    for (let val = 14; val >= 2; val--) {
      if (this.probabilityCalculator.getValueCount(revealedCards, val) !== 0) {
        for (let color = 0; color < 4; color++) {
          if (this.probabilityCalculator.isCardRevealed(revealedCards, val, color)) {
            let alreadyUsed = false;
            for (let h = 0; h < amount; h++) {
              if (
                chanceHand.foundHandCards[h].value === val &&
                chanceHand.foundHandCards[h].color === color
              ) {
                alreadyUsed = true;
                break;
              }
            }
            if (!alreadyUsed) {
              chanceHand.foundHand.cards.push(val);
              chanceHand.foundHandCards.push({ value: val, color });
              amount++;
              if (amount >= 5) return;
              break;
            }
          }
        }
      }
    }
  }

  getAllPercentages(revealedCards: CardData[], ownCards: CardData[], extraRemainingCards: number): PercentageHands[] {
    const percentages: PercentageHands[] = [];
    const phase = this.gameObserver.getGamePhase();
    switch (phase) {
      case GamePhase.preflop:
        percentages.push(this.getHandPercentage(revealedCards, ownCards, extraRemainingCards));
        percentages.push(this.getHandPercentage(revealedCards, ownCards, extraRemainingCards + 5));
        break;
      case GamePhase.flop:
        percentages.push(this.getHandPercentage(revealedCards, ownCards, 1 + extraRemainingCards));
        percentages.push(this.getHandPercentage(revealedCards, ownCards, extraRemainingCards + 2));
        break;
      case GamePhase.turn:
        percentages.push(this.getHandPercentage(revealedCards, ownCards, extraRemainingCards + 1));
        break;
      case GamePhase.river:
        percentages.push(this.getHandPercentage(revealedCards, ownCards, extraRemainingCards));
        break;
    }
    return percentages;
  }

  getRankings(playerAmount: number, hand: CardData[]): Rankings[] {
    const tableCards = this.gameObserver.getCardsInTable();
    const ownHand = hand;
    const revealedCards = [...ownHand, ...tableCards];
    const ownPercentageHands = this.getAllPercentages(revealedCards, ownHand, 0);
    const otherPercentageHands = this.getAllPercentages(tableCards, [], 2);
    const rankings: Rankings[] = [];
    for (let i = 0; i < ownPercentageHands.length; i++) {
      const ownRanking = this.getHandRanking(playerAmount, ownPercentageHands[i]);
      const otherRanking = this.getHandRanking(playerAmount, otherPercentageHands[i]);
      let otherHighRanking = otherRanking;
      if (ownPercentageHands[i].handFound !== -1) {
        const ownFoundHand = {
          cards: [...ownPercentageHands[i].chanceHandData[ownPercentageHands[i].handFound]!.foundHand!.cards],
          category: ownPercentageHands[i].chanceHandData[ownPercentageHands[i].handFound]!.foundHand!.category,
        };
        ownFoundHand.cards[ownFoundHand.cards.length - 1]++;
        otherHighRanking = this.getHandRanking(playerAmount, otherPercentageHands[i], ownFoundHand);
      }
      rankings.push({ ownRanking, otherRanking, otherHighRanking });
    }
    return rankings;
  }

  getHandRanking(playerAmount: number, percentageHands: PercentageHands, foundHand?: { cards: number[]; category: number }): number {
    let totalRanking = 0;
    let startHandIndex = 0;
    let startCard1 = 2;
    let startCard2 = 2;
    if (foundHand) {
      startHandIndex = foundHand.category;
      startCard1 = foundHand.cards[0];
      startCard2 = foundHand.cards[1];
    }
    for (let handIndex = startHandIndex; handIndex < 10; handIndex++) {
      let handKindTotal = 0;
      const chanceHand = percentageHands.chanceHandData[handIndex];
      if (!chanceHand || chanceHand.total === 0) {
        startCard1 = 2;
        continue;
      }
      for (let p = chanceHand.projects.length - 1; p >= 0; p--) {
        const projectHand = chanceHand.projects[p];
        if (projectHand.card < startCard1) continue;
        if (projectHand.project && projectHand.project.length) {
          for (let q = projectHand.project.length - 1; q >= 0; q--) {
            if (projectHand.project[q].card < startCard2) continue;
            const perc = projectHand.project[q].perc;
            handKindTotal += this.calcPercToRanking(
              playerAmount, handIndex, projectHand.card, projectHand.project[q].card, perc
            );
          }
        } else {
          const perc = projectHand.perc;
          handKindTotal += this.calcPercToRanking(playerAmount, handIndex, projectHand.card, -1, perc);
        }
        startCard2 = 2;
      }
      startCard1 = 2;
      totalRanking += handKindTotal;
    }
    return totalRanking;
  }

  calcPercToRanking(
    playerAmount: number, handIndex: number,
    firstCardValue: number, secondCardValue: number, perc: number
  ): number {
    if (perc === 0) return 0;
    const minHandRanking = this.config.minHandValues[playerAmount][handIndex];
    const maxHandRanking = this.config.maxHandValues[playerAmount][handIndex];
    const range = maxHandRanking - minHandRanking;
    let firstPart = 0;
    let secondPart = 0;
    if (firstCardValue !== -1) {
      firstPart = (this.firstPartPerc[handIndex][firstCardValue - 1] * range) / 100;
      if (secondCardValue !== -1) {
        secondPart = (this.secondPartPerc[handIndex][secondCardValue - 1] * range) / 100;
      }
    }
    const totalRank = minHandRanking + firstPart + secondPart;
    return (perc * totalRank) / 100;
  }
}