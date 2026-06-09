import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
import slide1 from "@/assets/onboard-1.jpg";
import slide2 from "@/assets/onboard-2.jpg";
import slide3 from "@/assets/onboard-3.jpg";

const slides = [
  {
    image: slide1,
    kicker: "For students",
    title: "Post what you need",
    desc: "Coding, design, tutoring, errands — describe the task and set your Naira price.",
  },
  {
    image: slide2,
    kicker: "For providers",
    title: "Bid & bargain",
    desc: "Skilled providers send offers. Negotiate freely, then lock in the best deal.",
  },
  {
    image: slide3,
    kicker: "Safe by design",
    title: "Escrow keeps it safe",
    desc: "Funds are held securely and only released once the work is delivered.",
  },
];

export function OnboardingCarousel({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const isLast = i === slides.length - 1;
  const slide = slides[i];

  return (
    <div className="relative flex h-[100svh] flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-white drop-shadow">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">SkillSwap</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDone}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          Skip
        </Button>
      </div>

      {/* Hero image with gradient fade */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden">
        <img
          key={slide.image}
          src={slide.image}
          alt=""
          className="h-full w-full object-cover animate-fade-in"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background" />
      </div>

      {/* Content card */}
      <div className="relative z-10 -mt-12 flex flex-col rounded-t-3xl bg-background px-6 pb-6 pt-6 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.15)]">
        <div key={i} className="animate-fade-in">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {slide.kicker}
          </p>
          <h2 className="mb-1.5 text-2xl font-bold leading-tight text-foreground">
            {slide.title}
          </h2>
          <p className="max-w-md text-sm leading-snug text-muted-foreground">
            {slide.desc}
          </p>
        </div>

        {/* Dots */}
        <div className="mb-4 mt-4 flex justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === i ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <Button
          size="lg"
          className="h-12 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20"
          onClick={() => (isLast ? onDone() : setI(i + 1))}
        >
          {isLast ? "Get started" : "Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
