import ChessBoard from "./ChessBoard";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white flex flex-col items-center justify-center p-4 md:p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Pro Chess Arena
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Powered by Next.js & Tailwind CSS
        </p>
      </div>

      <ChessBoard />
    </main>
  );
}