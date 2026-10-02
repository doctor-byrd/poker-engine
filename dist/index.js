"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Action: () => Action,
  Card: () => Card,
  CardColor: () => CardColor,
  ChanceFlush: () => ChanceFlush,
  ChanceFourOfKind: () => ChanceFourOfKind,
  ChanceFullHouse: () => ChanceFullHouse,
  ChanceHighestCard: () => ChanceHighestCard,
  ChancePair: () => ChancePair,
  ChanceRoyalFlush: () => ChanceRoyalFlush,
  ChanceStraight: () => ChanceStraight,
  ChanceStraightFlush: () => ChanceStraightFlush,
  ChanceThreeOfKind: () => ChanceThreeOfKind,
  ChanceTwoPair: () => ChanceTwoPair,
  Deck: () => Deck,
  GameObserver: () => GameObserver,
  GamePhase: () => GamePhase,
  HandEvaluator: () => HandEvaluator,
  HandWin: () => HandWin,
  Player: () => Player,
  PokerHand: () => PokerHand,
  Pot: () => Pot,
  ProbabilityCalculator: () => ProbabilityCalculator
});
module.exports = __toCommonJS(index_exports);

// src/constants.ts
var Action = {
  none: 0,
  fold: 1,
  call: 2,
  check: 3,
  bet: 4,
  raise: 5,
  bluff: 6,
  allIn: 7
};
var GamePhase = { preflop: 0, flop: 1, turn: 2, river: 3 };
var PokerHand = {
  HighCard: 0,
  OnePair: 1,
  TwoPair: 2,
  ThreeOfKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfKind: 7,
  StraightFlush: 8,
  RoyalFlush: 9
};
var CardColor = { spades: 0, heart: 1, diamonds: 2, clubs: 3 };
var HandWin = { hand1: 0, hand2: 1, tie: 2 };

// src/card.ts
var SUIT_SYMBOLS = ["\u2660", "\u2665", "\u2666", "\u2663"];
var VALUE_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
var Card = class _Card {
  value;
  color;
  constructor(value, color) {
    this.value = value;
    this.color = color;
  }
  toString() {
    const val = this.value >= 11 ? VALUE_LABELS[this.value] : String(this.value);
    return `${val}${SUIT_SYMBOLS[this.color]}`;
  }
  /** Serializable plain object. */
  toJSON() {
    return { value: this.value, color: this.color };
  }
  static from(data) {
    return new _Card(data.value, data.color);
  }
};

// src/deck.ts
var Deck = class {
  cards = [];
  position = 0;
  // index of next card to draw
  constructor() {
    this.reset();
  }
  /** Build a fresh sorted deck (2-A, spades/hearts/diamonds/clubs). */
  reset() {
    this.cards = [];
    for (let value = 2; value <= 14; value++) {
      for (let color = 0; color < 4; color++) {
        this.cards.push(new Card(value, color));
      }
    }
    this.position = 0;
  }
  /** Fisher-Yates shuffle. */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = this.cards[i];
      const b = this.cards[j];
      this.cards[i] = b;
      this.cards[j] = a;
    }
    this.position = 0;
  }
  /** Draw `count` cards from the top. */
  draw(count = 1) {
    if (this.position + count > this.cards.length) {
      throw new Error("Not enough cards in deck");
    }
    const drawn = this.cards.slice(this.position, this.position + count);
    this.position += count;
    return drawn;
  }
  /** Number of cards remaining. */
  remaining() {
    return this.cards.length - this.position;
  }
  /** For debugging / fixed deck (e.g., tutorial). */
  setFixedDeck(cards) {
    this.cards = cards.map((c) => c instanceof Card ? c : Card.from(c));
    this.position = 0;
  }
};

// src/pot.ts
var Pot = class _Pot {
  betInTable;
  // total chips in pot
  constructor(betInTable = 0) {
    this.betInTable = betInTable;
  }
  /** Add chips to the pot. */
  add(bet = 0) {
    if (bet > 0) this.betInTable += bet;
  }
  /** Clear the pot and return a copy (used when awarding pot to winners). */
  takeAll() {
    const potCopy = new _Pot(this.betInTable);
    this.betInTable = 0;
    return potCopy;
  }
  toJSON() {
    return { betInTable: this.betInTable };
  }
  static from(data) {
    return new _Pot(data.betInTable);
  }
};

// src/player.ts
var Player = class {
  chair;
  chips;
  isFirstDecision = true;
  bet = 0;
  lose;
  showHand = false;
  hand = [];
  wins = 0;
  successiveWins = 0;
  successiveLose = 0;
  onFire = 0;
  lucky = false;
  roundPosition = -1;
  decisionCounter = 1;
  constructor(chair, chips) {
    this.chair = chair;
    this.chips = chips;
    this.lose = chips === 0;
  }
  /** Force a bet (blinds, calls); capped by remaining chips. Returns actual amount bet. */
  forcedBet(bet) {
    const actualBet = Math.min(bet, this.chips);
    this.bet += actualBet;
    this.chips -= actualBet;
    return actualBet;
  }
  setHand(newHand) {
    this.hand = [...newHand];
  }
  getMinRaiseAmount(chipNeedToCall, bigBlind) {
    return chipNeedToCall === 0 ? bigBlind : 2 * chipNeedToCall;
  }
  getChips() {
    return this.chips;
  }
  getHand() {
    return this.hand;
  }
  addChips(chips) {
    this.chips += chips;
  }
  win() {
    this.wins++;
    this.successiveWins++;
    this.successiveLose = 0;
  }
  toLose() {
    this.successiveLose++;
    this.onFire = 0;
    this.lucky = false;
    this.successiveWins = 0;
  }
  getBet() {
    return this.bet;
  }
  fold() {
    this.lose = true;
  }
  resetCards() {
    this.hand = [];
  }
  resetLose() {
    this.hand = [];
    this.lose = false;
    this.isFirstDecision = true;
    this.showHand = false;
    this.decisionCounter = 1;
  }
  resetBet() {
    this.bet = 0;
  }
};

// src/observer.ts
var GameObserver = class _GameObserver {
  gameId = 0;
  initChip = 0;
  gamePhase = GamePhase.preflop;
  cardsInTable = [];
  playerChips = [];
  playerDropped = [];
  playerBet = [];
  totalRaiseInRound = 0;
  totalPot = 0;
  playerAmount;
  playersMemory;
  playersRaisedInTurn = 0;
  pot;
  totalMemory;
  headTablePlayer;
  turnPlayer;
  blindIndex;
  leaderBetPlayer;
  playerBigBlind;
  playerSmallBlind;
  round;
  cardsInDeck;
  listeners = /* @__PURE__ */ new Map();
  constructor(playerAmount) {
    this.reset(playerAmount);
  }
  // ---- tiny built-in event emitter (keeps the library dependency-free) ----
  on(event, cb) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(cb);
    this.listeners.set(event, arr);
    return this;
  }
  off(event, cb) {
    const arr = this.listeners.get(event);
    if (arr) this.listeners.set(event, arr.filter((f) => f !== cb));
    return this;
  }
  emit(event, payload) {
    const arr = this.listeners.get(event);
    if (arr) for (const cb of arr) cb(payload);
    return !!arr?.length;
  }
  reset(playerAmount) {
    this.gamePhase = 0;
    this.cardsInTable = [];
    this.playerChips = [];
    this.playerDropped = [];
    this.playerBet = [];
    this.totalRaiseInRound = 0;
    this.totalPot = 0;
    this.playerAmount = playerAmount;
    this.playersMemory = [];
    this.playersRaisedInTurn = 0;
    this.pot = new Pot(0);
    for (let i = playerAmount - 1; i >= 0; i--) {
      this.playersMemory[i] = _GameObserver.emptyMemory();
    }
    this.totalMemory = this.playersMemory.slice();
    this.emit("reset");
  }
  static emptyMemory() {
    const empty = () => ({
      fold: 0,
      check: 0,
      call: 0,
      raise: 0,
      bet: 0,
      bluff: 0,
      allIn: 0,
      total: 0
    });
    return { preflop: empty(), flop: empty(), turn: empty(), river: empty(), total: empty() };
  }
  /** Called to update turn, blinds, phase, etc. */
  changeTurnData(newTurn, gamePhase, blindIndex, leaderBetPlayer, playerBigBlind, playerSmallBlind, round, cardInDeck, headTablePlayer) {
    this.headTablePlayer = headTablePlayer;
    this.turnPlayer = newTurn;
    this.blindIndex = blindIndex;
    this.leaderBetPlayer = leaderBetPlayer;
    this.playerBigBlind = playerBigBlind;
    this.playerSmallBlind = playerSmallBlind;
    this.gamePhase = gamePhase;
    this.round = round;
    this.cardsInDeck = cardInDeck;
    this.emit("turnChanged", this.getState());
  }
  /** Called when a player's chips or fold status changes. */
  changePlayerData(playerChair, chips, playerLose, playerBet) {
    this.playerChips[playerChair] = chips;
    if (playerLose === true && this.playerDropped.indexOf(playerChair) === -1) {
      this.playerDropped.push(playerChair);
    } else if (playerLose === false && this.playerDropped.indexOf(playerChair) !== -1) {
      this.playerDropped.splice(this.playerDropped.indexOf(playerChair), 1);
    }
    this.playerBet[playerChair] = playerBet;
    this.emit("playerChanged", { playerChair, chips, playerLose, playerBet });
  }
  /** Called when a player performs an action (fold, call, raise, etc.). */
  recordAction(playerChair, playerAction) {
    const phaseName = this.getPhaseName();
    const ACTION_NAMES = ["none", "fold", "call", "check", "bet", "raise", "bluff", "allIn"];
    const key = ACTION_NAMES[playerAction];
    this.totalMemory[playerChair][phaseName][key]++;
    this.playersMemory[playerChair][phaseName][key]++;
    this.playersMemory[playerChair].total[key]++;
    this.totalMemory[playerChair].total[key]++;
    if (playerAction >= 4) {
      this.totalRaiseInRound++;
    }
    this.emit("actionPerformed", { playerChair, playerAction });
  }
  /** Reset memory for a new hand (keep totalMemory but clear round-specific). */
  resetRoundMemory() {
    for (let i = this.playerAmount - 1; i >= 0; i--) {
      this.playersMemory[i] = _GameObserver.emptyMemory();
    }
    this.totalRaiseInRound = 0;
    this.emit("roundMemoryReset");
  }
  // ---- Getters ----
  getHighestBet() {
    return this.playerBet[this.leaderBetPlayer];
  }
  getCardsInTable() {
    return this.cardsInTable;
  }
  getCardsInDeck() {
    return this.cardsInDeck;
  }
  getPlayerChip(chair) {
    return this.playerChips[chair];
  }
  getPlayerBet(chair) {
    return this.playerBet[chair];
  }
  getPot() {
    return this.pot;
  }
  getTotalRaiseInRound() {
    return this.totalRaiseInRound;
  }
  getBlindIndex() {
    return this.blindIndex;
  }
  getPlayerBefore(playerId) {
    let total = 0;
    let playerAux = this.playerBigBlind + 1 > this.playerAmount - 1 ? 0 : this.playerBigBlind + 1;
    while (playerAux !== playerId) {
      if (this.playerDropped.indexOf(playerAux) === -1) total++;
      playerAux = playerAux + 1 > this.playerAmount - 1 ? 0 : playerAux + 1;
    }
    return total;
  }
  getGamePhase() {
    return this.gamePhase;
  }
  getPhaseName() {
    return ["preflop", "flop", "turn", "river"][this.gamePhase];
  }
  getAverageRaised(excludedPlayer) {
    let average = 0, totalAction = 0, amount = 0;
    let playerAux = excludedPlayer + 1 > this.playerAmount - 1 ? 0 : excludedPlayer + 1;
    while (playerAux !== excludedPlayer) {
      if (this.playerDropped.indexOf(playerAux) === -1 && this.playerBet[playerAux] >= this.playerBet[this.leaderBetPlayer]) {
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
  getAverageRaisedPlayer(playerId) {
    const phaseActions = this.playersMemory[playerId][this.getPhaseName()];
    const total = phaseActions.total;
    const raise = phaseActions.raise;
    const raisePerc = total === 0 ? 0 : Math.round(100 * raise / total);
    return { raisePerc, totalAction: total };
  }
  getPlayersRaiseInTurn() {
    return this.playersRaisedInTurn;
  }
  getRaisedInRound(playerChair) {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (this.playerDropped.indexOf(i) === -1 && i !== playerChair) {
        total += this.playersMemory[i].total.raise;
      }
    }
    return total;
  }
  getPlayerRaisedInRound(playerChair) {
    return this.playersMemory[playerChair].total.raise;
  }
  getRaisedInGame(playerChair) {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (this.playerDropped.indexOf(i) === -1 && i !== playerChair) {
        total += this.totalMemory[i].total.raise;
      }
    }
    return total;
  }
  getStillPlaying() {
    return this.playerAmount - this.playerDropped.length;
  }
  getPlayersAHead(playerChair) {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (i < this.leaderBetPlayer && playerChair < i && this.playerDropped.indexOf(i) === -1) total++;
    }
    return total;
  }
  getPlayerAmount() {
    return this.playerAmount;
  }
  getRound() {
    return this.round;
  }
  getPlayersChips() {
    return this.playerChips;
  }
  getPlayersDropped() {
    return this.playerDropped;
  }
  getPlayersBet() {
    return this.playerBet;
  }
  resetRoundData() {
    this.cardsInDeck = 52;
    this.cardsInTable = [];
  }
  getPlayerBigBlind() {
    return this.playerBigBlind;
  }
  getPlayerSmallBlind() {
    return this.playerSmallBlind;
  }
  getTotalChips() {
    let total = 0;
    for (let i = 0; i < this.playerChips.length; i++) {
      if (this.playerDropped.indexOf(i) === -1) total += this.playerChips[i];
    }
    return total;
  }
  getRankingPlayers(firstChair) {
    const ranking = [];
    const valuePlayer = [];
    for (let i = 0; i < this.playerAmount; i++) {
      valuePlayer[i] = this.playerChips[i];
      ranking[i] = i;
    }
    let auxRank = ranking[0];
    let auxValue = valuePlayer[0];
    ranking[0] = ranking[firstChair];
    valuePlayer[0] = valuePlayer[firstChair];
    ranking[firstChair] = auxRank;
    valuePlayer[firstChair] = auxValue;
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
  getPlayersNoAllIn(playerChair) {
    let total = 0;
    for (let i = 0; i < this.playerAmount; i++) {
      if (this.playerChips[i] > 0 && i !== playerChair && this.playerDropped.indexOf(i) === -1) total++;
    }
    return total;
  }
  getPlayerMemory() {
    return this.playersMemory.slice();
  }
  getTotalMemory() {
    return this.totalMemory.slice();
  }
  setMemory(playersMemory, totalMemory) {
    this.playersMemory = playersMemory.slice();
    this.totalMemory = totalMemory.slice();
  }
  /** Full serializable state snapshot. */
  getState() {
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
      totalRaiseInRound: this.totalRaiseInRound
    };
  }
  /** Restore from a serialized state. */
  restoreState(state) {
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
    this.emit("restored");
  }
};

// src/chance/probabilityCalcuator.ts
var ProbabilityCalculator = class {
  /** Number of unseen cards of a given rank (or suit, or both). */
  getOuts(revealedCards, value, color = -1) {
    if (value === -1) {
      return 13 - this.getColorCount(revealedCards, color);
    } else if (color === -1) {
      return 4 - this.getValueCount(revealedCards, value);
    } else {
      return this.isCardRevealed(revealedCards, value, color) ? 0 : 1;
    }
  }
  /** Probability (%) of drawing needed cards (multiple independent groups). */
  getOutsPercentage(needed, outs, same, remainingCard, cardsInDeck) {
    let totalNeeded = 0;
    let totalOutsPattern = 1;
    for (let i = 0; i < needed.length; i++) {
      if (same[i]) {
        totalOutsPattern *= this.getPatterns(needed[i], outs[i]);
      } else {
        totalOutsPattern *= this.multiplyOuts(outs);
      }
      totalNeeded += needed[i];
    }
    const deckAmountTemp = cardsInDeck - totalNeeded;
    const newCardsLeft = remainingCard - totalNeeded;
    if (newCardsLeft > 0) {
      totalOutsPattern *= this.getPatterns(newCardsLeft, deckAmountTemp);
    } else if (newCardsLeft < 0) {
      return 0;
    }
    return 100 * totalOutsPattern / this.getPatterns(remainingCard, cardsInDeck);
  }
  /** Count how many cards of a given suit are already revealed. */
  getColorCount(revealedCards, color) {
    let count = 0;
    for (let i = 0; i < revealedCards.length; i++) {
      if (revealedCards[i].color === color) count++;
    }
    return count;
  }
  /** Count how many cards of a given rank are already revealed. */
  getValueCount(revealedCards, value) {
    let count = 0;
    for (let i = 0; i < revealedCards.length; i++) {
      if (revealedCards[i].value === value) count++;
    }
    return count;
  }
  /** Check if a specific card (value + suit) is already revealed. */
  isCardRevealed(revealedCards, value, color) {
    for (let i = 0; i < revealedCards.length; i++) {
      if ((value === -1 || revealedCards[i].value === value) && (color === -1 || revealedCards[i].color === color)) {
        return true;
      }
    }
    return false;
  }
  /** Combination C(amount, newCard). May be overridden by HandEvaluator with config table. */
  getPatterns(newCard, amount) {
    if (newCard <= 0) return 1;
    let result = 1;
    for (let i = 1; i <= newCard; i++) {
      result = result * (amount - i + 1) / i;
    }
    return Math.round(result);
  }
  multiplyOuts(outs) {
    let total = 1;
    for (let i = 0; i < outs.length; i++) total *= outs[i];
    return total;
  }
  /** Returns plain card objects that are not yet revealed (up to `amount`). */
  getAvailableCard(revealedCards, value, color, amount = -1) {
    const available = [];
    if (value !== -1) {
      if (color === -1) {
        for (let c = 0; c < 4; c++) {
          if (!this.isCardRevealed(revealedCards, value, c)) {
            available.push({ value, color: c });
            if (amount !== -1 && available.length >= amount) break;
          }
        }
      } else {
        if (!this.isCardRevealed(revealedCards, value, color)) {
          available.push({ value, color });
        }
      }
    } else {
      for (let v = 14; v >= 2; v--) {
        if (!this.isCardRevealed(revealedCards, v, color)) {
          available.push({ value: v, color });
          if (amount !== -1 && available.length >= amount) break;
        }
      }
    }
    return available;
  }
  /**
   * Returns an array where index = number of identical ranks, value = count of such groups.
   * e.g., [0,0,1,0,0] means one pair.
   */
  getSameKinds(revealedCards) {
    const sameKind = [0, 0, 0, 0, 0];
    const copy = [...revealedCards];
    while (copy.length) {
      const val = copy[0].value;
      const count = this.getValueCount(copy, val);
      sameKind[count]++;
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].value === val) copy.splice(i, 1);
      }
    }
    return sameKind;
  }
};

// src/chance/highestCard.ts
var ChanceHighestCard = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, ownCards, _remainingCards, cardsInDeck) {
    let found = false;
    const foundHand = {
      category: PokerHand.HighCard,
      cards: []
    };
    let projects = [];
    let totalPerHand = 0;
    const remainingCardAux = ownCards.length > 0 ? 0 : 2;
    for (let i = 14; i > 2; i--) {
      let totalProjectPer = 0;
      const project = { card: i, perc: 0, project: [] };
      for (let j = i - 1; j > 1; j--) {
        const perc = i === j ? 0 : this.searchHighCardPerc(revealedCards, i, j, remainingCardAux, cardsInDeck);
        const subProject = { card: j, perc };
        project.project.push(subProject);
        totalProjectPer += perc;
        if (perc >= 100) {
          foundHand.cards = [i, j];
          const foundHandCards = [];
          let availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, i, -1, 1);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            foundHandCards.push(availableCards[h]);
          }
          availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, j, -1, 1);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
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
      projects
    };
  }
  searchHighCardPerc(revealedCards, cardValue, cardValue2, remainingCards, cardsInDeck) {
    const outs = [];
    const needed = [];
    const same = [];
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
};

// src/chance/sameKind.ts
function checkSameKind(probabilityCalculator, category, revealedCards, remainingCards, sameAmount, cardsInDeck) {
  const foundHand = {
    category,
    cards: []
  };
  let projects = [];
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
    const project = { card: i, perc: 0, project: [] };
    const totalProjectPer = searchSameKindPerc(probabilityCalculator, sameAmount, revealedCards, i, remainingCards, cardsInDeck);
    project.perc = totalProjectPer;
    projects.push(project);
    totalPerHand += totalProjectPer;
    if (totalProjectPer >= 100) {
      foundHand.cards = [];
      const foundHandCards = [];
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
    projects
  };
}
function searchSameKindPerc(probabilityCalculator, sameAmount, revealedCards, cardValue, remainingCards, cardsInDeck) {
  const sameAmountNeeded = sameAmount - probabilityCalculator.getValueCount(revealedCards, cardValue);
  if (sameAmountNeeded <= 0) return 100;
  if (remainingCards < sameAmountNeeded) return 0;
  const outs = probabilityCalculator.getOuts(revealedCards, cardValue);
  if (outs < sameAmountNeeded) return 0;
  return probabilityCalculator.getOutsPercentage([sameAmountNeeded], [outs], [true], remainingCards, cardsInDeck);
}
var ChancePair = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    return checkSameKind(this.probabilityCalculator, PokerHand.OnePair, revealedCards, remainingCards, 2, cardsInDeck);
  }
};
var ChanceThreeOfKind = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    return checkSameKind(this.probabilityCalculator, PokerHand.ThreeOfKind, revealedCards, remainingCards, 3, cardsInDeck);
  }
};
var ChanceFourOfKind = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    return checkSameKind(this.probabilityCalculator, PokerHand.FourOfKind, revealedCards, remainingCards, 4, cardsInDeck);
  }
};

// src/chance/twoPair.ts
var ChanceTwoPair = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    let found = false;
    const foundHand = {
      category: PokerHand.TwoPair,
      cards: []
    };
    const projects = [];
    let totalPerHand = 0;
    if (revealedCards.length + remainingCards < 4) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }
    const sameKindHand = this.probabilityCalculator.getSameKinds(revealedCards);
    const minSameKind = 2 - remainingCards;
    if (minSameKind > 0 && sameKindHand[minSameKind] === 0)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    if (remainingCards === 0 && sameKindHand[2] < 2)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    if (remainingCards === 1 && sameKindHand[2] === 0)
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    for (let i = 14; i > 2; i--) {
      const project = { card: i, perc: 0, project: [] };
      let totalProjectPer = 0;
      for (let j = i - 1; j > 1; j--) {
        const perc = i === j ? 0 : this.searchTwoPairPerc(revealedCards, i, j, remainingCards, cardsInDeck);
        const subProject = { card: j, perc };
        project.project.push(subProject);
        totalProjectPer += perc;
        if (perc >= 100) {
          foundHand.cards = [i, j];
          const foundHandCards = [];
          let availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, i, -1, 2);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            if (h < 1) foundHand.cards.push(availableCards[h].value);
            foundHandCards.push(availableCards[h]);
          }
          availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, j, -1, 2);
          for (let h = 0; h < availableCards.length && foundHandCards.length < 5; h++) {
            if (h < 1) foundHand.cards.push(availableCards[h].value);
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
      projects
    };
  }
  searchTwoPairPerc(revealedCards, cardValue, cardValue2, remainingCards, cardsInDeck) {
    const outs = [];
    const needed = [];
    const same = [];
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
};

// src/chance/straight.ts
var ChanceStraight = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    const foundHand = {
      category: PokerHand.Straight,
      cards: []
    };
    const projects = [];
    let totalPerHand = 0;
    const straightPattern = [];
    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }
    for (let i = 14; i > 4; i--) {
      const project = { card: i, perc: 0, project: [] };
      const totalProjectPer = this.searchStraightPerc(
        revealedCards,
        i,
        remainingCards,
        cardsInDeck,
        straightPattern
      );
      project.perc = totalProjectPer;
      projects.push(project);
      totalPerHand += totalProjectPer;
      if (totalProjectPer >= 100) {
        foundHand.cards = [];
        const foundHandCards = [];
        for (let h = i; h > 0 && foundHandCards.length < 5; h--) {
          const val = h === 1 ? 14 : h;
          const availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, val, -1, 1);
          if (availableCards.length) {
            foundHand.cards.push(availableCards[0].value);
            foundHandCards.push(availableCards[0]);
          }
        }
        foundHand.foundHandCards = foundHandCards;
        break;
      }
    }
    return {
      total: totalPerHand,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects
    };
  }
  searchStraightPerc(revealedCards, cardValue, remainingCards, cardsInDeck, straightPattern) {
    const cardsNeed = [];
    let auxNeed = 0;
    const cardInitStraight = cardValue - 5;
    for (let i = cardValue; i > cardInitStraight; i--) {
      const val = i === 1 ? 14 : i;
      if (this.probabilityCalculator.getValueCount(revealedCards, val) === 0) {
        if (remainingCards < ++auxNeed) return 0;
        cardsNeed.push(i);
      }
    }
    const amount = cardsNeed.length;
    if (amount === 0) return 100;
    if (remainingCards < amount) return 0;
    const pattern = cardsNeed.join();
    const cardInitCheck = cardValue + 5;
    for (let i = cardValue + 1; i < cardInitCheck && i <= 14; i++) {
      if (straightPattern[i] === pattern) return 0;
    }
    straightPattern[cardValue] = pattern;
    const outs = [];
    for (let i = 0; i < amount; i++) {
      const out = this.probabilityCalculator.getOuts(revealedCards, cardsNeed[i]);
      if (out === 0) return 0;
      outs.push(out);
    }
    return this.probabilityCalculator.getOutsPercentage([amount], outs, [false], remainingCards, cardsInDeck);
  }
};

// src/chance/flush.ts
var ChanceFlush = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    const foundHand = {
      category: PokerHand.Flush,
      cards: []
    };
    const projects = [];
    let totalProjectPer = 0;
    let minFlushCheck = 5;
    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }
    for (let color = 0; color < 4; color++) {
      if (this.probabilityCalculator.getColorCount(revealedCards, color) + remainingCards >= 5) {
        let colorTotal = 0;
        for (let value = 14; value > minFlushCheck; value--) {
          const project = { card: value, perc: 0, project: [] };
          let perc = 0;
          if (!this.probabilityCalculator.isCardRevealed(revealedCards, value, color) || this.probabilityCalculator.getOuts(revealedCards, value, color) !== 0) {
            perc = this.searchFlushPerc(revealedCards, value, color, remainingCards, cardsInDeck);
            project.perc = perc;
            projects.push(project);
            if (perc >= 100) {
              if (value > minFlushCheck) {
                minFlushCheck = value;
                foundHand.cards = [];
                const foundHandCards = [];
                for (let v = value; v >= 2 && foundHandCards.length < 5; v--) {
                  if (this.probabilityCalculator.isCardRevealed(revealedCards, v, color)) {
                    foundHand.cards.push(v);
                    foundHandCards.push({ value: v, color });
                  }
                }
                foundHand.foundHandCards = foundHandCards;
              }
              break;
            }
            if (this.probabilityCalculator.isCardRevealed(revealedCards, value, color)) break;
          }
          colorTotal += perc;
        }
        totalProjectPer += this.searchFlushPerc(revealedCards, 0, color, remainingCards, cardsInDeck);
      }
    }
    return {
      total: totalProjectPer,
      foundHand,
      foundHandCards: foundHand.foundHandCards || [],
      projects
    };
  }
  searchFlushPerc(revealedCards, cardValue, cardColor, remainingCards, cardsInDeck) {
    const outs = [];
    const needed = [];
    const same = [];
    let auxRemainingCard = remainingCards;
    const colorCount = this.probabilityCalculator.getColorCount(revealedCards, cardColor);
    let neededFlush = 5 - colorCount;
    if (neededFlush < 0) neededFlush = 0;
    if (remainingCards < neededFlush) return 0;
    let highestStillNeeded = false;
    if (cardValue > 0 && !this.probabilityCalculator.isCardRevealed(revealedCards, cardValue, cardColor)) {
      const out = this.probabilityCalculator.getOuts(revealedCards, cardValue, cardColor);
      if (out === 0) return 0;
      outs.push(out);
      needed.push(1);
      same.push(true);
      highestStillNeeded = true;
      neededFlush--;
      auxRemainingCard--;
    }
    if (auxRemainingCard < neededFlush) return 0;
    if (neededFlush > 0) {
      let totalOuts = 0;
      const maxVal = cardValue > 0 ? cardValue : 14;
      for (let v = maxVal; v > 1; v--) {
        if (cardValue > 0 && v === cardValue) continue;
        totalOuts += this.probabilityCalculator.getOuts(revealedCards, v, cardColor);
      }
      if (totalOuts < neededFlush) return 0;
      outs.push(totalOuts);
      needed.push(neededFlush);
      same.push(true);
    } else if (neededFlush === 0 && !highestStillNeeded) {
      return 100;
    }
    return this.probabilityCalculator.getOutsPercentage(needed, outs, same, remainingCards, cardsInDeck);
  }
};

// src/chance/fullHouse.ts
var ChanceFullHouse = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    const foundHand = {
      category: PokerHand.FullHouse,
      cards: []
    };
    const projects = [];
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
      const project = { card: i, perc: 0, project: [] };
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
          const foundHandCards = [];
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
      projects
    };
  }
  searchFullHousePerc(revealedCards, threeKindValue, pairValue, remainingCards, cardsInDeck) {
    const outs = [];
    const needed = [];
    const same = [];
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
};

// src/chance/straightFlush.ts
function searchStraightFlushPerc(probabilityCalculator, revealedCards, cardValue, cardColor, remainingCards, cardsInDeck, straightPattern) {
  const cardsNeed = [];
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
    if (straightPattern[i] === pattern) return 0;
  }
  straightPattern[cardValue] = pattern;
  const outs = [];
  for (let i = 0; i < amount; i++) {
    const out = probabilityCalculator.getOuts(revealedCards, cardsNeed[i], cardColor);
    if (out === 0) return 0;
    outs.push(out);
  }
  return probabilityCalculator.getOutsPercentage([amount], outs, [false], remainingCards, cardsInDeck);
}
var ChanceStraightFlush = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    const foundHand = {
      category: PokerHand.StraightFlush,
      cards: []
    };
    const projects = [];
    let totalPerHand = 0;
    let minStraightCheck = 4;
    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }
    for (let color = 0; color < 4; color++) {
      if (this.probabilityCalculator.getColorCount(revealedCards, color) + remainingCards >= 5) {
        const straightPattern = [];
        for (let value = 13; value >= minStraightCheck; value--) {
          const project = { card: value, perc: 0, project: [] };
          const perc = searchStraightFlushPerc(
            this.probabilityCalculator,
            revealedCards,
            value,
            color,
            remainingCards,
            cardsInDeck,
            straightPattern
          );
          project.perc = perc;
          projects.push(project);
          totalPerHand += perc;
          if (perc >= 100) {
            if (value > minStraightCheck) {
              minStraightCheck = value;
              foundHand.cards = [];
              const foundHandCards = [];
              for (let v = value; v > 0 && foundHandCards.length < 5; v--) {
                const val = v === 1 ? 14 : v;
                const availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, val, -1, 1);
                if (availableCards.length) {
                  foundHand.cards.push(availableCards[0].value);
                  foundHandCards.push(availableCards[0]);
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
      projects
    };
  }
};
var ChanceRoyalFlush = class {
  probabilityCalculator;
  constructor(probabilityCalculator) {
    this.probabilityCalculator = probabilityCalculator;
  }
  check(revealedCards, _ownCards, remainingCards, cardsInDeck) {
    const foundHand = {
      category: PokerHand.RoyalFlush,
      cards: []
    };
    const projects = [];
    let totalPerHand = 0;
    const straightPattern = [[], [], [], []];
    if (revealedCards.length + remainingCards < 5) {
      return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
    }
    for (let color = 0; color < 4; color++) {
      if (this.probabilityCalculator.getColorCount(revealedCards, color) + remainingCards >= 5) {
        const project = { card: 14, perc: 0, project: [] };
        const perc = searchStraightFlushPerc(
          this.probabilityCalculator,
          revealedCards,
          14,
          color,
          remainingCards,
          cardsInDeck,
          straightPattern[color]
        );
        project.perc = perc;
        projects.push(project);
        totalPerHand += perc;
        if (perc >= 100) {
          foundHand.cards = [];
          const foundHandCards = [];
          for (let v = 14; v > 9; v--) {
            const availableCards = this.probabilityCalculator.getAvailableCard(revealedCards, v, -1, 1);
            if (availableCards.length) {
              foundHand.cards.push(availableCards[0].value);
              foundHandCards.push(availableCards[0]);
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
      projects
    };
  }
};

// src/evaluator.ts
var HandEvaluator = class {
  gameObserver;
  config;
  probabilityCalculator;
  chanceHands;
  firstPartPerc;
  secondPartPerc;
  constructor(gameObserver, config) {
    this.gameObserver = gameObserver;
    this.config = config;
    this.probabilityCalculator = new ProbabilityCalculator();
    if (config.pattern && config.pattern.length > 0) {
      this.probabilityCalculator.getPatterns = (newCard, amount) => {
        return config.pattern[amount][newCard - 1];
      };
    }
    this.chanceHands = this.createChanceHands();
    this.initPartPerc();
  }
  initPartPerc() {
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
        this.firstPartPerc[i][j] = 110 * subHandValues[j] / maxPercValueFirstPart;
        this.secondPartPerc[i][j] = 110 * secondPartValues[j] / maxPercValueSecondPart;
      }
    }
  }
  createChanceHands() {
    const pc = this.probabilityCalculator;
    const hands = [];
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
  compareTwoHands(hand1, hand2) {
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
  getBestCategory(hand) {
    const tableCards = this.gameObserver.getCardsInTable();
    const allCards = [...hand, ...tableCards];
    const bestHand = this.getBestHand(allCards, hand);
    return bestHand.foundHand ? bestHand.foundHand.category : 0;
  }
  getBestHand(revealedCards, ownCards) {
    const handResult = this.getHandPercentage(revealedCards, ownCards, 0);
    if (handResult.handFound !== -1) {
      return handResult.chanceHandData[handResult.handFound];
    }
    return { total: 0, foundHand: null, foundHandCards: [], projects: [] };
  }
  getHandPercentage(revealedCards, ownCards, remainingCards) {
    const chanceHandList = [];
    let handFound = -1;
    let handCardAmount = 0;
    const cardsInDeck = this.gameObserver.getCardsInDeck();
    for (let i = this.chanceHands.length - 1; i >= 0; i--) {
      const chanceHand = this.chanceHands[i].check(
        revealedCards,
        ownCards,
        remainingCards,
        cardsInDeck
      );
      if (chanceHand.total > 100) chanceHand.total = 100;
      chanceHandList[i] = chanceHand;
      if (chanceHand.foundHand && chanceHand.foundHand.cards.length > 0) {
        handFound = i;
        handCardAmount = chanceHand.foundHandCards.length;
        if (i === 0) handCardAmount = 1;
        this.addKickerCards(chanceHand, revealedCards);
        break;
      }
    }
    return { chanceHandData: chanceHandList, handCardAmount, handFound };
  }
  addKickerCards(chanceHand, revealedCards) {
    if (!chanceHand.foundHand) return;
    let amount = chanceHand.foundHandCards.length;
    if (amount >= 5) return;
    for (let val = 14; val >= 2; val--) {
      if (this.probabilityCalculator.getValueCount(revealedCards, val) !== 0) {
        for (let color = 0; color < 4; color++) {
          if (this.probabilityCalculator.isCardRevealed(revealedCards, val, color)) {
            let alreadyUsed = false;
            for (let h = 0; h < amount; h++) {
              if (chanceHand.foundHandCards[h].value === val && chanceHand.foundHandCards[h].color === color) {
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
  getAllPercentages(revealedCards, ownCards, extraRemainingCards) {
    const percentages = [];
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
  getRankings(playerAmount, hand) {
    const tableCards = this.gameObserver.getCardsInTable();
    const ownHand = hand;
    const revealedCards = [...ownHand, ...tableCards];
    const ownPercentageHands = this.getAllPercentages(revealedCards, ownHand, 0);
    const otherPercentageHands = this.getAllPercentages(tableCards, [], 2);
    const rankings = [];
    for (let i = 0; i < ownPercentageHands.length; i++) {
      const ownPerc = ownPercentageHands[i];
      const otherPerc = otherPercentageHands[i];
      const ownRanking = this.getHandRanking(playerAmount, ownPerc);
      const otherRanking = this.getHandRanking(playerAmount, otherPerc);
      let otherHighRanking = otherRanking;
      if (ownPerc.handFound !== -1) {
        const ownFoundHand = {
          cards: [...ownPerc.chanceHandData[ownPerc.handFound].foundHand.cards],
          category: ownPerc.chanceHandData[ownPerc.handFound].foundHand.category
        };
        ownFoundHand.cards[ownFoundHand.cards.length - 1]++;
        otherHighRanking = this.getHandRanking(playerAmount, otherPerc, ownFoundHand);
      }
      rankings.push({ ownRanking, otherRanking, otherHighRanking });
    }
    return rankings;
  }
  getHandRanking(playerAmount, percentageHands, foundHand) {
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
              playerAmount,
              handIndex,
              projectHand.card,
              projectHand.project[q].card,
              perc
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
  calcPercToRanking(playerAmount, handIndex, firstCardValue, secondCardValue, perc) {
    if (perc === 0) return 0;
    const minHandRanking = this.config.minHandValues[playerAmount][handIndex];
    const maxHandRanking = this.config.maxHandValues[playerAmount][handIndex];
    const range = maxHandRanking - minHandRanking;
    let firstPart = 0;
    let secondPart = 0;
    if (firstCardValue !== -1) {
      firstPart = this.firstPartPerc[handIndex][firstCardValue - 1] * range / 100;
      if (secondCardValue !== -1) {
        secondPart = this.secondPartPerc[handIndex][secondCardValue - 1] * range / 100;
      }
    }
    const totalRank = minHandRanking + firstPart + secondPart;
    return perc * totalRank / 100;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Action,
  Card,
  CardColor,
  ChanceFlush,
  ChanceFourOfKind,
  ChanceFullHouse,
  ChanceHighestCard,
  ChancePair,
  ChanceRoyalFlush,
  ChanceStraight,
  ChanceStraightFlush,
  ChanceThreeOfKind,
  ChanceTwoPair,
  Deck,
  GameObserver,
  GamePhase,
  HandEvaluator,
  HandWin,
  Player,
  PokerHand,
  Pot,
  ProbabilityCalculator
});
//# sourceMappingURL=index.js.map