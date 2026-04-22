import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center p-10 max-w-2xl mx-auto">
      <div className="text-[120px] font-sans font-normal text-earth-gray leading-none mb-2 -tracking-[4px] select-none">
        404
      </div>
      <h1 className="text-[56px] font-sans font-normal text-parchment leading-tight tracking-[-1.12px] mb-4">
        You've reached a dead end.
      </h1>
      <p className="text-[20px] text-ash-gray mb-10 leading-relaxed">
        The page you're looking for doesn't exist or has surfaced elsewhere in the void.
      </p>
      <Link
        to="/"
        className="px-10 py-5 bg-parchment text-void rounded-pill font-bold text-[18px] hover:brightness-90 transition-all"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
