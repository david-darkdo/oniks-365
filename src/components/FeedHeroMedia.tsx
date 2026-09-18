import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Sparkles } from "lucide-react";
import type { FeedHeroItem } from "@/lib/catalog";

interface FeedHeroMediaProps {
  items: FeedHeroItem[];
}

export function FeedHeroMedia({ items }: FeedHeroMediaProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activeItems = items && items.length > 0 ? items : [];
  const currentItem = activeItems[currentIndex] || null;

  // Next / Prev slide handlers
  const goToNext = () => {
    if (activeItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeItems.length);
  };

  const goToPrev = () => {
    if (activeItems.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
  };

  // Auto-advance logic
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!currentItem || activeItems.length <= 1) return;

    if (currentItem.media_type === "image") {
      const duration = (currentItem.duration_seconds || 10) * 1000;
      timerRef.current = setTimeout(() => {
        goToNext();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentIndex, currentItem, activeItems.length]);

  // Video natural completion handler
  const handleVideoEnded = () => {
    goToNext();
  };

  if (!currentItem) {
    return null;
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border/70 bg-neutral-950 shadow-md aspect-[16/8] sm:aspect-[21/9] md:aspect-[24/9] max-h-[360px] select-none group">
      {/* Background Media Slides */}
      {activeItems.map((item, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {item.media_type === "video" ? (
              <video
                ref={isActive ? videoRef : undefined}
                src={item.media_url}
                autoPlay={isActive}
                muted={isMuted}
                playsInline
                loop={activeItems.length === 1}
                onEnded={handleVideoEnded}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={item.media_url}
                alt={item.title || "ONIKS 365 Showroom"}
                className="w-full h-full object-cover transform scale-100 group-hover:scale-[1.02] transition-transform duration-1000 ease-out"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            )}
            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        );
      })}

      {/* Content Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-5 sm:p-7 md:p-8 pointer-events-none">
        <div className="max-w-xl space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 backdrop-blur-md px-3 py-1 border border-amber-500/40 text-[10px] sm:text-xs uppercase tracking-[0.18em] font-bold text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{currentItem.title || "ONIKS 365 SHOWROOM"}</span>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Luxury Sanitary & Architectural Showcase
          </h2>

          <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 max-w-lg font-light">
            Nigeria's foremost destination for precision-engineered kitchen sinks, sanitary fixtures, and luxury architectural fittings.
          </p>
        </div>
      </div>

      {/* Media Controls (Video Mute/Unmute) */}
      {currentItem.media_type === "video" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white/90 hover:text-white border border-white/20 transition shadow-sm"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}

      {/* Navigation Arrows (for multiple items) */}
      {activeItems.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous Slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md text-white/80 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition shadow-md"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next Slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md text-white/80 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition shadow-md"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Indicator Dots */}
          <div className="absolute bottom-4 right-5 sm:right-7 z-30 flex items-center gap-1.5 pointer-events-auto">
            {activeItems.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx ? "w-6 bg-amber-400" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
