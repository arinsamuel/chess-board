"use client";

import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";

// ♟️ Stylish Unique Neo Chess Pieces
const PIECE_IMAGES = {
  w: {
    p: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/wp.png",
    r: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/wr.png",
    n: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/wn.png",
    b: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/wb.png",
    q: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/wq.png",
    k: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/wk.png",
  },
  b: {
    p: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/bp.png",
    r: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/br.png",
    n: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/bn.png",
    b: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/bb.png",
    q: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/bq.png",
    k: "https://images.chesscomfiles.com/chess-themes/pieces/3d_staunton/150/bk.png",
  },
};

// Standard Chess Piece Values for Material Evaluation
const MATERIAL_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Bot Search Piece Values
const PIECE_VALUES = { p: 10, r: 50, n: 30, b: 35, q: 90, k: 900 };

function evaluateBoard(board) {
  let totalEvaluation = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = PIECE_VALUES[piece.type] || 0;
        totalEvaluation += piece.color === "w" ? val : -val;
      }
    }
  }
  return totalEvaluation;
}

function minimax(gameInstance, depth, alpha, beta, isMaximizing) {
  if (depth === 0 || gameInstance.isGameOver()) {
    return evaluateBoard(gameInstance.board());
  }

  const moves = gameInstance.moves({ verbose: true });
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      gameInstance.move(move);
      const evalVal = minimax(gameInstance, depth - 1, alpha, beta, false);
      gameInstance.undo();
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      gameInstance.move(move);
      const evalVal = minimax(gameInstance, depth - 1, alpha, beta, true);
      gameInstance.undo();
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, evalVal);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export default function ChessBoard() {
  const [game, setGame] = useState(() => new Chess());
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);

  // 🎮 GAME SETUP & MODAL STATES
  const [showModal, setShowModal] = useState(true);
  const [modalStep, setModalStep] = useState(1);
  const [gameMode, setGameMode] = useState("vs-friend");
  const [playerColor, setPlayerColor] = useState("w");
  const [botLevel, setBotLevel] = useState("martin");

  // 👑 PROMOTION STATE
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const gameIdRef = useRef(null);
  const pendingSaveRef = useRef(Promise.resolve());

  useEffect(() => {
    async function fetchSavedGame() {
      try {
        const res = await fetch("/api/game");
        const data = await res.json();
        if (data.success && data.game) {
          const loadedGame = new Chess();
          const savedHistory = data.game.history || [];

          for (const move of savedHistory) {
            loadedGame.move(move);
          }

          setGame(loadedGame);
          setHistory(savedHistory);
          gameIdRef.current = data.game._id;
        }
      } catch (err) {
        console.error("Failed to load game:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSavedGame();
  }, []);

  // 🤖 BOT TRIGGER EFFECT
  useEffect(() => {
    if (showModal || pendingPromotion) return;

    if (gameMode === "vs-computer" && !game.isGameOver()) {
      const currentTurn = game.turn();
      const isBotTurn = currentTurn !== playerColor;

      if (isBotTurn) {
        const timer = setTimeout(() => {
          makeBotMove();
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [game, gameMode, playerColor, showModal, pendingPromotion]);

  // 🎯 CAPTURED PIECES & MATERIAL ADVANTAGE CALCULATION
  const getCapturedPiecesAndMaterial = () => {
    const initialCounts = {
      w: { p: 8, r: 2, n: 2, b: 2, q: 1 },
      b: { p: 8, r: 2, n: 2, b: 2, q: 1 },
    };

    const currentCounts = {
      w: { p: 0, r: 0, n: 0, b: 0, q: 0 },
      b: { p: 0, r: 0, n: 0, b: 0, q: 0 },
    };

    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== "k") {
          currentCounts[piece.color][piece.type]++;
        }
      }
    }

    // Pieces that White has captured (lost Black pieces)
    const whiteCaptured = [];
    // Pieces that Black has captured (lost White pieces)
    const blackCaptured = [];

    let whiteMaterial = 0;
    let blackMaterial = 0;

    const pieceTypes = ["q", "r", "b", "n", "p"];

    pieceTypes.forEach((type) => {
      // Missing black pieces = captured by White
      const capturedBlackCount = initialCounts.b[type] - currentCounts.b[type];
      for (let i = 0; i < capturedBlackCount; i++) {
        whiteCaptured.push(type);
      }

      // Missing white pieces = captured by Black
      const capturedWhiteCount = initialCounts.w[type] - currentCounts.w[type];
      for (let i = 0; i < capturedWhiteCount; i++) {
        blackCaptured.push(type);
      }

      whiteMaterial += currentCounts.w[type] * MATERIAL_VALUES[type];
      blackMaterial += currentCounts.b[type] * MATERIAL_VALUES[type];
    });

    const diff = whiteMaterial - blackMaterial;

    return {
      whiteCaptured,
      blackCaptured,
      whiteAdvantage: diff > 0 ? diff : 0,
      blackAdvantage: diff < 0 ? Math.abs(diff) : 0,
    };
  };

  const { whiteCaptured, blackCaptured, whiteAdvantage, blackAdvantage } =
    getCapturedPiecesAndMaterial();

  // 🤖 SMART BOT AI ENGINE
  function makeBotMove() {
    const possibleBotMoves = game.moves({ verbose: true });
    if (possibleBotMoves.length === 0) return;

    let selectedMove = null;

    if (botLevel === "martin") {
      selectedMove =
        possibleBotMoves[Math.floor(Math.random() * possibleBotMoves.length)];
    } else {
      const depth = botLevel === "sven" ? 2 : 3;
      const isMaximizing = game.turn() === "w";
      let bestEval = isMaximizing ? -Infinity : Infinity;

      const gameCopy = new Chess(game.fen());

      for (const move of possibleBotMoves) {
        gameCopy.move(move);
        const evaluation = minimax(
          gameCopy,
          depth - 1,
          -Infinity,
          Infinity,
          !isMaximizing
        );
        gameCopy.undo();

        if (isMaximizing) {
          if (evaluation > bestEval) {
            bestEval = evaluation;
            selectedMove = move;
          }
        } else {
          if (evaluation < bestEval) {
            bestEval = evaluation;
            selectedMove = move;
          }
        }
      }

      if (!selectedMove) {
        selectedMove =
          possibleBotMoves[Math.floor(Math.random() * possibleBotMoves.length)];
      }
    }

    const gameCopy = new Chess();
    for (const m of history) {
      gameCopy.move(m);
    }

    const move = gameCopy.move({
      from: selectedMove.from,
      to: selectedMove.to,
      promotion: "q",
    });

    if (move) {
      const newHistory = [...history, move.san];
      setGame(gameCopy);
      setHistory(newHistory);
      setSelectedSquare(null);
      setPossibleMoves([]);

      saveGameToBackend(
        gameCopy.fen(),
        newHistory,
        gameCopy.isGameOver(),
        gameCopy.turn(),
        gameCopy.inCheck(),
        gameCopy.isCheckmate()
      );
    }
  }

  const saveGameToBackend = (
    fen,
    updatedHistory,
    isGameOver,
    turn,
    inCheck,
    inCheckmate
  ) => {
    let winner = null;
    if (inCheckmate) {
      winner = turn === "w" ? "Black" : "White";
    }

    pendingSaveRef.current = pendingSaveRef.current.then(async () => {
      try {
        const bodyPayload = {
          gameId: gameIdRef.current,
          fen,
          history: updatedHistory,
          isGameOver,
          winner,
        };

        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();
        if (data.success && data.game) {
          gameIdRef.current = data.game._id;
        }
      } catch (err) {
        console.error("Backend API fetch error:", err);
      }
    });
  };

  function highlightPossibleMoves(square) {
    const moves = game.moves({ square: square, verbose: true });
    const targetSquares = moves.map((m) => m.to);
    setPossibleMoves(targetSquares);
  }

  function isPromotionMove(source, target) {
    const piece = game.get(source);
    if (!piece || piece.type !== "p") return false;
    if (piece.color === "w" && target.endsWith("8")) return true;
    if (piece.color === "b" && target.endsWith("1")) return true;
    return false;
  }

  function handleMove(sourceSquare, targetSquare, promotionPiece = "q") {
    try {
      const gameCopy = new Chess();
      for (const m of history) {
        gameCopy.move(m);
      }

      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotionPiece,
      });

      if (move === null) return false;

      const newHistory = [...history, move.san];

      setGame(gameCopy);
      setHistory(newHistory);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setPendingPromotion(null);

      saveGameToBackend(
        gameCopy.fen(),
        newHistory,
        gameCopy.isGameOver(),
        gameCopy.turn(),
        gameCopy.inCheck(),
        gameCopy.isCheckmate()
      );

      return true;
    } catch (error) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      setPendingPromotion(null);
      return false;
    }
  }

  function executePromotion(promotionPiece) {
    if (!pendingPromotion) return;
    handleMove(pendingPromotion.from, pendingPromotion.to, promotionPiece);
  }

  function undoMove() {
    if (history.length === 0) return;

    const undoCount =
      gameMode === "vs-computer" && history.length >= 2 ? 2 : 1;
    const newHistory = history.slice(0, -undoCount);
    const newGame = new Chess();

    for (const move of newHistory) {
      newGame.move(move);
    }

    setGame(newGame);
    setHistory(newHistory);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setPendingPromotion(null);

    saveGameToBackend(
      newGame.fen(),
      newHistory,
      newGame.isGameOver(),
      newGame.turn(),
      newGame.inCheck(),
      newGame.isCheckmate()
    );
  }

  function handleSquareClick(square) {
    if (game.isGameOver() || pendingPromotion) return;
    if (gameMode === "vs-computer" && game.turn() !== playerColor) return;

    const piece = game.get(square);

    if (piece && piece.color === game.turn()) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else {
        setSelectedSquare(square);
        highlightPossibleMoves(square);
      }
      return;
    }

    if (selectedSquare) {
      if (isPromotionMove(selectedSquare, square)) {
        setPendingPromotion({
          from: selectedSquare,
          to: square,
          color: game.turn(),
        });
      } else {
        const moved = handleMove(selectedSquare, square);
        if (!moved) {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    }
  }

  function onDragStart(e, square) {
    if (game.isGameOver() || pendingPromotion) return;
    if (gameMode === "vs-computer" && game.turn() !== playerColor) return;

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      highlightPossibleMoves(square);
      e.dataTransfer.setData("text/plain", square);
    }
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  function onDrop(e, targetSquare) {
    e.preventDefault();
    if (game.isGameOver() || pendingPromotion) return;
    if (gameMode === "vs-computer" && game.turn() !== playerColor) return;

    const sourceSquare = e.dataTransfer.getData("text/plain");
    if (sourceSquare) {
      if (isPromotionMove(sourceSquare, targetSquare)) {
        setPendingPromotion({
          from: sourceSquare,
          to: targetSquare,
          color: game.turn(),
        });
      } else {
        handleMove(sourceSquare, targetSquare);
      }
    }
  }

  function resetGame() {
    const newGame = new Chess();
    setGame(newGame);
    setHistory([]);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setPendingPromotion(null);

    saveGameToBackend(newGame.fen(), [], false, "w", false, false);
  }

  function startNewGame(mode, color = "w", bot = "martin") {
    setGameMode(mode);
    setPlayerColor(color);
    setBotLevel(bot);
    setShowModal(false);
    resetGame();
  }

  const renderHistory = () => {
    const pairs = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        moveNum: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1] || "",
      });
    }
    return pairs;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full bg-slate-950">
        <div className="text-pink-400 font-semibold animate-pulse text-lg tracking-wide">
          Loading Custom Chess Board...
        </div>
      </div>
    );
  }

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const inCheck = game.inCheck() && !game.isGameOver();
  const isCheckmate = game.isCheckmate();
  const currentTurn = game.turn();

  const boardRows =
    playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const boardCols =
    playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const fullBoard = game.board();

  // TOP & BOTTOM PLAYER DISPLAY SETUP BASED ON FLIPPED BOARD
  const topPlayer = playerColor === "w" ? "b" : "w";
  const bottomPlayer = playerColor === "w" ? "w" : "b";

  // Player Component Helper
  const PlayerInfoCard = ({ color }) => {
    const isWhite = color === "w";
    const name = isWhite
      ? gameMode === "vs-computer" && playerColor === "b"
        ? `Bot (${botLevel.toUpperCase()})`
        : "White Player"
      : gameMode === "vs-computer" && playerColor === "w"
      ? `Bot (${botLevel.toUpperCase()})`
      : "Black Player";

    const captured = isWhite ? whiteCaptured : blackCaptured;
    const advantage = isWhite ? whiteAdvantage : blackAdvantage;
    const opponentColor = isWhite ? "b" : "w";

    return (
      <div className="w-full max-w-[480px] flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isWhite
                ? "bg-white shadow-[0_0_8px_#ffffff]"
                : "bg-purple-900 border border-pink-500"
            }`}
          />
          <span className="font-bold text-sm text-slate-200">{name}</span>

          {/* 📈 MATERIAL ADVANTAGE INDICATOR */}
          {advantage > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black px-2 py-0.5 rounded-md">
              +{advantage}
            </span>
          )}
        </div>

        {/* ♟️ CAPTURED PIECES ICON BAR */}
        <div className="flex items-center gap-0.5 max-w-[200px] overflow-x-auto scrollbar-none">
          {captured.map((pieceType, idx) => (
            <img
              key={idx}
              src={PIECE_IMAGES[opponentColor][pieceType]}
              alt={pieceType}
              className="w-5 h-5 object-contain filter drop-shadow opacity-90 hover:opacity-100 transition-opacity"
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-5xl px-4 py-8 bg-slate-950 min-h-screen text-slate-100 relative">
      {/* 👑 PAWN PROMOTION SELECTION MODAL */}
      {pendingPromotion && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_0_50px_rgba(236,72,153,0.5)] flex flex-col items-center gap-5 animate-in zoom-in duration-150">
            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500">
              Promote Pawn
            </h3>
            <p className="text-xs text-slate-300">
              Choose a piece to replace your pawn:
            </p>

            <div className="grid grid-cols-4 gap-3 w-full">
              {[
                { type: "q", label: "Queen" },
                { type: "r", label: "Rook" },
                { type: "b", label: "Bishop" },
                { type: "n", label: "Knight" },
              ].map((p) => (
                <button
                  key={p.type}
                  onClick={() => executePromotion(p.type)}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-800 hover:bg-pink-900/60 border border-pink-500/40 hover:border-pink-500 rounded-2xl transition-all duration-200 active:scale-90 group"
                >
                  <img
                    src={PIECE_IMAGES[pendingPromotion.color][p.type]}
                    alt={p.label}
                    className="w-12 h-12 object-contain group-hover:scale-110 transition-transform"
                  />
                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-pink-300 mt-1">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🛑 CHESS.COM STYLE GAME START MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(236,72,153,0.4)] flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500">
              Pro Chess Arena
            </h2>

            {modalStep === 1 ? (
              <div className="w-full flex flex-col gap-4">
                <p className="text-slate-300 font-medium text-sm">
                  Select How You Want to Play:
                </p>
                <button
                  onClick={() => startNewGame("vs-friend")}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-pink-500/30 text-white font-bold rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-3 text-base"
                >
                  <span className="text-2xl">👥</span> Play a Friend
                </button>
                <button
                  onClick={() => setModalStep(2)}
                  className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(236,72,153,0.4)] active:scale-95 flex items-center justify-center gap-3 text-base"
                >
                  <span className="text-2xl">🤖</span> Play Bot
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-4">
                <p className="text-slate-300 font-medium text-sm">
                  Choose Your Bot Opponent:
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() =>
                      startNewGame("vs-computer", playerColor, "martin")
                    }
                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-emerald-500/50 rounded-xl text-left flex items-center gap-3 transition-all"
                  >
                    <span className="text-2xl">🟢</span>
                    <div>
                      <div className="font-bold text-white text-sm">
                        Martin (Easy)
                      </div>
                      <div className="text-xs text-slate-400">
                        Makes beginner moves & mistakes.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      startNewGame("vs-computer", playerColor, "sven")
                    }
                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-yellow-500/50 rounded-xl text-left flex items-center gap-3 transition-all"
                  >
                    <span className="text-2xl">🟡</span>
                    <div>
                      <div className="font-bold text-white text-sm">
                        Sven (Intermediate)
                      </div>
                      <div className="text-xs text-slate-400">
                        Plays smart tactics & protects pieces.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      startNewGame("vs-computer", playerColor, "nelson")
                    }
                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-rose-500/50 rounded-xl text-left flex items-center gap-3 transition-all"
                  >
                    <span className="text-2xl">🔴</span>
                    <div>
                      <div className="font-bold text-white text-sm">
                        Nelson (Hard)
                      </div>
                      <div className="text-xs text-slate-400">
                        Calculates deep moves & plays aggressive.
                      </div>
                    </div>
                  </button>
                </div>

                {/* Side Selection */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">
                    Play As:
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPlayerColor("w")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        playerColor === "w"
                          ? "bg-white text-black"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      ⚪ White
                    </button>
                    <button
                      onClick={() => setPlayerColor("b")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        playerColor === "b"
                          ? "bg-purple-900 text-pink-300 border border-pink-500"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      ⚫ Black
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setModalStep(1)}
                  className="mt-1 text-xs text-slate-400 underline hover:text-white"
                >
                  ⬅ Back to Mode Selection
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎮 TOP BAR: Current Mode Indicator */}
      <div className="w-full max-w-md bg-slate-900 border border-pink-500/30 rounded-2xl p-3.5 mb-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-pink-300">Mode:</span>
          <span className="text-xs font-extrabold bg-pink-950/80 text-pink-400 border border-pink-500/40 px-2.5 py-1 rounded-lg uppercase">
            {gameMode === "vs-friend"
              ? "👥 vs Friend"
              : `🤖 Bot: ${botLevel}`}
          </span>
        </div>
        <button
          onClick={() => {
            setModalStep(1);
            setShowModal(true);
          }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-pink-300 border border-pink-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
        >
          ⚙️ Change Mode
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 w-full">
        {/* 🏆 CHECKMATE OVERLAY */}
        {isCheckmate && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(236,72,153,0.5)] flex flex-col items-center gap-4">
              <div className="text-6xl animate-bounce">👑</div>
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500">
                CHECKMATE!
              </h2>
              <p className="text-slate-300 text-lg font-medium">
                {currentTurn === "w" ? "Black" : "White"} Wins the Game! 🎉
              </p>
              <button
                onClick={resetGame}
                className="mt-2 w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(225,29,72,0.5)] active:scale-95 cursor-pointer"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Left Section: Board, Players & Status */}
        <div className="flex flex-col items-center gap-4">
          {/* TURN BANNER */}
          <div
            className={`w-full flex justify-between items-center px-6 py-3 rounded-2xl transition-all duration-300 backdrop-blur-md border ${
              inCheck
                ? "border-red-500 bg-red-950/40 shadow-[0_0_25px_rgba(239,68,68,0.5)]"
                : currentTurn === "w"
                ? "border-pink-300/60 bg-slate-900/90 shadow-[0_0_20px_rgba(244,114,182,0.25)]"
                : "border-purple-600/80 bg-purple-950/40 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                  currentTurn === "w"
                    ? "bg-slate-100 text-slate-950 shadow-[0_0_15px_#ffffff]"
                    : "bg-purple-900 text-pink-300 border border-pink-500/50 shadow-[0_0_15px_#a855f7]"
                }`}
              >
                {currentTurn === "w" ? "⚪ WHITE" : "⚫ BLACK"}
              </span>

              <span className="font-extrabold text-lg tracking-wide text-slate-100">
                {game.isGameOver()
                  ? "Game Over"
                  : gameMode === "vs-computer" && currentTurn !== playerColor
                  ? "Bot Thinking..."
                  : "Turn"}
              </span>
            </div>

            {inCheck && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/80 text-xs px-3.5 py-1 rounded-full font-extrabold animate-pulse tracking-wider">
                🚨 CHECK!
              </span>
            )}
            {isCheckmate && (
              <span className="bg-rose-600/30 text-rose-300 border border-rose-500 text-xs px-3 py-1 rounded-full font-extrabold tracking-wider">
                CHECKMATE
              </span>
            )}
          </div>

          {/* 👤 TOP PLAYER INFO (Opponent) */}
          <PlayerInfoCard color={topPlayer} />

          {/* 🎀 Pink Chessboard */}
          <div
            className={`w-[420px] sm:w-[480px] max-w-[90vw] aspect-square rounded-3xl overflow-hidden p-2 bg-slate-900 border-4 transition-all duration-300 ${
              inCheck
                ? "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.6)] animate-pulse"
                : "border-pink-500/40 shadow-[0_10px_40px_rgba(236,72,153,0.3)]"
            }`}
          >
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-2xl overflow-hidden border border-pink-900">
              {boardRows.map((rowIndex) =>
                boardCols.map((colIndex) => {
                  const square = fullBoard[rowIndex][colIndex];
                  const squareName = `${files[colIndex]}${8 - rowIndex}`;
                  const isDark = (rowIndex + colIndex) % 2 === 1;
                  const isSelected = selectedSquare === squareName;
                  const isPossibleMove = possibleMoves.includes(squareName);
                  const isKingInCheck =
                    inCheck &&
                    square?.type === "k" &&
                    square?.color === currentTurn;

                  return (
                    <div
                      key={squareName}
                      onClick={() => handleSquareClick(squareName)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, squareName)}
                      className={`relative flex items-center justify-center select-none cursor-pointer transition-colors duration-150 ${
                        isKingInCheck
                          ? "bg-red-600/80 animate-pulse"
                          : isDark
                          ? "bg-[#9d174d]"
                          : "bg-[#fbcfe8]"
                      } ${
                        isSelected
                          ? "ring-4 ring-yellow-400 ring-inset z-10 bg-pink-400/50"
                          : ""
                      }`}
                    >
                      {(playerColor === "w"
                        ? colIndex === 0
                        : colIndex === 7) && (
                        <span
                          className={`absolute top-0.5 left-1 text-[10px] font-extrabold ${
                            isDark ? "text-pink-200/70" : "text-pink-950/70"
                          }`}
                        >
                          {8 - rowIndex}
                        </span>
                      )}
                      {(playerColor === "w"
                        ? rowIndex === 7
                        : rowIndex === 0) && (
                        <span
                          className={`absolute bottom-0.5 right-1 text-[10px] font-extrabold ${
                            isDark ? "text-pink-200/70" : "text-pink-950/70"
                          }`}
                        >
                          {files[colIndex]}
                        </span>
                      )}

                      {isPossibleMove && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                          {square ? (
                            <div className="w-full h-full border-4 border-yellow-300/80 rounded-full animate-pulse bg-yellow-400/20" />
                          ) : (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-yellow-300 rounded-full shadow-[0_0_12px_#fde047] opacity-90" />
                          )}
                        </div>
                      )}

                      {square && (
                        <img
                          src={PIECE_IMAGES[square.color][square.type]}
                          alt={`${square.color}${square.type}`}
                          draggable={
                            square.color === currentTurn &&
                            !game.isGameOver() &&
                            (gameMode === "vs-friend" ||
                              currentTurn === playerColor)
                          }
                          onDragStart={(e) => onDragStart(e, squareName)}
                          className={`w-[85%] h-[85%] object-contain transform transition-all duration-200 hover:scale-115 active:scale-125 z-10 ${
                            square.color === "w"
                              ? "filter drop-shadow-[0_4px_8px_rgba(255,255,255,0.75)] brightness-110"
                              : "filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] brightness-90"
                          }`}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 👤 BOTTOM PLAYER INFO (Self) */}
          <PlayerInfoCard color={bottomPlayer} />

          {/* Action Buttons */}
          <div className="flex gap-3 w-full max-w-[480px] mt-1">
            <button
              onClick={undoMove}
              disabled={history.length === 0}
              className={`flex-1 py-3.5 font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 text-sm tracking-wide ${
                history.length === 0
                  ? "bg-slate-800/50 text-slate-600 border border-slate-800 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800 text-pink-400 border border-pink-500/40 shadow-[0_4px_15px_rgba(236,72,153,0.15)] active:scale-95 cursor-pointer"
              }`}
            >
              <span>↩️</span> Undo Move
            </button>

            <button
              onClick={resetGame}
              className="flex-1 py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-[0_4px_20px_rgba(225,29,72,0.4)] active:scale-95 cursor-pointer text-sm tracking-wide"
            >
              Reset Game
            </button>
          </div>
        </div>

        {/* Move History */}
        <div className="w-full lg:w-80 h-[580px] bg-slate-900/80 border border-pink-500/30 rounded-3xl p-5 flex flex-col shadow-xl backdrop-blur-md">
          <h2 className="text-pink-300 font-bold text-lg mb-4 pb-2 border-b border-pink-500/20 flex justify-between items-center">
            <span>Move History</span>
            <span className="text-xs bg-pink-950/60 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono">
              {history.length} moves
            </span>
          </h2>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {renderHistory().length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                No moves played yet
              </div>
            ) : (
              renderHistory().map((item) => (
                <div
                  key={item.moveNum}
                  className="flex items-center text-sm py-2 px-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-pink-500/30 transition-all duration-150"
                >
                  <span className="w-10 text-pink-400/70 font-mono text-xs font-semibold">
                    {item.moveNum}.
                  </span>
                  <span className="flex-1 text-slate-200 font-medium font-mono">
                    {item.white}
                  </span>
                  <span className="flex-1 text-slate-400 font-medium font-mono">
                    {item.black}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}