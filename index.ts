import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT) || 443;

const wss = new WebSocketServer({ port });

type GameType = {
  name: string;
  player1?: WebSocket;
  player2?: WebSocket;
  turn: "black" | "white";
};

type PyGameType = {
  name: string;
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
const pyGames: PyGameType[] = [];

const changeTurn = (game: GameType) => {
  game.turn = game.turn === "black" ? "white" : "black";
};

const changeTurnPy = (pyGame: PyGameType) => {
  pyGame.turn = pyGame.turn === "guess" ? "propose" : "guess";
};

const sendGames = (ws: WebSocket, type = "") => {
  ws.send(
    `${type ? `${type}-` : ""}games-${games.map(({ name }) => name).join(",")}`
  );
};

const setWord = (pyGame: PyGameType) => {
  if (pyGame.proposer && pyGame.guesser)
    pyGame.word = words[Math.floor(Math.random() * words.length)].name;
  pyGame.proposer.send(`py-word-${pyGame.word}`);
};

const sendToPlayers = (
  pyGame: PyGameType,
  message: string,
  excludePlayer?: WebSocket
) => {
  wss.clients.forEach((client) => {
    if (
      client != excludePlayer &&
      pyGame.players.includes(client) &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(message.toString());
    }
  });
};

wss.on("connection", (ws: WebSocket) => {
  console.log("connexion");
  sendGames(ws);
  sendGames(ws, "py");

  ws.on("message", (message) => {
    const [type, arg0, arg1] = message.toString().split("-");
    const game = games.find((game) => game.name === arg0) as GameType;

    switch (type) {
      case "create":
        games.push({ name: arg0, turn: "white" });
        wss.clients.forEach(
          (client) => client.readyState === WebSocket.OPEN && sendGames(client)
        );
        break;
      case "join":
        if (game.player1) {
          game.player2 = ws;
          ws.send("color-black");
          game.player1.send("message-La partie démarre !");
          game.player1.send("color-white");
        } else {
          game.player1 = ws;
          ws.send("message-En attente d'un adversaire");
        }
        ws.send(`game-${arg0}`);
        break;
      case "piece":
      case "box":
      case "color":
        //send back the message to opponent
        wss.clients.forEach((client) => {
          const game = games.find(
            ({ player1, player2 }) =>
              client != ws && (player1 === client || player2 === client)
          );

          if (game && client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
            changeTurn(game);
          }
        });
        break;
      case "py":
        const pyGame = pyGames.find((game) => game.name === arg0) as PyGameType;

        switch (arg0) {
          case "create":
            pyGames.push({
              name: arg1,
              turn: "propose",
              players: [],
              word: "",
            });
            wss.clients.forEach(
              (client) =>
                client.readyState === WebSocket.OPEN && sendGames(client, "py")
            );
            break;
          case "join":
            pyGame.players.push(ws);
            ws.send(`py-game-${arg1}`);
            break;
          case "joinguess":
            pyGame.guesser = ws;
            ws.send(`py-game-${arg1}`);
            break;
          case "joinpropose":
            pyGame.proposer = ws;
            ws.send(`py-game-${arg1}`);
            setWord(pyGame);
            break;
          case "number":
            //propage action to other players of this game
            sendToPlayers(pyGame, message.toString(), ws);
          case "propose":
          case "guess":
            changeTurnPy(pyGame);
            break;
          default:
            console.log(`Error, ${type}-${arg0} is incorrect`);
        }
      default:
        console.log(`Error, ${type} is incorrect`);
    }
  });
});
