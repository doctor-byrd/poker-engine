/**
 * Core enums, literal types and shared interfaces for the poker engine.
 */

export const Action = {
  none: 0, fold: 1, call: 2, check: 3, bet: 4, raise: 5, bluff: 6, allIn: 7,
} as const;
export type ActionValue = (typeof Action)[keyof typeof Action];

export const GamePhase = { preflop: 0, flop: 1, turn: 2, river: 3 } as const;
export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];
export type PhaseName = 'preflop' | 'flop' | 'turn' | 'river';

export const PokerHand = {
  HighCard: 0, OnePair: 1, TwoPair: 2, ThreeOfKind: 3, Straight: 4,
  Flush: 5, FullHouse: 6, FourOfKind: 7, StraightFlush: 8, RoyalFlush: 9,
} as const;
export type PokerHandValue = (typeof PokerHand)[keyof typeof PokerHand];

export const CardColor = { spades: 0, heart: 1, diamonds: 2, clubs: 3 } as const;
export type CardColorValue = (typeof CardColor)[keyof typeof CardColor];

export const HandWin = { hand1: 0, hand2: 1, tie: 2 } as const;
export type HandWinValue = (typeof HandWin)[keyof typeof HandWin];

/** Plain serializable representation of a card. */
export interface CardData {
  value: number; // 2..14 (11=J,12=Q,13=K,14=A)
  color: number; // 0=spades,1=heart,2=diamonds,3=clubs
}

/** A decision made by a player. */
export interface Decision {
  action: ActionValue;
  betIncrement: number;
  playerChair: number;
}

/** Per-phase action counters tracked by the GameObserver. */
export interface ActionCounters {
  fold: number; check: number; call: number; raise: number;
  bet: number; bluff: number; allIn: number; total: number;
}

/** Memory blob tracked per player by the GameObserver. */
export interface PlayerMemory {
  preflop: ActionCounters; flop: ActionCounters;
  turn: ActionCounters; river: ActionCounters; total: ActionCounters;
}

/** Snapshot of the observer state (serializable). */
export interface ObserverState {
  gamePhase: GamePhaseValue;
  cardsInTable: CardData[];
  playerChips: number[];
  playerBet: number[];
  playerDropped: number[];
  pot: { betInTable: number };
  turnPlayer: number;
  leaderBetPlayer: number;
  blindIndex: number;
  round: number;
  cardsInDeck: number;
  playersMemory: PlayerMemory[];
  totalMemory: PlayerMemory[];
  totalRaiseInRound: number;
}

/** Result of one "chance" evaluation (e.g. probability of making a pair). */
export interface ChanceResult {
  total: number;
  foundHand: FoundHand | null;
  foundHandCards: CardData[];
  projects: ChanceProject[];
}

export interface FoundHand {
  category: number;
  cards: number[];
}

export interface ChanceProject {
  card: number;
  perc: number;
  project: { card: number; perc: number }[];
}

/** Aggregated percentage result across all hand categories. */
export interface PercentageHands {
  chanceHandData: ChanceResult[];
  handCardAmount: number;
  handFound: number;
}

/** Ranking triplet used by bots to evaluate hand strength. */
export interface Rankings {
  ownRanking: number;
  otherRanking: number;
  otherHighRanking: number;
}

/** Minimal view of the observer required by the hand evaluator. */
export interface ObserverLike {
  getCardsInTable(): CardData[];
  getCardsInDeck(): number;
  getGamePhase(): GamePhaseValue;
}