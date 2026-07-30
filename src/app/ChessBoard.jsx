"use client";

import { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

export default function ChessBoard() {
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const gameIdRef = useRef(null);
  const pendingSaveRef = useRef(Promise.resolve());

  useEffect(() => {
    async function fetchSavedGame() {
      try {
        const res = await fetch("/api/game");
        const data = await res.json();
        if (data.success && data.game) {
          const loadedGame = new Chess(data.game.fen);
          setGame(loadedGame);
          setGameFen(data.game.fen);
          setHistory(data.game.history || []);
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

  // 2. Perform background database synchronization in a queue to prevent latency issues or duplicate games
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

        console.log("Backend API response status:", res.status);

        const data = await res.json();
        if (data.success && data.game) {
          gameIdRef.current = data.game._id;
        }
      } catch (err) {
        console.error("Backend API fetch error:", err);
      }
    });
  };

  // 💡 ড্রপ হ্যান্ডলার
  function onPieceDrop(sourceSquare, targetSquare) {
    console.log("1. Drop attempted from:", sourceSquare, "to:", targetSquare);
    const currentFen = game.fen();
    console.log("Current FEN before move:", currentFen);

    try {
      const gameCopy = new Chess(currentFen);
      
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      console.log("Move result:", move);

      if (move === null) {
        console.error("2. Move validation failed: Move returned null");
        return false;
      }

      const newFen = gameCopy.fen();
      const newHistory = [...history, move.san];

      console.log("3. Move successful! Updated FEN:", newFen);

      setGame(gameCopy);
      setGameFen(newFen);
      setHistory(newHistory);

      saveGameToBackend(
        newFen,
        newHistory,
        gameCopy.isGameOver(),
        gameCopy.turn(),
        gameCopy.inCheck(),
        gameCopy.isCheckmate()
      );

      return true;
    } catch (error) {
      console.error("2. Move validation failed:", error);
      return false;
    }
  }

  function resetGame() {
    const newGame = new Chess();
    setGame(newGame);
    setGameFen(newGame.fen());
    setHistory([]);
    gameIdRef.current = null;
    pendingSaveRef.current = Promise.resolve();

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
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="text-indigo-400 font-semibold animate-pulse text-lg">
          Loading Saved Game State...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 w-full max-w-5xl px-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-full flex justify-between items-center bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-xl text-sm text-white shadow-md">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                game.turn() === "w" ? "bg-white shadow-[0_0_8px_#fff]" : "bg-slate-900 border border-slate-500"
              }`}
            />
            <span className="font-semibold text-slate-200">
              {game.isGameOver()
                ? "Game Over"
                : `${game.turn() === "w" ? "White" : "Black"}'s Turn`}
            </span>
          </div>

          {game.inCheck() && !game.isGameOver() && (
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-1 rounded-full font-bold animate-pulse">
              CHECK
            </span>
          )}
          {game.isCheckmate() && (
            <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs px-2.5 py-1 rounded-full font-bold">
              CHECKMATE
            </span>
          )}
        </div>

        {/* Board Wrapper - pointer-events সমস্যার সমাধান */}
        <div className="w-[420px] sm:w-[480px] max-w-[90vw] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-slate-700 p-2 bg-slate-800 touch-none">
          <Chessboard
            key={gameFen}
            position={gameFen}
            onPieceDrop={onPieceDrop}
            boardWidth={460}
            customDarkSquareStyle={{ backgroundColor: "#779952" }}
            customLightSquareStyle={{ backgroundColor: "#edeed1" }}
            arePiecesDraggable={true}
            animationDuration={200}
          />
        </div>

        <button
          onClick={resetGame}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          Reset Game
        </button>
      </div>

      <div className="w-full lg:w-80 h-[480px] bg-slate-800/40 border border-slate-700 rounded-2xl p-4 flex flex-col shadow-xl">
        <h2 className="text-slate-300 font-bold text-lg mb-3 pb-2 border-b border-slate-700 flex justify-between items-center">
          <span>Move History</span>
          <span className="text-xs text-slate-500 font-normal">
            {history.length} moves
          </span>
        </h2>
        <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
          {renderHistory().length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
              No moves played yet
            </div>
          ) : (
            renderHistory().map((item) => (
              <div
                key={item.moveNum}
                className="flex items-center text-sm py-1.5 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/50 transition-colors"
              >
                <span className="w-10 text-slate-500 font-mono text-xs">
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