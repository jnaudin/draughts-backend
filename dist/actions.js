import WebSocket from "ws";
import { cook, food, words } from "./data.js";
export const connectPlayer = (connectedPlayers, ws) => {
    const name = `${food[Math.floor(Math.random() * food.length)]} ${cook[Math.floor(Math.random() * cook.length)]}`;
    ws.send(`changename-${name}`);
    connectedPlayers.push({ webSocket: ws, name });
};
// export const changeTurn = (g: GameType) =>
//   ({ black: "white", white: "black", guess: "hint", hint: "guess" }[
//     g.game.turn
//   ]);
export const sendGames = (games, ws, type) => {
    ws.send(`games-${type}-${games
        .filter(({ type: t }) => t === type)
        .map(({ name }) => name)
        .join(",")}`);
};
export const changePlayerName = (connectedPlayers, ws, name) => (connectedPlayers.find(({ webSocket }) => webSocket === ws).name = name);
export const getPlayer = (connectedPlayers, player) => typeof player === "string"
    ? connectedPlayers.find(({ name }) => name === player)
    : connectedPlayers.find(({ webSocket }) => webSocket === player);
export const sendAllGames = (games, ws) => {
    sendGames(games, ws, "draughts");
    sendGames(games, ws, "py");
};
export const setWord = (pyGame) => {
    pyGame.word = words[Math.floor(Math.random() * words.length)].name;
    pyGame.hinter?.send(`word-${pyGame.word}`);
};
export const sendToPlayers = (wss, game, message, excludePlayer) => {
    const players = game.type === "py"
        ? game.game.players
        : [
            game.game.player1,
            game.game.player2,
        ];
    wss.clients.forEach((client) => {
        if (client != excludePlayer &&
            players.includes(client) &&
            client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
        }
    });
};
export const sendPlayers = (connectedPlayers, wss, game) => {
    const pyGame = game.game;
    const players = pyGame.players
        .map((p) => getPlayer(connectedPlayers, p).name)
        .join(",");
    sendToPlayers(wss, game, `players-${players}`);
};
//# sourceMappingURL=actions.js.map