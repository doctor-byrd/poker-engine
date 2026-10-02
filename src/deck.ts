import { Card } from './card.js';
import { CardData } from './constants.js';

/**
 * Standard 52-card deck with Fisher-Yates shuffle.
 */
export class Deck {
  cards: Card[] = [];
  position = 0; // index of next card to draw

  constructor() {
    this.reset();
  }

  /** Build a fresh sorted deck (2-A, spades/hearts/diamonds/clubs). */
  reset(): void {
    this.cards = [];
    for (let value = 2; value <= 14; value++) {
      for (let color = 0; color < 4; color++) {
        this.cards.push(new Card(value, color));
      }
    }
    this.position = 0;
  }

  /** Fisher-Yates shuffle. */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = this.cards[i]!;
      const b = this.cards[j]!;
      this.cards[i] = b;
      this.cards[j] = a;
    }
    this.position = 0;
  }

  /** Draw `count` cards from the top. */
  draw(count = 1): Card[] {
    if (this.position + count > this.cards.length) {
      throw new Error('Not enough cards in deck');
    }
    const drawn = this.cards.slice(this.position, this.position + count);
    this.position += count;
    return drawn;
  }

  /** Number of cards remaining. */
  remaining(): number {
    return this.cards.length - this.position;
  }

  /** For debugging / fixed deck (e.g., tutorial). */
  setFixedDeck(cards: (Card | CardData)[]): void {
    this.cards = cards.map((c) => (c instanceof Card ? c : Card.from(c)));
    this.position = 0;
  }
}