"use client";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  onTip: () => void;
  onSettingsOpen: () => void;
  tipDisabled?: boolean;
}

export default function Header({ onTip, onSettingsOpen, tipDisabled }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="relative flex items-center justify-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h1 className="text-xl font-bold tracking-wider text-gray-900 dark:text-white">KONTEXTO</h1>
      <div className="absolute right-4 flex items-center gap-3">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xl leading-none"
            aria-label="Menü"
          >
            &#8942;
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={() => { setMenuOpen(false); onTip(); }}
                disabled={tipDisabled}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Tipp
              </button>
              <button
                onClick={() => { setMenuOpen(false); onSettingsOpen(); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Einstellungen
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
