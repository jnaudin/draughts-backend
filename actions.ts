import type { WebSocketServer } from "ws";
import WebSocket from "ws";
import { cook, food, words } from "./data.js";
import type {
  DraughtsGameType,
  GameType,
  PlayerType,
  PyGameType,
} from "./types";

export const connectPlayer = (
  connectedPlayers: PlayerType[],
  ws: WebSocket
) => {
  const name = `${food[Math.floor(Math.random() * food.length)]} ${
    cook[Math.floor(Math.random() * cook.length)]
  }`;
  ws.send(`changename-${name}`);
  connectedPlayers.push({ webSocket: ws, name });
};

// export const changeTurn = (g: GameType) =>
//   ({ black: "white", white: "black", guess: "hint", hint: "guess" }[
//     g.game.turn
//   ]);

export const sendGames = (
  games: GameType[],
  ws: WebSocket,
  type: GameType["type"]
) => {
  ws.send(
    `games-${type}-${games
      .filter(({ type: t }) => t === type)
      .map(({ name }) => name)
      .join(",")}`
  );
};

export const changePlayerName = (
  connectedPlayers: PlayerType[],
  ws: WebSocket,
  name: string
) => (connectedPlayers.find(({ webSocket }) => webSocket === ws).name = name);

export const getPlayer = (
  connectedPlayers: PlayerType[],
  player: WebSocket | string
) =>
  typeof player === "string"
    ? connectedPlayers.find(({ name }) => name === player)
    : connectedPlayers.find(({ webSocket }) => webSocket === player);

export const sendAllGames = (games: GameType[], ws: WebSocket) => {
  sendGames(games, ws, "draughts");
  sendGames(games, ws, "py");
};

export const setWord = (pyGame: PyGameType) => {
  pyGame.word = words[Math.floor(Math.random() * words.length)].name;
  pyGame.hinter?.send(`word-${pyGame.word}`);
};

export const sendToPlayers = (
  wss: WebSocketServer,
  game: GameType,
  message: string,
  excludePlayer?: WebSocket
) => {
  const players =
    game.type === "py"
      ? (game.game as PyGameType).players
      : [
          (game.game as DraughtsGameType).player1,
          (game.game as DraughtsGameType).player2,
        ];
  wss.clients.forEach((client) => {
    if (
      client != excludePlayer &&
      players.includes(client) &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(message.toString());
    }
  });
};

export const sendPlayers = (
  connectedPlayers: PlayerType[],
  wss: WebSocketServer,
  game: GameType
) => {
  const pyGame = game.game as PyGameType;
  const players = pyGame.players
    .map((p) => getPlayer(connectedPlayers, p).name)
    .join(",");
  sendToPlayers(wss, game, `players-${players}`);
};
