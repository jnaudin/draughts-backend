import type { WebSocket } from "ws";

export type PlayerType = {
  name: string | undefined;
  webSocket: WebSocket;
};

export type GameType = {
  name: string;
  type: "draughts" | "py";
  game: DraughtsGameType | PyGameType;
};

export type DraughtsGameType = {
  player1?: WebSocket;
  player2?: WebSocket;
  turn: "black" | "white";
};

export type PyGameType = {
  players: WebSocket[];
  guesser?: WebSocket;
  hinter?: WebSocket;
  word: string;
  hints: string[];
  guesses: string[];
  number?: number;
};

export type WordType = {
  name: string;
  categories: string[];
};
