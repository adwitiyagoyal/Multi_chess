const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let peer = null;
let players = { white: null, black: null }; // Define players object

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;
            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });
                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === 'b') {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q'
    };

    socket.emit("move", move);
}

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "\u2659", // White Pawn
        r: "\u2656", // White Rook
        n: "\u2658", // White Knight
        b: "\u2657", // White Bishop
        q: "\u2655", // White Queen
        k: "\u2654", // White King
        P: "\u265F", // Black Pawn
        R: "\u265C", // Black Rook
        N: "\u265E", // Black Knight
        B: "\u265D", // Black Bishop
        Q: "\u265B", // Black Queen
        K: "\u265A", // Black King
    };

    return unicodePieces[piece.type] || "";
};

// Initial board rendering and role assignment
socket.on("playerRole", (role) => {
    playerRole = role;
    renderBoard();
    setupWebRTC();
});

socket.on("spectatorRole", () => {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

// Update player information
socket.on("players", (playerData) => {
    players = playerData;
});

// WebRTC setup
const setupWebRTC = () => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localVideo.srcObject = stream;

            peer = new SimplePeer({
                initiator: playerRole === 'w', // White player initiates the connection
                trickle: false,
                stream: stream
            });

            peer.on('signal', signal => {
                socket.emit('signal', { signal: signal, target: playerRole === 'w' ? players.black : players.white });
            });

            peer.on('stream', stream => {
                remoteVideo.srcObject = stream;
            });

            peer.on('error', err => {
                console.error('Peer error:', err);
            });
        })
        .catch(err => console.error('Error accessing media devices.', err));
};

socket.on('signal', data => {
    if (peer) {
        peer.signal(data.signal);
    }
});

renderBoard();
