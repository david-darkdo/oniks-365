import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
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

  // Next / Prev slide navigation
  const goToNext = () => {
    if (activeItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeItems.length);
  };

  const goToPrev = () => {
    if (activeItems.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
  };

  // Video autoplay & reset whenever active slide changes
  useEffect(() => {
    if (currentItem?.media_type === "video" && videoRef.current) {
      try {
        videoRef.current.currentTime = 0;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay may be deferred until user interaction
          });
        }
      } catch {
        // Fallback for media element errors
      }
    }
  }, [currentIndex, currentItem]);

  // Auto-advance logic: ONLY runs for images. Videos advance strictly on natural end (onEnded)
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

  // Video natural completion handler: advances to next slide only if multiple slides exist
  const handleVideoEnded = () => {
    if (activeItems.length > 1) {
      goToNext();
    }
  };

  if (!currentItem) {
    return null;
  }

  return (
    <section 
      aria-label="Showroom Visual Discovery Feed"
      className="relative w-full overflow-hidden bg-neutral-950 aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/9] select-none group"
    >
      {/* Visual Media Carousel Slides */}
      {activeItems.map((item, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
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
                preload="auto"
                loop={false}
                onEnded={handleVideoEnded}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={item.media_url}
                alt={item.title || "ONIKS 365 Visual Showcase"}
                className="w-full h-full object-cover transform scale-100 group-hover:scale-[1.01] transition-transform duration-1000 ease-out"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            )}
            {/* Slide Title / Badge attached directly to this slide */}
            {item.title && (
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 pointer-events-none">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs sm:text-sm font-bold tracking-wide uppercase border border-white/20 shadow-lg animate-in fade-in duration-500">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {item.title}
                </span>
              </div>
            )}

            {/* Subtle bottom shadow vignette strictly for slide indicator contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          </div>
        );
      })}

      {/* Media Audio Toggle (Top Right for Videos) */}
      {currentItem.media_type === "video" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white border border-white/20 transition shadow-md"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}

      {/* Slide Navigation Arrows */}
      {activeItems.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous Slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-2.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition shadow-lg"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next Slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-2.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition shadow-lg"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Minimal Bottom Indicator Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto">
            {activeItems.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx ? "w-7 bg-amber-400 shadow-xs" : "w-1.5 bg-white/40 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
