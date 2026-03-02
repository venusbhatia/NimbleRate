import { useEffect, useState } from "react";
import { Link } from "../../router";
import logoSvg from "../../assets/nimblerate_logo.svg";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-xl dark:border-gray-700/60 dark:bg-neutral-900/80"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="" className="flex items-center gap-2">
          <img src={logoSvg} alt="NimbleRate" className="h-10 logo-dark-mode" />
        </Link>
        <Link
          to="dashboard"
          className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-dune-950 shadow-sm transition hover:bg-gold-400 active:scale-[0.98]"
        >
          Open Dashboard
        </Link>
      </div>
    </nav>
  );
}
