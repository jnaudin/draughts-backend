import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import type {
  PlayerType,
  GameType,
  PyGameType,
  DraughtsGameType,
} from "./types";
import {
  changePlayerName,
  connectPlayer,
  getPlayer,
  sendAllGames,
  sendPlayers,
  sendToPlayers,
  setWord,
} from "./actions.js";

dotenv.config();

const port = Number(process.env.PORT) || 443;
const wss = new WebSocketServer({ port });
const connectedPlayers: PlayerType[] = [];
const games: GameType[] = [];

wss.on("connection", (ws: WebSocket) => {
  console.log("connexion");
  connectPlayer(connectedPlayers, ws);
  sendAllGames(games, ws);

  ws.on("message", (message) => {
    const [action, name, ...args] = message.toString().split("-");
    const game = games.find((game) => game.name === name) as GameType;
    const pyGame: PyGameType = game?.game as PyGameType;

    switch (action) {
      case "create":
        //create-name-type
        const type = args[0] as GameType["type"];
        games.push({
          name,
          type,
          game:
            type === "draughts"
              ? { turn: "white" }
              : {
                  players: [],
                  word: "",
                  hints: [],
                  guesses: [],
                },
        });
        wss.clients.forEach(
          (client) =>
            client.readyState === WebSocket.OPEN && sendAllGames(games, client)
        );
        break;
      case "join":
        //join-name
        if (game.type === "draughts") {
          const g: DraughtsGameType = game.game as DraughtsGameType;
          if (g.player1) {
            g.player2 = ws;
            ws.send("color-black");
            g.player1.send("message-La partie démarre !");
            g.player1.send("color-white");
          } else {
            g.player1 = ws;
            ws.send("message-En attente d'un adversaire");
          }
        } else {
          const g: PyGameType = game.game as PyGameType;
          g.players.push(ws);
          sendPlayers(connectedPlayers, wss, game);
        }
        ws.send(`game-${name}-${game.type}`);
        if (pyGame.guesser)
          ws.send(
            `guesser-${getPlayer(connectedPlayers, pyGame.guesser).name}`
          );
        if (pyGame.hinter)
          ws.send(`hinter-${getPlayer(connectedPlayers, pyGame.hinter).name}`);
        break;
      case "changename": // changename-playername
        changePlayerName(connectedPlayers, ws, name);
        break;
      // draughts specific
      case "piece": // piece-name-1-2
      case "box": // box-name-1-2
        // case "color": // color-name-black, does not exists !! or is it ??
        //send back the message to opponent
        sendToPlayers(wss, game, message.toString(), ws);
        break;
      //py specific
      case "joinguess":
        if (!pyGame.guesser && pyGame.hinter !== ws) {
          pyGame.guesser = ws;
          sendToPlayers(
            wss,
            game,
            `guesser-${getPlayer(connectedPlayers, ws).name}`
          );
        }
        break;
      case "joinhint":
        if (!pyGame.hinter && pyGame.guesser !== ws) {
          pyGame.hinter = ws;
          sendToPlayers(
            wss,
            game,
            `hinter-${getPlayer(connectedPlayers, ws).name}`
          );
        }
        setWord(pyGame);
        break;
      case "hint":
        pyGame.hints.push(args[0]);
        sendToPlayers(wss, game, `hints-${pyGame.hints.join(",")}`);
        break;
      case "guess":
        pyGame.guesses.push(args[0]);
        sendToPlayers(wss, game, `guesses-${pyGame.guesses.join(",")}`);
        break;
      case "number":
        pyGame.number = +args[0];
      case "side":
        sendToPlayers(wss, game, message.toString());
        break;
      case "found":
        if (args[0] === "OK" || (args[0] === "KO" && pyGame.hints.length === pyGame.number)) {
          sendToPlayers(wss, game, `word-${pyGame.word}`, ws);
          setTimeout(() => {
            sendToPlayers(wss, game, `reset`);
            pyGame.word = "";
            pyGame.hints = [];
            pyGame.guesses = [];
            pyGame.hinter = undefined;
            pyGame.guesser = undefined;
          }, 5000);
        }
        sendToPlayers(wss, game, message.toString());
        break;
      default:
        console.log(`Error, ${type} is incorrect`);
    }
  });
});
