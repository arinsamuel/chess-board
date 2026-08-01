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

export default function ChessBoard() {
  const [game, setGame] = useState(() => new Chess());
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);

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

          // Replay moves to establish full internal state
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

  const saveGameToBackend = (fen, updatedHistory, isGameOver, turn, inCheck, inCheckmate) => {
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

  function handleMove(sourceSquare, targetSquare) {
    try {
      // Create new instance and replay history to keep state consistent
      const gameCopy = new Chess();
      for (const m of history) {
        gameCopy.move(m);
      }

      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) return false;

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

      return true;
    } catch (error) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return false;
    }
  }

  // 🔄 UNDO MOVE (১০০% কার্যকরী লজিক)
  function undoMove() {
    if (history.length === 0) return;

    const newHistory = history.slice(0, -1);
    const newGame = new Chess();

    for (const move of newHistory) {
      newGame.move(move);
    }

    setGame(newGame);
    setHistory(newHistory);
    setSelectedSquare(null);
    setPossibleMoves([]);

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
    if (game.isGameOver()) return;

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
      const moved = handleMove(selectedSquare, square);
      if (!moved) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  }

  function onDragStart(e, square) {
    if (game.isGameOver()) return;
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
    if (game.isGameOver()) return;
    const sourceSquare = e.dataTransfer.getData("text/plain");
    if (sourceSquare) {
      handleMove(sourceSquare, targetSquare);
    }
  }

  function resetGame() {
    const newGame = new Chess();
    setGame(newGame);
    setHistory([]);
    setSelectedSquare(null);
    setPossibleMoves([]);

    // Keep gameIdRef.current intact to update current document in DB instead of duplicating
    saveGameToBackend(newGame.fen(), [], false, "w", false, false);
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

  const board = game.board();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const inCheck = game.inCheck() && !game.isGameOver();
  const isCheckmate = game.isCheckmate();
  const currentTurn = game.turn();

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 w-full max-w-5xl px-4 py-8 bg-slate-950 min-h-screen text-slate-100 relative">
      
      {/* 🏆 CHECKMATE POPUP OVERLAY */}
      {isCheckmate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(236,72,153,0.5)] flex flex-col items-center gap-4">
            <div className="text-6xl animate-bounce">👑</div>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500 tracking-wider">
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

      {/* Left Section: Board & Status */}
      <div className="flex flex-col items-center gap-5">
        
        {/* 🌟 CLEAR TURN INDICATOR BANNER */}
        <div className={`w-full flex justify-between items-center px-6 py-3.5 rounded-2xl transition-all duration-300 backdrop-blur-md border ${
          inCheck 
            ? "border-red-500 bg-red-950/40 shadow-[0_0_25px_rgba(239,68,68,0.5)]" 
            : currentTurn === "w"
            ? "border-pink-300/60 bg-slate-900/90 shadow-[0_0_20px_rgba(244,114,182,0.25)]"
            : "border-purple-600/80 bg-purple-950/40 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
        }`}>
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
              {game.isGameOver() ? "Game Over" : "Turn"}
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

        {/* 🎀 Pink Chessboard */}
        <div className={`w-[420px] sm:w-[480px] max-w-[90vw] aspect-square rounded-3xl overflow-hidden p-2 bg-slate-900 border-4 transition-all duration-300 ${
          inCheck 
            ? "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.6)] animate-pulse" 
            : "border-pink-500/40 shadow-[0_10px_40px_rgba(236,72,153,0.3)]"
        }`}>
          <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-2xl overflow-hidden border border-pink-900">
            {board.map((row, rowIndex) =>
              row.map((square, colIndex) => {
                const squareName = `${files[colIndex]}${8 - rowIndex}`;
                const isDark = (rowIndex + colIndex) % 2 === 1;
                const isSelected = selectedSquare === squareName;
                const isPossibleMove = possibleMoves.includes(squareName);
                const isKingInCheck = inCheck && square?.type === "k" && square?.color === currentTurn;

                return (
                  <div
                    key={squareName}
                    onClick={() => handleSquareClick(squareName)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, squareName)}
                    className={`relative flex items-center justify-center select-none cursor-pointer transition-colors duration-150 ${
                      isKingInCheck
                        ? "bg-red-600/80 animate-pulse"
                        : isDark ? "bg-[#9d174d]" : "bg-[#fbcfe8]"
                    } ${isSelected ? "ring-4 ring-yellow-400 ring-inset z-10 bg-pink-400/50" : ""}`}
                  >
                    {colIndex === 0 && (
                      <span className={`absolute top-0.5 left-1 text-[10px] font-extrabold ${isDark ? "text-pink-200/70" : "text-pink-950/70"}`}>
                        {8 - rowIndex}
                      </span>
                    )}
                    {rowIndex === 7 && (
                      <span className={`absolute bottom-0.5 right-1 text-[10px] font-extrabold ${isDark ? "text-pink-200/70" : "text-pink-950/70"}`}>
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
                        draggable={square.color === currentTurn && !game.isGameOver()}
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

        {/* 🎮 Control Action Buttons (Undo & Reset) */}
        <div className="flex gap-3 w-full">
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

      {/* Right Section: Move History */}
      <div className="w-full lg:w-80 h-[520px] bg-slate-900/80 border border-pink-500/30 rounded-3xl p-5 flex flex-col shadow-xl backdrop-blur-md">
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
  );
}