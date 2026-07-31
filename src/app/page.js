import ChessBoard from "./ChessBoard";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white flex flex-col items-center justify-center p-4 md:p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Pro Chess Arena
        </h1>
<div className="flex flex-col items-center gap-2 mt-6 border-t border-slate-800/80 pt-5">
  <div className="flex items-center gap-1.5 text-slate-300 text-sm font-medium">
    <span>Developed & Designed by</span>
    <a
      href="https://www.linkedin.com/in/arin-sarker/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-pink-400 font-semibold hover:text-pink-300 underline underline-offset-4 decoration-pink-500/50 hover:decoration-pink-400 transition-all duration-200"
    >
      <span>Arin Samuel</span>
      {/* 🔗 External Link Icon */}
      <svg
        className="w-3.5 h-3.5 opacity-80"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M11.25 11.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25h6.75a2.25 2.25 0 002.25-2.25v-4.5"
        />
      </svg>
    </a>
  </div>

  <p className="text-slate-500 text-xs font-mono tracking-wide">
    Full-Stack Architecture • Next.js | MongoDB | Chess.js
  </p>
</div>
      </div>

      <ChessBoard />
    </main>
  );
}