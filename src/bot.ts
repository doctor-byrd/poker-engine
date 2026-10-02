import { Action, BluffType, BotTypeValue, CardData, Decision, GamePhase } from './constants.js';
import { Player } from './player.js';
import type { GameObserver } from './observer.js';
import type { HandEvaluator } from './evaluator.js';
import { BOT_CONFIG } from './botConfig.js';

/** Minimal bot personality config shape (see botConfig.ts for the full tables). */
export interface BotPersonality {
  maxLevelInflPoints: number;
  baseCallLimit: number;
  callLimitInfluence: number;
  toManyCalled: { called: number; ba: number; infl: number }[];
  decisionRaise: {
    toRaiseAim: number; rankBaToCall: number; rankPosition: number; rankStillPlaying: number;
    rankPhase: number; rankPhaseValue: number; rankHistoryRaise: number; rankAlreadyEnoughIn: number;
  }[];
  smallScareMax: number; stealMax: number; riskyStealMax: number; fakeMax: number;
  smallScareMin: number; stealMin: number; riskyStealMin: number; fakeMin: number;
  rankingPhase: number[];
  maxMemNoRaise: number;
  memReli: number;
  bluffCallLimit: number;
  raiseMin: number[][];
  raiseMax: number[][];
  bluffRaiseMin: number[][];
  bluffRaiseMax: number[][];
  nervousData: { negStepFactor: number; unsureRankFactor: number; certaintyPenalty: number; baRankFactor: number };
  steamyReductionfactor: number;
  fireData: { penalty: number; negStep: number; posStep: number };
  minProWinToRaiseHouse: number;
  rankingToPossibility: number[];
  rankingFeel: number[][];
  feelAndPoss: number[][];
  histRaiseRound: number[][];
  histRaiseGame: number[][];
  alreadyEnoughIn: number[][];
  rankingBaToCall: number[][];
  [key: string]: any;
}

export interface EngineConfig {
  botConfig: BotPersonality[];
  bigBlind: number[];
  smallBlind: number[];
  levelBot: number;
  maxRaiseRound: number;
  initBluffRoundPreflop: number;
  percWinPreFlop: number;
  botAllInMax: number;
  forcedBotCall?: boolean;
  forcedBotFold?: boolean;
  [key: string]: any;
}

interface NervousData {
  negStep: number; maxUnsure: number; maxBa: number; level: number;
  tiltLevel: number; maxUnsureRanking: number; maxBaRanking: number;
}
interface SteamyData {
  level: number; tiltLevel: number; step: number; maxBa: number; reduction: number;
  reductionGoodCall: number; reductionRatioWhenSteamed: number; stepBadBeat: number;
  stepClosed: number; maxBaBadBeat: number; diffMax: number; stepDevider: number;
  inflMaxCall: number; inflMaxRaise: number;
}

/**
 * Bot – heuristic AI player. Ported from PokerBot.js.
 * Reads game state through the GameObserver and decides actions via
 * call/raise/bluff evaluation using probabilistic hand rankings.
 */
export class Bot extends Player {
  isBot = true;
  botType: BotTypeValue;
  level: number;
  handEvaluator: HandEvaluator;
  gameObserver: GameObserver & { config: EngineConfig };
  bluff: number = BluffType.none;
  lastBluff: number = BluffType.none;
  slowPlay = false;
  choiceCounter = 0;
  nervous = 0;
  irritation = 0;
  altIrritation = 0;
  lastAction: number = Action.check;
  lastPhase: number = GamePhase.preflop;
  barrierCall!: number;
  barrierRaise!: number;
  botData!: {
    callLimit: number;
    maxMem: number;
    negLevelPerc: number;
    bluffData: { smallScare: number; steal: number; riskySteal: number; fake: number };
    nervousData: NervousData;
    steamyData: SteamyData;
  };

  constructor(
    chair: number, chips: number,
    gameObserver: GameObserver & { config: EngineConfig },
    handEvaluator: HandEvaluator, level: number, botType: BotTypeValue
  ) {
    super(chair, chips);
    this.gameObserver = gameObserver;
    this.handEvaluator = handEvaluator;
    this.botType = botType;
    this.level = level;
    this.initData();
  }

  get personality(): BotPersonality {
    return this.gameObserver.config.botConfig[this.botType] ?? BOT_CONFIG[this.botType];
  }

  initData(): void {
    const config = this.personality;
    const maxLevelInflPerc = (100 * (this.level < 20 ? this.level : 20)) / 20;
    let maxLevelInflPoints = config.baseCallLimit + (maxLevelInflPerc * config.maxLevelInflPoints) / 100;
    maxLevelInflPoints = Math.round(10 * maxLevelInflPoints) / 10;
    const negLevelPerc = Math.round((100 * (20 - this.level)) / 20);
    const maxMem = 2.8 - negLevelPerc / 100;
    const bluffSmallScare = Math.round(Math.random() * config.smallScareMax) + config.smallScareMin;
    const bluffSteal = Math.round(Math.random() * config.stealMax) + config.stealMin;
    const bluffRiskySteal = Math.round(Math.random() * config.riskyStealMax) + config.riskyStealMin;
    const bluffFake = Math.round(Math.random() * config.fakeMax) + config.fakeMin;
    const nervousNegStep = -5.8 - Math.round((10 * maxLevelInflPerc) / 100) * config.nervousData.negStepFactor;
    const nervousMaxUnsure = 2 - Math.round((0.5 * negLevelPerc) / 100);
    const nervousMaxUnsureRanking = 26 - Math.round((8 * maxLevelInflPerc) / 100) * config.nervousData.unsureRankFactor;
    const nervousMaxBa = 19 - Math.round((3 * negLevelPerc) / 100);
    const nervousMaxBaRanking = 70 - Math.round((30 * maxLevelInflPerc) / 100) * config.nervousData.baRankFactor;
    const nervousLevel = 60 - Math.round((20 * negLevelPerc) / 100);
    const nervousTiltLevel = 80 - Math.round((18 * negLevelPerc) / 100);
    const steamyLevel = 60 - Math.round((20 * negLevelPerc) / 100);
    const steamyTiltLevel = 80 - Math.round((18 * negLevelPerc) / 100);
    const steamyStep = 6 + Math.round((4 * negLevelPerc) / 100);
    const steamyMaxba = 15 - Math.round((11 * negLevelPerc) / 100);
    const steamyReduction = 8 - Math.round((negLevelPerc * config.steamyReductionfactor) / 100);
    const steamyReductionGoodCall = 5 - Math.round((3 * negLevelPerc) / 100);
    const steamyStepBadBeat = 5 + Math.round((15 * negLevelPerc) / 100);
    const steamyStepClosed = 2 + Math.round((4 * negLevelPerc) / 100);
    const steamyMaxBaBadBeat = 20 - Math.round((6 * negLevelPerc) / 100);
    const steamyDiffMax = 100 - steamyLevel;
    const steamyStepDevider = 10 - Math.round((5 * negLevelPerc) / 100);
    const steamyInflMaxCall = 0.8 + Math.round((0.5 * negLevelPerc) / 100);
    const steamyInflMaxRaise = 1.2 + Math.round((0.9 * negLevelPerc) / 100);

    this.botData = {
      callLimit: maxLevelInflPoints,
      maxMem: maxMem,
      negLevelPerc: negLevelPerc,
      bluffData: { smallScare: bluffSmallScare, steal: bluffSteal, riskySteal: bluffRiskySteal, fake: bluffFake },
      nervousData: {
        negStep: nervousNegStep, maxUnsure: nervousMaxUnsure, maxBa: nervousMaxBa,
        level: nervousLevel, tiltLevel: nervousTiltLevel,
        maxUnsureRanking: nervousMaxUnsureRanking, maxBaRanking: nervousMaxBaRanking,
      },
      steamyData: {
        level: steamyLevel, tiltLevel: steamyTiltLevel, step: steamyStep, maxBa: steamyMaxba,
        reduction: steamyReduction, reductionGoodCall: steamyReductionGoodCall,
        reductionRatioWhenSteamed: 7, stepBadBeat: steamyStepBadBeat, stepClosed: steamyStepClosed,
        maxBaBadBeat: steamyMaxBaBadBeat, diffMax: steamyDiffMax, stepDevider: steamyStepDevider,
        inflMaxCall: steamyInflMaxCall, inflMaxRaise: steamyInflMaxRaise,
      },
    };
  }

  decideAction(): Decision {
    const cfg = this.gameObserver.config;
    let chipNeedToCall = this.gameObserver.getHighestBet() - this.bet;
    if (chipNeedToCall > this.chips) chipNeedToCall = this.chips;
    const initBet = this.bet;
    const decision: Decision = { action: Action.check, betIncrement: 0, playerChair: this.chair };
    const phase = this.gameObserver.getGamePhase();
    const stillPlaying = this.gameObserver.getStillPlaying();
    const rankings = this.handEvaluator.getRankings(stillPlaying, this.hand);
    const possRanking = this.getPossibilityHandRanking(rankings[rankings.length - 1]);
    const feel = this.getFeelHandRanking(rankings[0]);
    const chanceWin = this.getChanceWin(feel.winFeelPerc, phase);
    let proWin = this.combineFeelAndPossibility(chanceWin, possRanking, phase);
    const bigBlind = cfg.bigBlind[this.gameObserver.getBlindIndex()];
    const playersNoAllIn = this.gameObserver.getPlayersNoAllIn(this.chair);

    if (cfg.forcedBotCall) {
      if (chipNeedToCall > 0) { decision.action = Action.call; decision.betIncrement = chipNeedToCall; }
      if (this.chips === 0) decision.action = Action.allIn;
      this.sendDecision(decision.action, proWin, chipNeedToCall, initBet);
      return decision;
    }
    if (cfg.forcedBotFold) {
      decision.action = Action.fold;
      this.sendDecision(decision.action, proWin, chipNeedToCall, initBet);
      return decision;
    }

    if (playersNoAllIn === 0 && chipNeedToCall === 0) {
      if (chipNeedToCall > 0) { decision.action = Action.call; decision.betIncrement = chipNeedToCall; }
      this.sendDecision(decision.action, proWin, chipNeedToCall, initBet);
      return decision;
    }

    if (phase === GamePhase.preflop && this.gameObserver.getRound() > cfg.initBluffRoundPreflop) {
      proWin *= cfg.percWinPreFlop;
      possRanking *= cfg.percWinPreFlop;
    }
    if (this.gameObserver.botAllIn >= cfg.botAllInMax) {
      proWin /= 2;
      possRanking /= 2;
    }

    let decideToRaiseRanking = -1;
    let raiseAmount = 0;
    let decideToBluffRanking = 0;
    let bluffRaiseAmount = 0;

    // Decide to call
    if (chipNeedToCall > 0 && this.decideToCall(chipNeedToCall, proWin, phase, possRanking)) {
      decision.action = Action.call;
      decision.betIncrement = chipNeedToCall;
    } else if (chipNeedToCall > 0) {
      decision.action = Action.fold;
    }

    // Decide to raise (if not folded)
    if (decision.action !== Action.fold) {
      decideToRaiseRanking = this.getRaiseRanking(chipNeedToCall, proWin, phase, possRanking, feel);
      if (decideToRaiseRanking !== -1) {
        raiseAmount = this.getRaiseAmount(decideToRaiseRanking, phase);
        if (raiseAmount > 0) {
          decision.action = Action.raise;
          decision.betIncrement = chipNeedToCall + raiseAmount;
          if (raiseAmount < 0.5 * chipNeedToCall) {
            decision.action = Action.call;
            decision.betIncrement = chipNeedToCall;
          }
        }
      }
    }

    // Decide to bluff (if not already raised)
    if (decision.action !== Action.raise && decision.action !== Action.bluff && decision.action !== Action.bet) {
      decideToBluffRanking = this.getBluffRaiseRanking(chipNeedToCall, decideToRaiseRanking, chanceWin, feel, possRanking, proWin);
      if (decideToBluffRanking > 0) {
        bluffRaiseAmount = this.getBluffRaiseAmount(decideToBluffRanking, phase);
        if (bluffRaiseAmount > 0) {
          decision.action = Action.bluff;
          decision.betIncrement = chipNeedToCall + bluffRaiseAmount;
          if (bluffRaiseAmount < 0.5 * chipNeedToCall) {
            decision.action = Action.call;
            decision.betIncrement = chipNeedToCall;
          }
        }
      }
    }

    // Validate raise amount (must be at least big blind)
    const totalRaiseInRound = this.gameObserver.getTotalRaiseInRound();
    if (decision.betIncrement > chipNeedToCall) {
      if (
        (this.lastPhase === phase &&
          (this.lastAction === Action.raise || this.lastAction === Action.bluff || this.lastAction === Action.bet)) ||
        totalRaiseInRound > cfg.maxRaiseRound
      ) {
        decision.action = chipNeedToCall > 0 ? Action.call : Action.check;
        decision.betIncrement = chipNeedToCall;
      }
    }

    // All-in adjustment
    if ((100 * decision.betIncrement) / this.chips > 95) {
      decision.betIncrement = this.chips;
      if (decision.betIncrement > chipNeedToCall) decision.action = Action.allIn;
    }

    // Ensure minimum raise
    if (
      (decision.action === Action.raise || decision.action === Action.bluff || decision.action === Action.bet) &&
      decision.betIncrement < this.chips
    ) {
      const totalBet = decision.betIncrement;
      const totalRaise = totalBet - chipNeedToCall;
      if (totalRaise < bigBlind) {
        const missing = bigBlind - totalRaise;
        const available = this.chips - decision.betIncrement;
        const add = Math.min(available, missing);
        if ((100 * add) / totalBet <= 10 || (100 * add) / bigBlind < 30) {
          decision.betIncrement += add;
        } else {
          decision.betIncrement = chipNeedToCall;
          decision.action = chipNeedToCall === 0 ? Action.check : Action.call;
        }
      }
    }

    // Convert to all-in if raise exceeds chips
    if (decision.action === Action.raise && this.checkIfRaiseCanBeAllin(decision.betIncrement + this.bet)) {
      decision.betIncrement = this.chips;
      decision.action = Action.allIn;
    }

    // Apply decision
    this.bet += decision.betIncrement;
    this.chips -= decision.betIncrement;

    // Final check: if still need to call more after betting
    const remainingCall = this.gameObserver.getHighestBet() - this.bet;
    if (remainingCall > 0 && this.chips > 0 && decision.action !== Action.fold) {
      const extra = Math.min(remainingCall, this.chips);
      decision.betIncrement += extra;
      this.bet += extra;
      this.chips -= extra;
    }

    if (this.chips === 0) decision.action = Action.allIn;
    this.sendDecision(decision.action, proWin, chipNeedToCall, initBet);
    return decision;
  }

  decideToCall(chipNeedToCall: number, proWin: number, phase: number, possRanking: number): boolean {
    const config = this.personality;
    const percentNewBet = (100 * chipNeedToCall) / this.bet;
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const gamePhase = this.gameObserver.getGamePhase();
    const blindAmountCall = Math.round(chipNeedToCall / bigBlind);
    if (percentNewBet < 10 || (this.bet > 0 && chipNeedToCall < bigBlind)) return true;

    let limit = this.botData.callLimit;
    let infl = (config.callLimitInfluence * limit) / 100;
    limit = limit - infl / 2 + (percentNewBet * infl) / 100;
    if (blindAmountCall > 1) {
      const toMany = config.toManyCalled[phase];
      let perc = (100 * this.gameObserver.getPlayerBefore(this.chair)) / toMany.called;
      if (perc > 100) perc = 100;
      let perc2 = (100 * blindAmountCall) / toMany.ba;
      if (perc2 > 100) perc2 = 100;
      limit += limit * ((perc * perc2) / 10000);
    }
    if (limit > 8) limit = 8;
    let irritationInfl = 0;
    if (this.irritation >= this.botData.steamyData.level) {
      irritationInfl = 80;
      if (this.irritation >= this.botData.steamyData.tiltLevel) irritationInfl = 100;
      limit -= (irritationInfl * this.botData.steamyData.inflMaxCall) / 100;
    }
    const avgRaised = this.gameObserver.getAverageRaised(this.chair);
    if ((avgRaised.amount > 0 && blindAmountCall > 1) || gamePhase === GamePhase.preflop) {
      const memLimit = avgRaised.amount > 0 ? this.botData.maxMem : config.maxMemNoRaise;
      let memRel = (100 * avgRaised.totalAction) / config.memReli;
      if (memRel > 100) memRel = 100;
      let memInfl = (memRel * memLimit) / 100;
      let diff = Math.round(20 - avgRaised.average);
      if (diff > 0) {
        let diffPerc = (100 * diff) / 30;
        if (diffPerc > 100) diffPerc = 100;
        limit -= (diffPerc * memInfl) / 100;
      } else if (avgRaised.amount > 0) {
        diff = -diff;
        let diffPerc = (100 * diff) / 30;
        if (diffPerc > 100) diffPerc = 100;
        limit += (diffPerc * (memInfl / 2)) / 100;
      }
    }
    if (limit > 8) limit = 8;
    if (limit < 0) limit = 0;
    const balance = this.decideBalanceAverage(proWin, phase, chipNeedToCall);
    this.barrierCall = limit;
    this.checkNervousChanges(chipNeedToCall, balance, limit);
    if (limit <= balance) return true;
    if (this.decideToBluffCall(phase, balance, chipNeedToCall, proWin, possRanking)) {
      this.bluff = BluffType.call;
      return true;
    }
    return false;
  }

  decideToBluffCall(phase: number, toCallRanking: number, chipNeedToCall: number, proWin: number, possRanking: number): boolean {
    const totalBet = this.bet + chipNeedToCall;
    const potOdds = (100 * (this.gameObserver.getPot().betInTable + chipNeedToCall)) / totalBet;
    const percToCall = Math.round((100 * chipNeedToCall) / this.bet);
    if (potOdds < 110 && percToCall >= 300) return false;
    if (toCallRanking < 2.25) return false;
    let callLimit = this.personality.bluffCallLimit;
    const stillPlaying = this.gameObserver.getStillPlaying();
    if (stillPlaying > 3) callLimit += (callLimit / 12) * (stillPlaying - 3);
    if (potOdds >= 140) callLimit += (1.7 * ((100 * percToCall) / 350)) / 100;
    const percentOfStack = Math.round((100 * chipNeedToCall) / Number(this.chips));
    if (percentOfStack <= 20) callLimit -= (1.4 * (100 - (100 * percentOfStack) / 20)) / 100;
    if (proWin <= callLimit && (phase !== GamePhase.river || possRanking < 6)) return false;
    return true;
  }

  getRaiseRanking(chipNeedToCall: number, proWin: number, phase: number, possRanking: number, feel: FeelRanking, force = false): number {
    if (this.chips === 0 && !force) return -1;
    let ranking = this.decideBalanceAverage(proWin, phase, chipNeedToCall, true);
    const slowPlayPenalty = this.calculateSlowPlay(ranking, phase, proWin, feel, possRanking);
    ranking -= slowPlayPenalty;
    if (ranking <= 0) return -1;
    const raiseInTurn = this.gameObserver.getPlayerRaisedInRound(this.chair);
    if (raiseInTurn > 1) ranking -= ranking * (raiseInTurn / 10);
    if (ranking < 0) ranking = 0;
    let irritationInfl = 0;
    if (this.irritation >= this.botData.steamyData.level) {
      irritationInfl = 80;
      if (this.irritation >= this.botData.steamyData.tiltLevel) irritationInfl = 100;
      ranking -= (irritationInfl * this.botData.steamyData.inflMaxRaise) / 100;
    }
    const toRaiseAim = this.personality.decisionRaise[phase].toRaiseAim;
    this.barrierRaise = toRaiseAim;
    if (toRaiseAim <= ranking) return ranking;
    return -1;
  }

  getRaiseAmount(raiseRanking: number, phase: number): number {
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const config = this.personality;
    const min = config.raiseMin[phase][raiseRanking];
    const max = config.raiseMax[phase][raiseRanking];
    const range = max - min;
    let amount = min + Math.random() * range;
    amount = Math.round(amount * bigBlind);
    amount = Math.round(amount * (1 + (0.4 * (100 - this.botData.negLevelPerc)) / 100));
    if (amount < 0) amount = 0;
    return amount;
  }

  getBluffRaiseRanking(chipNeedToCall: number, raiseRanking: number, chanceWin: number, feel: FeelRanking, possRanking: number, proWin: number): number {
    const playersRaised = this.gameObserver.getPlayersRaiseInTurn();
    const amountAHead = this.gameObserver.getPlayersAHead(this.chair);
    const ownTotalBet = this.bet + chipNeedToCall;
    const potOdds = (100 * (this.gameObserver.getPot().betInTable + chipNeedToCall)) / ownTotalBet;
    let bluffRanking = 0;
    if (this.bluff === BluffType.prove || this.bluff === BluffType.steal || this.slowPlay) return 0;
    if (chanceWin >= 7 && feel.otherChanceFeelPerc > 150 && playersRaised === 0) {
      this.bluff = BluffType.prove; bluffRanking = 1;
    } else if (chanceWin >= 6.4 && feel.otherChanceFeelPerc < 140 && Math.floor(Math.random() * 10) < this.botData.bluffData.smallScare) {
      this.bluff = BluffType.prove; bluffRanking = 2;
    } else if (feel.oppDiff < 0 && chanceWin >= 5 && feel.otherChanceFeelPerc < 160 && this.bluff !== BluffType.badFuture && Math.floor(Math.random() * 5) > 2) {
      this.bluff = BluffType.badFuture;
      bluffRanking = feel.oppDiff > -8 ? 1 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3);
    } else if (possRanking > 8 && chanceWin <= 6) {
      this.bluff = BluffType.goodFuture; bluffRanking = 2 + Math.floor(Math.random() * 2);
    } else if (playersRaised === 0 && proWin >= 5 && amountAHead <= -1 + Math.floor(Math.random() * 3)) {
      if (Math.floor(Math.random() * 10) <= this.botData.bluffData.steal) {
        this.bluff = BluffType.steal; bluffRanking = 1 + Math.floor(Math.random() * 3);
      } else if (potOdds >= 240) {
        this.bluff = BluffType.steal; bluffRanking = 2 + Math.floor(Math.random() * 3);
      }
    } else if (playersRaised === 0 && proWin >= 3 && amountAHead < 2 && Math.floor(Math.random() * 10) < this.botData.bluffData.riskySteal) {
      this.bluff = BluffType.steal; bluffRanking = 1 + Math.floor(Math.random());
    } else if (feel.oppDiffPerc > 44 && feel.otherChanceFeelPerc < 500 && feel.otherChanceFeelPerc >= 180 && playersRaised < 2) {
      let fakeChance = this.botData.bluffData.fake;
      let irritationBonus = 0;
      if (this.irritation >= this.botData.steamyData.level) {
        irritationBonus = 80;
        if (this.irritation >= this.botData.steamyData.tiltLevel) irritationBonus = 100;
        if (irritationBonus >= 80) fakeChance += 1;
        if (irritationBonus === 100) fakeChance += 1;
      }
      if (Math.floor(Math.random() * 10) <= fakeChance) {
        this.bluff = BluffType.fake; bluffRanking = 2 + Math.floor(Math.random() * 4);
      }
    }
    if (raiseRanking < 2) bluffRanking--;
    if (bluffRanking < 0) bluffRanking = 0;
    if (amountAHead > 2) bluffRanking--;
    if (bluffRanking < 0) bluffRanking = 0;
    return bluffRanking;
  }

  getBluffRaiseAmount(ranking: number, phase: number): number {
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const config = this.personality;
    const min = config.bluffRaiseMin[phase][ranking];
    const max = config.bluffRaiseMax[phase][ranking];
    const amount = min + Math.random() * (max - min);
    let bet = Math.round(amount * bigBlind);
    if (bet < 0) bet = 0;
    return bet;
  }

  decideBalanceAverage(proWin: number, phase: number, chipNeedToCall: number, isRaise = false): number {
    const config = this.personality;
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const stillPlaying = this.gameObserver.getStillPlaying();
    const maxBalance = (5 * (10 - proWin)) / 10;
    if (maxBalance <= 0) return 10;
    let sum = 0, amount = 0;
    if (isRaise) {
      const raiseCfg = config.decisionRaise[phase];
      sum += raiseCfg.rankPhase * raiseCfg.rankPhaseValue;
      amount += raiseCfg.rankPhase;
      const historyRank = this.historyRaiseRanking(phase);
      sum += historyRank * raiseCfg.rankHistoryRaise;
      amount += raiseCfg.rankHistoryRaise;
      const totalBet = this.bet + chipNeedToCall;
      const bigBlindCount = Math.round(totalBet / bigBlind);
      const enoughIn = 10 - this.lookupRanking(bigBlindCount, config.alreadyEnoughIn[phase]);
      sum += enoughIn * raiseCfg.rankAlreadyEnoughIn;
      amount += raiseCfg.rankAlreadyEnoughIn;
    }
    const ba = Math.round(chipNeedToCall / bigBlind);
    const baRank = 10 - this.lookupRanking(ba, config.rankingBaToCall[phase]);
    sum += baRank * config.decisionRaise[phase].rankBaToCall;
    amount += config.decisionRaise[phase].rankBaToCall;
    const playersAhead = this.gameObserver.getPlayersAHead(this.chair);
    const posRank = 10 - (10 * playersAhead) / (stillPlaying - 1);
    sum += posRank * config.decisionRaise[phase].rankPosition;
    amount += config.decisionRaise[phase].rankPosition;
    if (amount === 0) return proWin;
    const avg = sum / amount;
    let result = proWin + Math.round(100 * ((-maxBalance / 2) + ((avg / 10) * maxBalance))) / 100;
    if (result < 0) result = 0;
    return result;
  }

  historyRaiseRanking(phase: number): number {
    const config = this.personality;
    const stillPlaying = this.gameObserver.getStillPlaying();
    const timesRoundRaised = this.gameObserver.getRaisedInRound(this.chair);
    const averageGameRaise = this.gameObserver.getRaisedInGame(this.chair) / stillPlaying;
    const roundRank = this.lookupRanking(timesRoundRaised / stillPlaying, config.histRaiseRound[phase]);
    const gameRank = this.lookupRanking(averageGameRaise, config.histRaiseGame[phase]);
    return (10 - roundRank + (10 - gameRank)) / 2;
  }

  lookupRanking(value: number, lookupArray: number[]): number {
    for (let i = 0; i < lookupArray.length; i++) {
      if (value <= lookupArray[i]) return i;
    }
    return lookupArray.length - 1;
  }

  calculateSlowPlay(raiseRanking: number, phase: number, proWin: number, feel: FeelRanking, possRanking: number): number {
    let penalty = 2;
    let maxRandom = 6;
    if (raiseRanking < 6) {
      if (proWin < 6) return 0;
      if (feel.winFeelPerc < feel.otherChanceFeelPerc) return 0;
      if (possRanking < 5) return 0;
      if (feel.oppDiffPerc < 100) return 0;
    }
    if (phase === GamePhase.river) { maxRandom = 3; penalty = 0; }
    if (this.gameObserver.getPlayersAHead(this.chair) === 0) penalty = 0;
    penalty += Math.floor(Math.random() * maxRandom);
    if (penalty === 0) return 0;
    this.slowPlay = true;
    return penalty;
  }

  checkNervousChanges(chipNeedToCall: number, ranking: number, limit: number): void {
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const ba = Math.round(chipNeedToCall / bigBlind);
    const nervousData = this.botData.nervousData;
    let baPerc = Math.round((100 * ba) / nervousData.maxBa);
    if (baPerc > 100) baPerc = 100;
    if (baPerc < 0) baPerc = 0;
    let baRank = Math.round((baPerc * nervousData.maxBaRanking) / 100);
    const diff = limit + this.personality.nervousData.certaintyPenalty - ranking;
    let unsureRank = Math.round((baPerc * nervousData.maxUnsureRanking) / 100);
    if (diff < -2) baRank = Math.round(baRank / 2);
    let add = nervousData.negStep + (baRank + unsureRank);
    if (!this.nervous) this.nervous = 0;
    const betCount = Math.round(this.bet / bigBlind);
    let betPerc = Math.round((100 * betCount) / 8);
    if (betPerc > 100) betPerc = 100;
    const chipCount = Math.round(this.chips / bigBlind);
    const chipPerc = 100 - Math.min(100, Math.round((100 * chipCount) / 12));
    add = Math.round(add * (((betPerc < chipPerc ? chipPerc : betPerc) + 20) / 100));
    this.nervous += add;
    if (this.nervous > 100) this.nervous = 100;
    if (this.nervous < 0) this.nervous = 0;
  }

  getFeelHandRanking(handRanking: { ownRanking: number; otherRanking: number; otherHighRanking: number }): FeelRanking {
    const winFeelPerc = 100 - (100 * handRanking.otherHighRanking) / handRanking.otherRanking;
    const otherChanceFeelPerc = handRanking.otherRanking === 0 ? handRanking.ownRanking : (100 * handRanking.otherRanking) / handRanking.ownRanking;
    const oppDiffPerc = handRanking.otherRanking === 0 ? 0 : (100 * handRanking.ownRanking) / handRanking.otherRanking;
    const oppDiff = handRanking.ownRanking - handRanking.otherRanking;
    return { winFeelPerc, otherChanceFeelPerc, oppDiff, oppDiffPerc };
  }

  getPossibilityHandRanking(handRanking: { ownRanking: number; otherRanking: number }): number {
    let possRanking = this.getPossibilityRanking(handRanking.ownRanking);
    const diff = possRanking - this.getPossibilityRanking(handRanking.otherRanking);
    if (diff < -3) possRanking -= 2;
    else if (diff < -1) possRanking--;
    else if (diff > 3) possRanking++;
    return possRanking;
  }

  getPossibilityRanking(ranking: number): number {
    const ranks = this.personality.rankingToPossibility;
    for (let i = 0; i < ranks.length; i++) {
      if (ranking <= ranks[i]) return i;
    }
    return ranks.length - 1;
  }

  getChanceWin(winFeel: number, phase: number): number {
    const feelRanks = this.personality.rankingFeel[phase];
    for (let i = 0; i < feelRanks.length; i++) {
      if (winFeel <= feelRanks[i]) return i;
    }
    return feelRanks.length - 1;
  }

  combineFeelAndPossibility(chanceWin: number, possRanking: number, phase: number): number {
    const weights = this.personality.feelAndPoss[phase];
    const total = weights[0] * chanceWin + weights[1] * possRanking;
    const divisor = weights[0] + weights[1];
    return Math.ceil(total / divisor);
  }

  addSteamy(badBeat = false, closedCards = false, defaultLose = false): void {
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const totalChips = this.gameObserver.getTotalChips();
    let avgChips = Math.floor((bigBlind + totalChips / 10) / 2);
    if (avgChips < bigBlind) avgChips = bigBlind;
    const betRatio = Math.round(this.bet / avgChips);
    const maxBa = badBeat ? this.botData.steamyData.maxBaBadBeat : this.botData.steamyData.maxBa;
    let ratio = Math.round((100 * betRatio) / maxBa / this.botData.steamyData.stepDevider);
    if (ratio < 0.5) ratio = 0.5;
    let toAdd = ratio * (badBeat ? this.botData.steamyData.stepBadBeat : closedCards ? this.botData.steamyData.stepClosed : this.botData.steamyData.step);
    if (defaultLose) toAdd = Math.round(0.4 * toAdd);
    else if (toAdd < 10) toAdd = Math.round(1.6 * toAdd);
    if (toAdd > 15) toAdd = 15;
    this.irritation += toAdd;
    this.altIrritation = toAdd;
    if (this.irritation > 100) this.irritation = 100;
  }

  reduceSteamy(goodCall = false): void {
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const pot = this.gameObserver.getPot().betInTable;
    let avgChips = Math.floor((bigBlind + pot / 10) / 2);
    if (avgChips < bigBlind) avgChips = bigBlind;
    let reduction: number;
    if (goodCall) {
      let betRatio = Math.round(this.bet / avgChips);
      if (betRatio === 0) return;
      if (betRatio > 3) betRatio = 3;
      reduction = this.botData.steamyData.reductionGoodCall * betRatio;
    } else {
      reduction = this.botData.steamyData.reduction;
    }
    if (this.irritation > this.botData.steamyData.level) {
      reduction *= this.botData.steamyData.reductionRatioWhenSteamed;
    }
    this.irritation -= reduction;
    if (this.irritation < 0) this.irritation = 0;
  }

  isSteamy(): boolean { return this.irritation >= this.botData.steamyData.level; }

  checkOnFireChanges(chipWins = 0): void {
    const config = this.personality;
    const bigBlind = this.gameObserver.config.bigBlind[this.gameObserver.getBlindIndex()];
    const totalChips = this.gameObserver.getTotalChips();
    let avgChips = Math.floor((bigBlind + totalChips / 10) / 2);
    const ratio = Math.round(chipWins / avgChips);
    const change = ratio >= 0 ? ratio + config.fireData.penalty : ratio - config.fireData.penalty;
    const step = change > 0 ? config.fireData.posStep : config.fireData.negStep;
    let add = change * step;
    if (add > 87) add = 87;
    this.onFire += add;
    if (this.onFire > 100) this.onFire = 100;
    if (this.onFire < 0) this.onFire = 0;
  }

  isOnFire(): boolean { return this.onFire >= 60; }
  getIrritation(): number { return this.irritation; }
  getOnFire(): number { return this.onFire; }

  checkIfRaiseCanBeAllin(totalBet: number): boolean {
    const playersBet = this.gameObserver.getPlayersBet();
    const playersChip = this.gameObserver.getPlayersChips();
    const playersDropped = this.gameObserver.getPlayersDropped();
    for (let i = 0; i < this.gameObserver.getPlayerAmount(); i++) {
      if (playersDropped.indexOf(i) === -1 && this.chair !== i && totalBet < playersBet[i] + playersChip[i]) {
        return false;
      }
    }
    return true;
  }

  sendDecision(action: number, _winPro: number, _chipNeedToCall: number, _initBet: number): void {
    this.lastAction = action;
    this.lastPhase = this.gameObserver.getGamePhase();
    this.choiceCounter++;
    this.decisionCounter++;
  }
}

export interface FeelRanking {
  winFeelPerc: number;
  otherChanceFeelPerc: number;
  oppDiff: number;
  oppDiffPerc: number;
}

export type BotHand = CardData[];