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

const games: GameType[] = [];

const changeTurn = (game: GameType) => {
  game.turn = game.turn === "black" ? "white" : "black";
};

const sendGames = (ws: WebSocket) => {
  ws.send(`games-${games.map(({ name }) => name).join(",")}`);
};

wss.on("connection", (ws: WebSocket) => {
  console.log("connexion")
  sendGames(ws);

  ws.on("message", (message) => {
    const [type, arg0] = message.toString().split("-");
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
      default:
        console.log(`Error, ${type} is incorrect`);
    }
  });
});
