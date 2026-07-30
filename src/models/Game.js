import mongoose from "mongoose";

const GameSchema = new mongoose.Schema({
  fen: { type: String, required: true },
  history: { type: Array, default: [] },
  isGameOver: { type: Boolean, default: false },
  winner: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Game || mongoose.model("Game", GameSchema);
