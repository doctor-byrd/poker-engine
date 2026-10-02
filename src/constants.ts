/**
 * Core enums, literal types and shared interfaces for the poker engine.
 * Ported from backend/src/game/poker/PokerConstants.js
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

export const BotType = {
  looseAggressive: 0, loosePatient: 1, thightAggressive: 2, thightPatient: 3,
} as const;
export type BotTypeValue = (typeof BotType)[keyof typeof BotType];

export const BluffType = {
  prove: 0, steal: 1, badFuture: 2, goodFuture: 3, fake: 4, call: 5, none: 6,
} as const;
export type BluffTypeValue = (typeof BluffType)[keyof typeof BluffType];

export const CardColor = { spades: 0, heart: 1, diamonds: 2, clubs: 3 } as const;
export type CardColorValue = (typeof CardColor)[keyof typeof CardColor];

export const TableType = {
  tournament: 0, houses: 1, coalMine: 2, tutorial: 3, tutorialSelect: 8,
} as const;
export type TableTypeValue = (typeof TableType)[keyof typeof TableType];

export const Direction = { Left: 0, Down: 1, Right: 2, Up: 3 } as const;

export const HandWin = { hand1: 0, hand2: 1, tie: 2 } as const;
export type HandWinValue = (typeof HandWin)[keyof typeof HandWin];

/** Plain serializable representation of a card. */
export interface CardData {
  value: number; // 2..14 (11=J,12=Q,13=K,14=A)
  color: number; // 0=spades,1=heart,2=diamonds,3=clubs
}

/** A decision made by a player (human or bot). */
export interface Decision {
  action: ActionValue;
  betIncrement: number;
  playerChair: number;
  houseIdBet?: string[];
}

/** Per-phase action counters used for bot memory / statistics. */
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
  pot: { betInTable: number; houseId: string[] };
  turnPlayer: number;
  leaderBetPlayer: number;
  blindIndex: number;
  round: number;
  cardsInDeck: number;
  playersMemory: PlayerMemory[];
  totalMemory: PlayerMemory[];
  totalRaiseInRound: number;
  botAllIn: number;
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

/** Minimal view of the observer required by the evaluator / bots. */
export interface ObserverLike {
  getCardsInTable(): CardData[];
  getCardsInDeck(): number;
  getGamePhase(): GamePhaseValue;
  [key: string]: any;
}

/** Minimal player contract used by Room/Bot code. */
export interface PlayerLike {
  chair: number;
  chips: number;
  bet: number;
  lose: boolean;
  hand: CardData[];
  getChips(): number;
  getHand(): CardData[];
}