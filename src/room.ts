import { EventEmitter } from 'events';
import { Action, CardData, Decision, GamePhase, HandWin, TableTypeValue } from './constants.js';
import { Deck } from './deck.js';
import { Player } from './player.js';
import { Bot, EngineConfig } from './bot.js';
import { GameObserver } from './observer.js';
import { HandEvaluator } from './evaluator.js';
import { Pot } from './pot.js';

/** Table configuration (subset of backend tablesData entries). */
export interface TableConfig {
  initChips: number;
  playerAmount: number;
  humanChair: number;
  initDealer: number;
  blindIndex: number;
  tableType: TableTypeValue;
  prize: number[];
  tutorial?: { steps: any[]; fixedCard?: CardData[] };
}

export interface RoomConfig extends EngineConfig {
  tablesData: Record<number, TableConfig>;
}

export type SidePot = { players: number[]; amount: number };

/**
 * Room – the Texas Hold'em hand/round state machine.
 * Ported from PokerRoom.js with all database/NFT/WebSocket side effects
 * removed (they are replaced by events and an optional `saveState` hook).
 */
export class Room extends EventEmitter {
  config: RoomConfig;
  tableId: number;
  gameObserver: GameObserver & { config: RoomConfig };
  deck: Deck;
  handEvaluator: HandEvaluator;
  players: Player[];
  botDecisionCollector?: { onBotDecide(botId: number, tagSession: string, botType: string, decisionData: any): void; endSession?(): void };
  dealerPosition: number;
  turnPlayer: number;
  leaderBetPlayer: number;
  playerBigBlind: number;
  playerSmallBlind: number;
  phase: number;
  blindIndex: number;
  round: number;
  humanChair: number;
  eliminationOrder: number[] = [];
  totalHandsPlayed = 0;
  /** Optional persistence hook replacing the backend DatabaseUtils calls. */
  saveState?: (state: any) => void | Promise<void>;

  constructor(
    config: RoomConfig, tableId: number, initDealer: number,
    _coalWins = 0, botDecisionCollector?: any,
    public isTutorial = false, public fixedDecisions: any[] = []
  ) {
    super();
    this.config = config;
    this.tableId = tableId;
    this.dealerPosition = initDealer;
    this.blindIndex = config.tablesData[tableId].blindIndex;
    this.round = 0;
    this.phase = GamePhase.preflop;
    this.botDecisionCollector = botDecisionCollector;

    const tableCfg = config.tablesData[tableId];
    this.humanChair = tableCfg.humanChair;

    this.gameObserver = new GameObserver(tableCfg.playerAmount, tableCfg.humanChair) as any;
    this.gameObserver.config = config;
    this.handEvaluator = new HandEvaluator(this.gameObserver, config as any);

    this.players = [];
    for (let i = 0; i < tableCfg.playerAmount; i++) {
      if (i === tableCfg.humanChair && config.humanEnable !== false && !isTutorial) {
        const p = new Player(i, tableCfg.initChips);
        p.isHuman = true;
        this.players.push(p);
      } else {
        const botType = (i % 4) as any;
        const bot = new Bot(i, tableCfg.initChips, this.gameObserver as any, this.handEvaluator, config.levelBot, botType);
        this.players.push(bot);
      }
    }

    this.deck = new Deck();
    this.turnPlayer = initDealer;
    this.leaderBetPlayer = initDealer;
    this.playerBigBlind = initDealer;
    this.playerSmallBlind = initDealer;

    this.startHand();
  }

  getSmallBlind(): number { return this.config.smallBlind[this.blindIndex]; }
  getBigBlind(): number { return this.config.bigBlind[this.blindIndex]; }

  nextPlayer(player: number): number {
    let next = (player + 1) % this.players.length;
    let guard = 0;
    while (this.players[next].lose && guard++ < this.players.length) {
      next = (next + 1) % this.players.length;
    }
    return next;
  }

  startHand(): void {
    this.round++;
    this.totalHandsPlayed++;
    this.phase = GamePhase.preflop;
    this.deck.shuffle();
    this.gameObserver.resetRoundMemory();
    this.gameObserver.resetRoundData();

    for (const p of this.players) {
      p.resetBet();
      p.resetCards();
      if (p.getChips() === 0 && !p.lose) {
        p.lose = true;
        this.eliminationOrder.push(p.chair);
      }
    }

    this.playerSmallBlind = this.nextPlayer(this.dealerPosition);
    this.playerBigBlind = this.nextPlayer(this.playerSmallBlind);
    const sb = this.players[this.playerSmallBlind].forcedBet(this.getSmallBlind());
    const bb = this.players[this.playerBigBlind].forcedBet(this.getBigBlind());
    this.gameObserver.pot.add(sb + bb);
    this.leaderBetPlayer = this.playerBigBlind;

    for (const p of this.players) {
      if (!p.lose) p.setHand(this.deck.draw(2));
    }

    this.turnPlayer = this.nextPlayer(this.playerBigBlind);
    this.syncObserver();
    this.emit('handStarted', { round: this.round });
    this.startTurn();
  }

  syncObserver(): void {
    for (const p of this.players) {
      this.gameObserver.changePlayerData(p.chair, p.getChips(), p.lose, p.getBet());
    }
    this.gameObserver.cardsInTable = this.tableCards;
    this.gameObserver.changeTurnData(
      this.turnPlayer, this.phase, this.blindIndex, this.leaderBetPlayer,
      this.playerBigBlind, this.playerSmallBlind, this.round,
      this.deck.remaining(), this.dealerPosition
    );
  }

  tableCards: CardData[] = [];

  startTurn(): void {
    const current = this.players[this.turnPlayer];
    if (!current || current.lose) {
      this.advanceTurn();
      return;
    }
    this.syncObserver();
    this.emit('turnStarted', this.turnPlayer);

    if (current instanceof Bot) {
      const decision = current.decideAction();
      this.botDecisionCollector?.onBotDecide(current.chair, this.config.tagSession ?? '', String(current.botType), decision);
      this.processPlayerDecision(decision);
    }
    // Human players wait for external submitDecision()
  }

  /** Public API for humans (or tests) to submit a decision. */
  submitDecision(decision: Decision): void {
    if (decision.playerChair !== this.turnPlayer) {
      throw new Error(`Not player ${decision.playerChair}'s turn (turn: ${this.turnPlayer})`);
    }
    this.processPlayerDecision(decision);
  }

  processPlayerDecision(decision: Decision): void {
    const player = this.players[decision.playerChair];
    if (!player) return;

    const highestBet = this.gameObserver.getHighestBet();
    const chipNeedToCall = Math.max(0, highestBet - player.getBet());
    let betIncrement = decision.betIncrement;

    switch (decision.action) {
      case Action.fold:
        player.fold();
        break;
      case Action.check:
        if (chipNeedToCall > 0) throw new Error('Cannot check out of turn / facing a bet');
        break;
      case Action.call:
        betIncrement = Math.min(chipNeedToCall, player.getChips());
        player.forcedBet(betIncrement);
        this.gameObserver.pot.add(betIncrement);
        break;
      case Action.raise:
      case Action.bet:
      case Action.bluff: {
        const totalBet = player.getBet() + betIncrement;
        if (totalBet > highestBet) this.leaderBetPlayer = player.chair;
        player.forcedBet(betIncrement);
        this.gameObserver.pot.add(betIncrement);
        break;
      }
      case Action.allIn: {
        const allIn = player.getChips();
        player.forcedBet(allIn);
        this.gameObserver.pot.add(allIn);
        if (player.getBet() > highestBet) this.leaderBetPlayer = player.chair;
        break;
      }
    }

    this.gameObserver.recordAction(player.chair, decision.action);
    this.emit('playerAction', { ...decision, pot: this.gameObserver.pot.toJSON() });

    if (this.isBettingRoundComplete()) {
      this.nextPhase();
    } else {
      this.advanceTurn();
    }
  }

  advanceTurn(): void {
    this.turnPlayer = this.nextPlayer(this.turnPlayer);
    this.startTurn();
  }

  isBettingRoundComplete(): boolean {
    const active = this.players.filter((p) => !p.lose);
    if (active.length <= 1) return true;
    const highest = this.gameObserver.getHighestBet();
    return active.every((p) => p.getBet() >= Math.min(highest, p.getBet() + p.getChips()) && p.getBet() === highest) ||
      active.every((p) => p.getChips() === 0 || p.getBet() === highest);
  }

  nextPhase(): void {
    for (const p of this.players) p.resetBet();
    this.leaderBetPlayer = this.playerSmallBlind;

    if (this.phase === GamePhase.river) {
      this.checkWin();
      return;
    }

    this.phase++;
    const cardsToDeal = this.phase === GamePhase.flop ? 3 : 1;
    const newCards = this.deck.draw(cardsToDeal);
    this.tableCards = [...this.tableCards, ...newCards];
    this.emit('phaseAdvanced', this.phase, newCards);

    const actives = this.players.filter((p) => !p.lose);
    if (actives.every((p) => p.getChips() === 0)) {
      this.syncObserver();
      this.nextPhase();
      return;
    }

    this.turnPlayer = this.nextPlayer(this.dealerPosition);
    this.syncObserver();
    this.startTurn();
  }

  getWinners(players: Player[]): Player[] {
    if (players.length === 1) return players;
    let best: Player[] = [];
    let bestResult: any = null;
    for (const p of players) {
      const result = this.handEvaluator.getBestHand([...p.getHand(), ...this.tableCards], p.getHand());
      if (!bestResult || this.compareResults(result, bestResult) > 0) {
        bestResult = result;
        best = [p];
      } else if (this.compareResults(result, bestResult) === 0) {
        best.push(p);
      }
    }
    return best;
  }

  compareResults(a: any, b: any): number {
    const catA = a.foundHand ? a.foundHand.category : -1;
    const catB = b.foundHand ? b.foundHand.category : -1;
    if (catA !== catB) return catA - catB;
    const cardsA = a.foundHand ? a.foundHand.cards : [];
    const cardsB = b.foundHand ? b.foundHand.cards : [];
    for (let i = 0; i < Math.min(cardsA.length, cardsB.length); i++) {
      if (cardsA[i] !== cardsB[i]) return cardsA[i] - cardsB[i];
    }
    return 0;
  }

  buildSidePots(): SidePot[] {
    const contenders = this.players.filter((p) => p.getBet() > 0 || !p.lose);
    const levels = Array.from(new Set(contenders.map((p) => p.getBet()))).sort((a, b) => a - b);
    const pots: SidePot[] = [];
    let prevLevel = 0;
    for (const level of levels) {
      let amount = 0;
      const eligible: number[] = [];
      for (const p of this.players) {
        const contribution = Math.min(Math.max(0, p.getBet() - prevLevel), level - prevLevel);
        amount += contribution;
      }
      for (const p of this.players) {
        if (!p.lose && p.getBet() >= level) eligible.push(p.chair);
      }
      if (amount > 0) pots.push({ players: eligible, amount });
      prevLevel = level;
    }
    return pots;
  }

  distributePots(): void {
    const actives = this.players.filter((p) => !p.lose);
    if (actives.length === 1) {
      const winner = actives[0];
      const pot = this.gameObserver.pot.takeAll();
      winner.addChips(pot.betInTable);
      winner.win();
      this.emit('handEnded', { winners: [winner], pot });
      return;
    }
    const winners = this.getWinners(actives);
    const sidePots = this.buildSidePots();
    for (const side of sidePots) {
      const eligibleWinners = winners.filter((w) => side.players.includes(w.chair));
      if (eligibleWinners.length === 0) {
        const sidePlayers = side.players.map((chair) => this.players[chair]);
        const sideWinners = this.getWinners(sidePlayers);
        for (const w of sideWinners) w.addChips(Math.floor(side.amount / sideWinners.length));
      } else {
        const share = Math.floor(side.amount / eligibleWinners.length);
        for (const w of eligibleWinners) w.addChips(share);
        eligibleWinners[0].addChips(side.amount % eligibleWinners.length);
      }
    }
    const pot = this.gameObserver.pot.takeAll();
    for (const w of winners) w.win();
    for (const p of actives) if (!winners.includes(p)) p.toLose();
    this.emit('handEnded', { winners, pot });
  }

  checkWin(): void {
    const actives = this.players.filter((p) => !p.lose && p.getChips() > 0);
    this.distributePots();

    for (const p of this.players) {
      if (p.getChips() === 0 && !this.eliminationOrder.includes(p.chair) && !p.lose) {
        this.eliminationOrder.push(p.chair);
        p.lose = true;
      }
    }

    if (this.config.tablesData[this.tableId].tableType === TableType.tournament && actives.length <= 1) {
      this.endTournament();
      return;
    }

    this.dealerPosition = this.nextPlayer(this.dealerPosition);
    if (this.round % 10 === 0 && this.blindIndex < this.config.bigBlind.length - 1) {
      this.blindIndex++;
      this.emit('blindsIncreased', this.blindIndex);
    }
    this.nextRound();
  }

  nextRound(): void {
    for (const p of this.players) {
      if (p.getChips() > 0) p.resetLose();
    }
    this.tableCards = [];
    this.startHand();
  }

  endTournament(): void {
    const ranking = this.eliminationOrder.slice().reverse();
    const prizes = this.config.tablesData[this.tableId].prize;
    const results = ranking.map((chair, idx) => ({ chair, prize: prizes[idx] ?? 0 }));
    this.emit('tournamentEnded', results);
  }

  addHumanPlayer(userId: string): number {
    for (const p of this.players) {
      if (p.isHuman && !p.userId) {
        p.userId = userId;
        return p.chair;
      }
    }
    return -1;
  }

  removePlayer(userId: string): void {
    for (const p of this.players) {
      if (p.isHuman && p.userId === userId) {
        p.userId = undefined;
        p.fold();
      }
    }
  }

  getState() {
    return {
      tableId: this.tableId,
      round: this.round,
      phase: this.phase,
      blindIndex: this.blindIndex,
      dealerPosition: this.dealerPosition,
      turnPlayer: this.turnPlayer,
      tableCards: this.tableCards,
      pot: this.gameObserver.pot.toJSON(),
      players: this.players.map((p) => ({
        chair: p.chair, chips: p.getChips(), bet: p.getBet(), lose: p.lose,
        isHuman: p.isHuman, isBot: p instanceof Bot, hand: p.getHand(),
      })),
      observer: this.gameObserver.getState(),
    };
  }

  restoreState(state: any): void {
    this.round = state.round;
    this.phase = state.phase;
    this.blindIndex = state.blindIndex;
    this.dealerPosition = state.dealerPosition;
    this.turnPlayer = state.turnPlayer;
    this.tableCards = state.tableCards;
    this.gameObserver.restoreState(state.observer);
    this.emit('stateRestored');
  }
}

export { HandWin };