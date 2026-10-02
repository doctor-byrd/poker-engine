import { CardData } from './constants.js';

const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const VALUE_LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/**
 * A playing card. value: 2..14 (11=J,12=Q,13=K,14=A), color: 0=spades,1=heart,2=diamonds,3=clubs
 */
export class Card implements CardData {
  value: number;
  color: number;

  constructor(value: number, color: number) {
    this.value = value;
    this.color = color;
  }

  toString(): string {
    const val = this.value >= 11 ? VALUE_LABELS[this.value] : String(this.value);
    return `${val}${SUIT_SYMBOLS[this.color]}`;
  }

  /** Serializable plain object. */
  toJSON(): CardData {
    return { value: this.value, color: this.color };
  }

  static from(data: CardData): Card {
    return new Card(data.value, data.color);
  }
}