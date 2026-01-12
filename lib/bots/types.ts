export type BotStyle =
  | "Cautious"
  | "Random"
  | "Defensive"
  | "Balanced"
  | "Aggressive"
  | "Tactical"
  | "Positional"
  | "Strategic"
  | "Precise"
  | "Perfect";

export interface BotProfile {
  botId: string;
  name: string;
  rank: number; // 0-1000
  avatar: string;
  style: BotStyle;
  bio: string;
  funFact: string;
  favoriteOpening?: string;
}

