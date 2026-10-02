import { CardData, ObserverState, PlayerMemory, ActionCounters } from './constants.js';
import { Pot } from './pot.js';

/**
 * Central game state holder + event bus. The Room mutates it; bots and the
 * hand evaluator read from it. Ported from PokerGameObserver.js (EventEmitter).
 */
export class GameObserver {
  gameId = 0;
  initChip = 0;
  humanChair: number;
  config?: any; // injected by Room (PokerGameConfig)

  gamePhase!: number;
  cardsInTable: CardData[];
  playerChips: number[];
  playerDropped: number[];
  playerBet: number[];
  botAllIn = 0;
  totalRaiseInRound = 0;
  totalPot = 0;
  playerAmount!: number;
  playersMemory!: PlayerMemory[];
  playersRaisedInTurn = 0;
  pot!: Pot;
  totalMemory!: PlayerMemory[];

  headTablePlayer!: number;
  turnPlayer!: number;
  blindIndex!: number;
  leaderBetPlayer!: number;
  playerBigBlind!: number;
  playerSmallBlind!: number;
  round!: number;
  cardsInDeck!: number;

  private listeners: Map<string, Array<(payload?: any) => void>> = new Map();

  constructor(playerAmount: number, humanChair: number) {
    this.humanChair = humanChair;
    this.reset(playerAmount);
  }

  // ---- tiny built-in event emitter (keeps the library dependency-free) ----
  on(event: string, cb: (payload?: any) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(cb);
    return this;
  }

  off(event: string, cb: (payload?: any) => void): this {
    const arr = this.listeners.get(event);
    if (arr) this.listeners.set(event, arr.filter((f) => f !== cb));
    return this;
  }

  emit(event: string, payload?: any): boolean {
    const arr = this.listeners.get(event);
    if (arr) for (const cb of arr) cb(payload);
    return !!arr?.length;
  }

  reset(playerAmount: number): void {
    this.gamePhase = 0; // preflop
    this.cardsInTable = [];
    this.playerChips = [];
    this.playerDropped = [];
    this.playerBet = [];
    this.botAllIn = 0;
    this.totalRaiseInRound = 0;
    this.totalPot = 0;
    this.playerAmount = playerAmount;
    this.playersMemory = [];
    this.playersRaisedInTurn = 0;
    this.pot = new Pot(0, []);
    // Memory for bot decisions (action counts per player per phase)
    for (let i = playerAmount - 1; i >= 0; i--) {
      this.playersMemory[i] = GameObserver.emptyMemory();
    }
    this.totalMemory = this.playersMemory.slice();
    this.emit('reset');
  }

  static emptyMemory(): PlayerMemory {
    const empty = (): ActionCounters => ({
      fold: 0, check: 0, call: 0, raise: 0, bet: 0, bluff: 0, allIn: 0, total: 0,
    });
    return { preflop: empty(), flop: empty(), turn: empty(), river: empty(), total: empty() };
  }

  /** Called by Room to update turn, blinds, etc. */
  changeTurnData(
    newTurn: number, gamePhase: number, blindIndex: number,
    leaderBetPlayer: number, playerBigBlind: number, playerSmallBlind: number,
    round: number, cardInDeck: number, headTablePlayer: number
  ): void {
    this.headTablePlayer = headTablePlayer;
    this.turnPlayer = newTurn;
    this.blindIndex = blindIndex;
    this.leaderBetPlayer = leaderBetPlayer;
    this.playerBigBlind = playerBigBlind;
    this.playerSmallBlind = playerSmallBlind;
    this.gamePhase = gamePhase;
    this.round = round;
    this.cardsInDeck = cardInDeck;
    this.emit('turnChanged', this.getState());
  }

  /** Called when a player's chips, houses, or fold status changes. */
  changePlayerData(playerChair: number, chips: number, playerLose: boolean | null, playerBet: number): void {
    this.playerChips[playerChair] = chips;
    if (playerLose === true && this.playerDropped.indexOf(playerChair) === -1) {
      this.playerDropped.push(playerChair);
    } else if (playerLose === false && this.playerDropped.indexOf(playerChair) !== -1) {
      this.playerDropped.splice(this.playerDropped.indexOf(playerChair), 1);
    }
    this.playerBet[playerChair] = playerBet;
    this.emit('playerChanged', { playerChair, chips, playerLose, playerBet });
  }

  /** Called when a player performs an action (fold, call, raise, etc.). */
  recordAction(playerChair: number, playerAction: number): void {
    const phaseName = this.getPhaseName();
    const ACTION_NAMES = ['none', 'fold', 'call', 'check', 'bet', 'raise', 'bluff', 'allIn'];
    const key = ACTION_NAMES[playerAction] as keyof ActionCounters;
    this.totalMemory[playerChair][phaseName][key]++;
    this.playersMemory[playerChair][phaseName][key]++;
    this.playersMemory[playerChair].total[key]++;
    this.totalMemory[playerChair].total[key]++;
    if (
      playerAction !== 4 /* bet */ && playerAction !== 5 /* raise */ &&
      playerAction !== 6 /* bluff */ && playerAction !== 7 /* allIn */
    ) {
      // Do nothing for non-aggressive actions
    } else if (playerAction !== this.humanChair) {
      this.totalRaiseInRound++;
    }
    this.emit('actionPerformed', { playerChair, playerAction });
  }

  /** Reset memory for a new hand (keep totalMemory but clear round-specific). */
  resetRoundMemory(): void {
    for (let i = this.playerAmount - 1; i >= 0; i--) {
      this.playersMemory[i] = GameObserver.emptyMemory();
    }
    this.totalRaiseInRound = 0;
    this.emit('roundMemoryReset');
  }

  // ---- Getters ----
  getHighestBet(): number { return this.playerBet[this.leaderBetPlayer]; }
  getCardsInTable(): CardData[] { return this.cardsInTable; }
  getCardsInDeck(): number { return this.cardsInDeck; }
  getPlayerChip(chair: number): number { return this.playerChips[chair]; }
  getPlayerBet(chair: number): number { return this.playerBet[chair]; }
  getPot(): Pot { return this.pot; }
  getTotalRaiseInRound(): number { return this.totalRaiseInRound; }
  getBlindIndex(): number { return this.blindIndex; }
  getPlayerBefore(playerId: number): number {
    let total = 0;
    let playerAux = this.playerBigBlind + 1 > this.playerAmount - 1 ? 0 : this.playerBigBlind + 1;
    while (playerAux !== playerId) {
      if (this.playerDropped.indexOf(playerAux) === -1) total++;
      playerAux = playerAux + 1 > this.playerAmount - 1 ? 0 : playerAux + 1;
    }
    return total;
  }
  getGamePhase(): number { return this.gamePhase; }
  getPhaseName(): 'preflop' | 'flop' | 'turn' | 'river' {
    return (['preflop', 'flop', 'turn', 'river'] as const)[this.gamePhase];
  }
  getAverageRaised(excludedPlayer: number): { average: number; totalAction: number; amount: number } {
    let average = 0, totalAction = 0, amount = 0;
    let playerAux = excludedPlayer + 1 > this.playerAmount - 1 ? 0 : excludedPlayer + 1;
    while (playerAux !== excludedPlayer) {
      if (
        this.playerDropped.indexOf(playerAux) === -1 &&
        this.playerBet[playerAux] >= this.playerBet[this.leaderBetPlayer]
      ) {
        const avg = this.getAverageRaisedPlayer(playerAux);
        if (avg.totalAction > 5) {
          average += avg.raisePerc;
          totalAction += avg.totalAction;
          amount++;
        }
      }
      playerAux = playerAux + 1 > this.playerAmount - 1 ? 0 : playerAux + 1;
    }
    if (amount > 0) {
      average /= amount;
      totalAction /= amount;
    }
    return { average, totalAction, amount };
  }
  getAverageRaisedPlayer(playerId: number): { raisePerc: number; totalAction: number } {
    const phaseActions = this.playersMemory[playerId][this.getPhaseName()];
    const total = phaseActions.total;
    const raise = phaseActions.raise;
    const raisePerc = total === 0 ? 0 : Math.round((100 * raise) / total);
    return { raisePerc, totalAction: total };
  }
  getPlayersRaiseInTurn(): number { return this.playersRaisedInTurn; }
  getRaisedInRound(playerChair: number): number {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (this.playerDropped.indexOf(i) === -1 && i !== playerChair) {
        total += this.playersMemory[playerChair].total.raise;
      }
    }
    return total;
  }
  getPlayerRaisedInRound(playerChair: number): number {
    return this.playersMemory[playerChair].total.raise;
  }
  getRaisedInGame(playerChair: number): number {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (this.playerDropped.indexOf(i) === -1 && i !== playerChair) {
        total += this.totalMemory[playerChair].total.raise;
      }
    }
    return total;
  }
  getStillPlaying(): number { return this.playerAmount - this.playerDropped.length; }
  getPlayersAHead(playerChair: number): number {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (i < this.leaderBetPlayer && playerChair < i && this.playerDropped.indexOf(i) === -1) total++;
    }
    return total;
  }
  getPlayerAmount(): number { return this.playerAmount; }
  getRound(): number { return this.round; }
  getPlayersChips(): number[] { return this.playerChips; }
  getPlayersDropped(): number[] { return this.playerDropped; }
  getPlayersBet(): number[] { return this.playerBet; }
  resetRoundData(): void { this.cardsInDeck = 52; this.cardsInTable = []; }
  getPlayerBigBlind(): number { return this.playerBigBlind; }
  getPlayerSmallBlind(): number { return this.playerSmallBlind; }
  getTotalChips(): number {
    let total = 0;
    for (let i = 0; i < this.playerChips.length; i++) {
      if (this.playerDropped.indexOf(i) === -1) total += this.playerChips[i];
    }
    return total;
  }
  getRankingPlayers(humanChair: number): number[] {
    const ranking: number[] = [];
    const valuePlayer: number[] = [];
    for (let i = 0; i < this.playerAmount; i++) {
      valuePlayer[i] = this.playerChips[i];
      ranking[i] = i;
    }
    // swap human chair to front
    let auxRank = ranking[0];
    let auxValue = valuePlayer[0];
    ranking[0] = ranking[humanChair];
    valuePlayer[0] = valuePlayer[humanChair];
    ranking[humanChair] = auxRank;
    valuePlayer[humanChair] = auxValue;
    // sort descending by chips
    for (let i = 0; i < ranking.length; i++) {
      for (let j = i + 1; j < ranking.length; j++) {
        if (valuePlayer[i] < valuePlayer[j]) {
          auxRank = ranking[i];
          auxValue = valuePlayer[i];
          ranking[i] = ranking[j];
          valuePlayer[i] = valuePlayer[j];
          ranking[j] = auxRank;
          valuePlayer[j] = auxValue;
        }
      }
    }
    return ranking;
  }
  getPlayersNoAllIn(playerChair: number): number {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (this.playerChips[i] > 0 && i !== playerChair && this.playerDropped.indexOf(i) === -1) total++;
    }
    return total;
  }
  getPlayerMemory(): PlayerMemory[] { return this.playersMemory.slice(); }
  getTotalMemory(): PlayerMemory[] { return this.totalMemory.slice(); }
  setMemory(playersMemory: PlayerMemory[], totalMemory: PlayerMemory[]): void {
    this.playersMemory = playersMemory.slice();
    this.totalMemory = totalMemory.slice();
  }

  /** Full serializable state snapshot. */
  getState(): ObserverState {
    return {
      gamePhase: this.gamePhase,
      cardsInTable: this.cardsInTable,
      playerChips: [...this.playerChips],
      playerBet: [...this.playerBet],
      playerDropped: [...this.playerDropped],
      pot: this.pot.toJSON(),
      turnPlayer: this.turnPlayer,
      leaderBetPlayer: this.leaderBetPlayer,
      blindIndex: this.blindIndex,
      round: this.round,
      cardsInDeck: this.cardsInDeck,
      playersMemory: this.playersMemory,
      totalMemory: this.totalMemory,
      totalRaiseInRound: this.totalRaiseInRound,
      botAllIn: this.botAllIn,
    };
  }

  /** Restore from a serialized state. */
  restoreState(state: ObserverState): void {
    this.gamePhase = state.gamePhase;
    this.cardsInTable = [...state.cardsInTable];
    this.playerChips = [...state.playerChips];
    this.playerBet = [...state.playerBet];
    this.playerDropped = [...state.playerDropped];
    this.pot = Pot.from(state.pot);
    this.turnPlayer = state.turnPlayer;
    this.leaderBetPlayer = state.leaderBetPlayer;
    this.blindIndex = state.blindIndex;
    this.round = state.round;
    this.cardsInDeck = state.cardsInDeck;
    this.playersMemory = state.playersMemory;
    this.totalMemory = state.totalMemory;
    this.totalRaiseInRound = state.totalRaiseInRound;
    this.botAllIn = state.botAllIn;
    this.emit('restored');
  }
}