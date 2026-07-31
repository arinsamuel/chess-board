import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Game from "@/models/Game";
import mongoose from "mongoose";

// get last load data 
export async function GET() {
  console.log("API: GET /api/game request received");
  try {
    await connectToDatabase();
    const latestGame = await Game.findOne().sort({ updatedAt: -1 });
    return NextResponse.json({ success: true, game: latestGame });
  } catch (error) {
    console.error("API GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// game saved post 
export async function POST(req) {
  console.log("API: POST /api/game request received");
  try {
    await connectToDatabase();
    const { gameId, fen, history, isGameOver, winner } = await req.json();

    let game;
    if (gameId && mongoose.Types.ObjectId.isValid(gameId)) {
      console.log(`API POST: Updating existing game document ${gameId}`);
      game = await Game.findByIdAndUpdate(
        gameId,
        { fen, history, isGameOver, winner, updatedAt: Date.now() },
        { returnDocument: "after" }
      );
    } else {
      console.log("API POST: Creating a new game document in MongoDB");
      game = await Game.create({ fen, history, isGameOver, winner });
    }

    return NextResponse.json({ success: true, game });
  } catch (error) {
    console.error("API POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
