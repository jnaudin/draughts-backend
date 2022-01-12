import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT) || 443;

const wss = new WebSocketServer({ port });

type GameType = {
  name: string;
  type: "draughts" | "py";
  game: DraughtsGameType | PyGameType;
};

type DraughtsGameType = {
  player1?: WebSocket;
  player2?: WebSocket;
  turn: "black" | "white";
};

type PyGameType = {
  players: WebSocket[];
  guesser?: WebSocket;
  proposer?: WebSocket;
  turn: "guess" | "propose";
  word: string;
};

type WordType = {
  name: string;
  categories: string[];
};

const words: WordType[] = [
  { name: "patate", categories: ["végétal", "violence"] },
  { name: "poire", categories: ["végétal", "violence"] },
  { name: "bateau", categories: ["transport"] },
  { name: "fourgonnette", categories: ["transport"] },
  { name: "étoile", categories: ["espace"] },
];

const games: GameType[] = [];

const changeTurn = (g: GameType) =>
  ({ black: "white", white: "black", guess: "propose", propose: "guess" }[
    g.game.turn
  ]);

const sendGames = (ws: WebSocket, type: GameType["type"]) => {
  ws.send(
    `games-${type}-${games
      .filter(({ type: t }) => t === type)
      .map(({ name }) => name)
      .join(",")}`
  );
};

const sendAllGames = (ws: WebSocket) => {
  sendGames(ws, "draughts");
  sendGames(ws, "py");
};

const setWord = (pyGame: PyGameType) => {
  if (pyGame.proposer && pyGame.guesser)
    pyGame.word = words[Math.floor(Math.random() * words.length)].name;
  pyGame.proposer.send(`py-word-${pyGame.word}`);
};

const sendToPlayers = (
  game: GameType,
  message: string,
  excludePlayer?: WebSocket
) => {
  console.log("game", game);
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

wss.on("connection", (ws: WebSocket) => {
  console.log("connexion");
  sendAllGames(ws);

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
                  turn: "propose",
                  players: [],
                  word: "",
                },
        });
        wss.clients.forEach(
          (client) =>
            client.readyState === WebSocket.OPEN && sendAllGames(client)
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
        }
        ws.send(`game-${name}-${game.type}`);
        break;
      // draughts specific
      case "piece": // piece-name-1-2
      case "box": // box-name-1-2
        // case "color": // color-name-black, does not exists !! or is it ??
        //send back the message to opponent
        sendToPlayers(game, message.toString(), ws);
        break;
      //py specific
      case "joinguess":
        pyGame.guesser = ws;
        //todo send wh are guessers, proposers and choosing to all clients
        break;
      case "joinpropose":
        pyGame.proposer = ws;
        //todo send wh are guessers, proposers and choosing to all clients
        setWord(pyGame);
        break;
      case "propose":
      case "guess":
        changeTurn(game);
      case "number":
      case "side":
        //propage action to other players of this game
        sendToPlayers(game, message.toString(), ws);
        break;
      default:
        console.log(`Error, ${type} is incorrect`);
    }
  });
});
