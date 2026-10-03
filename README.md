# poker-engine

A dependency-free TypeScript engine for **Texas Hold'em** poker. It provides the core building blocks you need to run a poker game or power a poker bot:

- 🃏 Cards, deck (Fisher–Yates shuffle) and pot primitives
- 👥 Player and table-state management (`GameObserver`) with a tiny built-in event bus
- ⚖️ Best-hand finding and hand comparison (`HandEvaluator`)
- 📈 Combinatorial probability analysis — outs, draw percentages, and projected hand strength for every remaining card of the hand (`Chance*` classes + `ProbabilityCalculator`)

The library is intentionally **game-loop agnostic**: it manages state, rules math, and probabilities, while you supply the betting-round logic (who acts when, blind structure resolution, side pots, etc.).

## Installation

```bash
npm install poker-engine
```

Built with [tsup](https://github.com/egoist/tsup); ships CommonJS, ESM and type declarations:

| Field    | Artifact          |
|----------|-------------------|
| `main`   | `dist/index.js`   |
| `module` | `dist/index.mjs`  |
| `types`  | `dist/index.d.ts` |

Requires Node 18+ / any ES2020-capable runtime. Works in browser bundles as well (no Node APIs are used).

## Quick start

```ts
import {
  Deck, GameObserver, HandEvaluator, Player, Card,
  Action, GamePhase, PokerHand, CardColor,
} from 'poker-engine';

// 1. Table state
const observer = new GameObserver(4);              // 4 players at the table
observer.changeTurnData(
  /* turn */ 0, GamePhase.flop, /* blindIndex */ 0,
  /* leaderBetPlayer */ 0, /* bigBlind */ 20, /* smallBlind */ 10,
  /* round */ 1, /* cardsInDeck */ 47, /* headTablePlayer */ 0,
);

// 2. Deal
const deck = new Deck();
deck.shuffle();
const hero = new Player(0, 1000);
hero.setHand(deck.draw(2));                        // hole cards

// 3. Community cards land on the observer (mutable array – push directly)
observer.cardsInTable.push(...deck.draw(3));       // flop

// 4. Evaluate the best 5-card hand (needs an EvaluatorConfig – see below)
const evaluator = new HandEvaluator(observer, config);
const best = evaluator.getBestHand(
  [...hero.hand, ...observer.getCardsInTable()],
  hero.hand,
);
console.log(best.foundHand?.category);             // e.g. PokerHand.Flush
console.log(best.foundHandCards.map(String));      // ["A♠", "K♠", "9♠", "5♠", "2♠"]
```

## Core concepts

### Cards & values

A `Card` is `{ value, color }`:

- **value**: `2..14` (11 = J, 12 = Q, 13 = K, 14 = A)
- **color**: `0 = ♠ spades, 1 = ♥ hearts, 2 = ♦ diamonds, 3 = ♣ clubs` (`CardColor` enum)

`Card.toString()` renders human-readable labels like `A♠`, `10♥`, `J♦`. Cards are serializable via `toJSON()` / `Card.from()`.

### Deck

`Deck` builds a fresh sorted 52-card deck, shuffles with Fisher–Yates, and deals with `draw(count)`. For tests or tutorials you can pin an exact order with `setFixedDeck(cards)`.

### GameObserver — the single source of truth

`GameObserver` tracks everything about the table:

| State | Description |
|-------|-------------|
| `cardsInTable` | Community cards revealed so far |
| `playerChips` / `playerBet` / `playerDropped` | Per-chair chips, current bet, folded chairs |
| `pot` | The `Pot` object (chips wagered this hand) |
| `gamePhase` | `preflop / flop / turn / river` (`GamePhase` enum) |
| `turnPlayer`, `leaderBetPlayer`, `blindIndex`, `round`, `cardsInDeck` | Turn order & dealing progress |
| `playersMemory` / `totalMemory` | Per-phase action counters per player (see *Player profiling*) |

Key mutators:

```ts
observer.changeTurnData(newTurn, gamePhase, blindIndex, leaderBetPlayer,
                        bigBlind, smallBlind, round, cardsInDeck, headTablePlayer);
observer.changePlayerData(chair, chips, hasFolded /* true|false|null */, bet);
observer.recordAction(chair, Action.raise);        // updates memory + raise cap
observer.reset(playerAmount);                      // new table configuration
observer.resetRoundMemory();                       // new hand, keep lifetime stats
```

Useful queries: `getHighestBet()`, `getStillPlaying()`, `getPlayersAHead(chair)`, `getRaisedInRound(chair)`, `getAverageRaised(excludedChair)` (aggression stats), `getRankingPlayers(firstChair)`, `getState()` / `restoreState()` for serializable snapshots.

### Event bus

`GameObserver` embeds a minimal emitter (zero dependencies) so UIs/bots can react to state changes:

```ts
observer.on('actionPerformed', ({ playerChair, playerAction }) => { /* ... */ });
observer.on('turnChanged', (state) => { /* ObserverState snapshot */ });
```

Events: `reset`, `turnChanged`, `playerChanged`, `actionPerformed`, `roundMemoryReset`, `restored`.

### Pot

`Pot` accumulates wagers (`add(bet)`), and `takeAll()` returns a copy of the pot and zeroes it out — call it when awarding the hand.

### Player

`Player` holds hole cards, chips, bet, fold status, and streak/profile flags (`wins`, `successiveWins`, `onFire`, `lucky`). `forcedBet(amount)` caps bets at remaining chips (useful for blinds and all-ins) and returns the actual amount wagered.

## Hand evaluation

`HandEvaluator` needs two things: anything satisfying the `ObserverLike` interface (`getCardsInTable()`, `getCardsInDeck()`, `getGamePhase()` — `GameObserver` implements it) and an **`EvaluatorConfig`**:

```ts
interface EvaluatorConfig {
  pattern: number[][];          // Pascal triangle: pattern[n][k-1] = C(n,k)
  minHandValues: number[][];    // ranking floors per player-count & hand category (bot tuning)
  maxHandValues: number[][];    // ranking ceilings per player-count & hand category
  subHandValues: number[][];    // high-card weighting table (first part of ranking)
  secondPartValues: number[][]; // pair-kicker weighting table (second part of ranking)
}
```

- `pattern` powers exact combinatorics (how many ways a draw can complete). If omitted, the calculator falls back to its own computed binomials.
- The four ranking tables (`min/max/sub/secondPartValues`) are **bot-tuning data**, indexed `[playerAmount][handCategory]` and `[handCategory][cardValue-1]`. They map a made/projected hand onto a numeric strength scale; supply your own calibrated tables for `getRankings()` to produce meaningful numbers. Basic evaluation (`getBestHand`, `compareTwoHands`) does not depend on them beyond `subHandValues.length`.

Main API:

| Method | Returns |
|--------|---------|
| `getBestHand(revealedCards, ownCards)` | The highest-category `HandResult` found among all available cards, with kickers padded to 5 cards |
| `compareTwoHands(hand1, hand2)` | `HandWin.hand1 \| hand2 \| tie` using the community cards currently on the observer |
| `getBestCategory(hand)` | Numeric category (`PokerHand.Flush`, …) |
| `getHandPercentage(revealed, own, remainingCards)` | `PercentageHands`: per-category `ChanceResult`s plus which category is actually made (`handFound`) |
| `getAllPercentages(revealed, own, extraRemaining)` | Percentages for each future street given the current phase (e.g. flop → turn and river projections) |
| `getRankings(playerAmount, hand)` | `Rankings[]` (`ownRanking`, `otherRanking`, `otherHighRanking`) — projected strength vs. typical opponents, for bot decision-making |

Hand categories (ascending strength): High Card → One Pair → Two Pair → Three Of Kind → Straight → Flush → Full House → Four Of Kind → Straight Flush → Royal Flush (`PokerHand` enum).

## Probability analysis (the `Chance*` family)

Each category has a `Chance*` class implementing `check(revealedCards, ownCards, remainingCards, cardsInDeck) → ChanceResult`:

```ts
interface ChanceResult {
  total: number;                 // % chance of holding/making this category by the river
  foundHand: FoundHand | null;   // non-null if the category is *already made* (values + category)
  foundHandCards: CardData[];    // the concrete cards composing it
  projects: ChanceProject[];     // per-high-card projections: { card, perc, project[] } for bots
}
```

Exported classes: `ChanceHighestCard`, `ChancePair`, `ChanceTwoPair`, `ChanceThreeOfKind`, `ChanceStraight`, `ChanceFlush`, `ChanceFullHouse`, `ChanceFourOfKind`, `ChanceStraightFlush`, `ChanceRoyalFlush`. All take a shared `ProbabilityCalculator` instance.

`ProbabilityCalculator` exposes the raw combinatorics if you want them directly:

```ts
import { ProbabilityCalculator } from 'poker-engine';

const pc = new ProbabilityCalculator();
pc.getOuts([...table, ...hero], 14);                       // unseen Aces ("overcard outs")
pc.getOutsPercentage(outs, remainingCards, cardsInDeck, alreadyHave); // classic % math
pc.getColorCount(cards, CardColor.spades);                 // flush potential
pc.getSameKinds(cards);                                    // [count per value] → pairs/trips/quads
```

Example — "what are my odds of hitting the flush on the turn?" (9 outs, 1 card to come, 45 unseen):

```ts
const pct = pc.getOutsPercentage(9, 1, 45, 0); // ≈ 20%
```

## Player profiling / action memory

`recordAction()` increments per-phase counters (`fold/check/call/raise/bet/bluff/allIn/total`) in both `playersMemory` (current hand) and `totalMemory` (lifetime). Combined with helpers like `getAverageRaised()`, `getRaisedInGame(chair)` and `getAverageRaisedPlayer(id)`, this feeds aggression statistics that a bot can use alongside `getRankings()`.

## Full example: showdown

```ts
const observer = new GameObserver(2);
observer.changeTurnData(1, GamePhase.river, 0, 0, 20, 10, 1, 0, 0);
observer.cardsInTable.push(...boardRiver);          // 5 community cards

const ev = new HandEvaluator(observer, config);
const result = ev.compareTwoHands(player0.hand, player1.hand);
if (result === 0) awardTo(player0);
else if (result === 1) awardTo(player1);
else splitPot();
```

## Development

```bash
npm install
npm run build      # tsup → dist/ (CJS + ESM + .d.ts)
npm run dev        # watch mode
npx tsc --noEmit   # strict type-check (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
```

## Project layout

```
src/
  constants.ts                 enums, literal types, shared interfaces
  card.ts / deck.ts / pot.ts   game primitives
  player.ts                    player state
  observer.ts                  GameObserver: table state + event bus
  evaluator.ts                 HandEvaluator: best hand, compare, rankings
  chance/                      ProbabilityCalculator + Chance* per-category analyzers
  index.ts                     public API surface
```

## License

MIT
