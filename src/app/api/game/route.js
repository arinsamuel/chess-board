import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Game from "@/models/Game";
import mongoose from "mongoose";

// GET: Fetch the latest game
export async function GET() {
  console.log("API: GET /api/game request received");
  try {
    await connectToDatabase();
    const latestGame = await Game.findOne().sort({ updatedAt: -1 });
    return NextResponse.json({ success: true, game: latestGame || null });
  } catch (error) {
    console.error("API GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Save, Update, Undo, or Reset Game
export async function POST(req) {
  console.log("API: POST /api/game request received");
  try {
    await connectToDatabase();
    const { gameId, fen, history, isGameOver, winner } = await req.json();

    let game = null;

    if (gameId && mongoose.Types.ObjectId.isValid(gameId)) {
      console.log(`API POST: Updating existing game document ${gameId}`);
      game = await Game.findByIdAndUpdate(
        gameId,
        {
          $set: {
            fen,
            history,
            isGameOver,
            winner: winner || null,
            updatedAt: new Date(),
          },
        },
        { new: true, runValidators: true }
      );
    }

    if (!game) {
      console.log("API POST: Creating a new game document in MongoDB");
      game = await Game.create({
        fen,
        history,
        isGameOver,
        winner: winner || null,
      });
    }

    return NextResponse.json({ success: true, game });
  } catch (error) {
    console.error("API POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}