"use client";

import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface SmartSearchProperty {
  id: string;
  title: string;
  location?: string;
  price?: number;
  bedrooms?: number;
  property_type?: string;
  similarity: number;
}

interface SmartSearchBarProps {
  organizationId?: string;
  onResults: (results: SmartSearchProperty[]) => void;
  onClear: () => void;
}

export function SmartSearchBar({ onResults, onClear }: SmartSearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      onClear();
      return undefined;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } };
        const token = sessionData.session?.access_token;

        if (!token) {
          return;
        }

        const response = await fetch("/api/ai/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, matchCount: 10 }),
        });
        const searchData = (await response.json()) as { properties?: SmartSearchProperty[] };

        if (response.ok) {
          onResults(searchData.properties ?? []);
        }
      } catch {
        // Keep the existing property list visible if semantic search is unavailable.
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onResults, onClear]);

  function clearSearch() {
    setQuery("");
    onClear();
  }

  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#7f8b86]" />
        ) : (
          <Sparkles className="h-4 w-4 text-[#176b4d]" />
        )}
      </div>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ask in plain English, e.g. 3BHK near Golf Course Road under 80L"
        className="w-full rounded-lg border border-[#dfe5df] bg-white py-2 pl-9 pr-10 text-sm text-[#32433c] placeholder:text-[#8a9691] focus:border-[#8ab5a4] focus:outline-none"
      />
      {query ? (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute inset-y-0 right-3 flex items-center text-[#7f8b86] hover:text-[#32433c]"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#7f8b86]">
          <Search className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
