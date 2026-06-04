import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Briefcase, Handshake, ShieldCheck, ArrowRight } from "lucide-react";

const slides = [
  {
    icon: Briefcase,
    title: "Post what you need",
    desc: "Students post tasks — coding, design, tutoring, errands — and set a price in Naira.",
  },
  {
    icon: Handshake,
    title: "Bid & bargain",
    desc: "Service providers send offers. Negotiate, then accept the best bid for your job.",
  },
  {
    icon: ShieldCheck,
    title: "Escrow keeps it safe",
    desc: "Funds are held securely and only released to the provider once the work is delivered.",
  },
];

export function OnboardingCarousel({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const Icon = slides[i].icon;
  const isLast = i === slides.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onDone}>Skip</Button>
      </div>

      <div key={i} className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
        <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-16 w-16 text-primary" />
        </div>
        <h2 className="mb-3 text-2xl font-bold">{slides[i].title}</h2>
        <p className="max-w-sm text-muted-foreground">{slides[i].desc}</p>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={`h-2 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-2 bg-muted"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={() => (isLast ? onDone() : setI(i + 1))}
      >
        {isLast ? "Get started" : "Next"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
