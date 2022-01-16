import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT) || 443;

const wss = new WebSocketServer({ port });

type PlayerType = {
  name: string | undefined;
  webSocket: WebSocket;
};

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
  hinter?: WebSocket;
  turn: "guess" | "hint";
  word: string;
};

type WordType = {
  name: string;
  categories: string[];
};

const food = [
  "Carotte",
  "Lasagne",
  "Patate",
  "Pomme",
  "Frite",
  "Saucisse",
  "Pomme de pain",
  "Noisette",
  "Noix",
  "Girafe",
  "Caille",
];

const cook = [
  "grillée",
  "au micro onde",
  "pannée",
  "frite",
  "brulée",
  "au barbeuk",
  "crue",
];

const words: WordType[] = [
  { name: "patate", categories: ["végétal", "violence"] },
  { name: "poire", categories: ["végétal", "violence"] },
  { name: "bateau", categories: ["transport"] },
  { name: "fourgonnette", categories: ["transport"] },
  { name: "étoile", categories: ["espace"] },
  { name: "planète", categories: ["espace"] },
];

const connectedPlayers: PlayerType[] = [];
const games: GameType[] = [];

const changeTurn = (g: GameType) =>
  ({ black: "white", white: "black", guess: "hint", hint: "guess" }[
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

const changePlayerName = (ws: WebSocket, name: string) =>
  (connectedPlayers.find(({ webSocket }) => webSocket === ws).name = name);

const getPlayer = (player: WebSocket | string) =>
  typeof player === "string"
    ? connectedPlayers.find(({ name }) => name === player)
    : connectedPlayers.find(({ webSocket }) => webSocket === player);

const connectPlayer = (ws: WebSocket) => {
  const name = `${food[Math.floor(Math.random() * food.length)]} ${
    cook[Math.floor(Math.random() * cook.length)]
  }`;
  ws.send(`changename-${name}`);
  connectedPlayers.push({ webSocket: ws, name });
};

const sendAllGames = (ws: WebSocket) => {
  sendGames(ws, "draughts");
  sendGames(ws, "py");
};

const setWord = (pyGame: PyGameType) => {
  if (pyGame.hinter && pyGame.guesser)
    pyGame.word = words[Math.floor(Math.random() * words.length)].name;
  console.log("pyGame.hinter", pyGame.hinter);
  pyGame.hinter?.send(`word-${pyGame.word}`);
};

const sendToPlayers = (
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

const sendPlayers = (game: GameType) => {
  const pyGame = game.game as PyGameType;
  const players = pyGame.players.map((p) => getPlayer(p).name).join(",");
  sendToPlayers(game, `players-${players}`);
};

wss.on("connection", (ws: WebSocket) => {
  console.log("connexion");
  connectPlayer(ws);
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
                  turn: "hint",
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
          sendPlayers(game);
        }
        ws.send(`game-${name}-${game.type}`);
        if (pyGame.guesser)
          ws.send(`guesser-${getPlayer(pyGame.guesser).name}`);
        if (pyGame.hinter) ws.send(`hinter-${getPlayer(pyGame.hinter).name}`);
        break;
      case "changename": // changename-playername
        changePlayerName(ws, name);
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
        if (!pyGame.guesser && pyGame.hinter !== ws) {
          pyGame.guesser = ws;
          sendToPlayers(game, `guesser-${getPlayer(ws).name}`);
        }
        //todo send wh are guessers, hinters and choosing to all clients
        break;
      case "joinhint":
        if (!pyGame.hinter && pyGame.guesser !== ws) {
          pyGame.hinter = ws;
          sendToPlayers(game, `hinter-${getPlayer(ws).name}`);
        }
        //todo send wh are guessers, hinters and choosing to all clients
        setWord(pyGame);
        break;
      case "hint":
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
