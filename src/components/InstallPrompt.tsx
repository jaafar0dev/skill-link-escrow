import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, X } from "lucide-react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt({ onDone }: { onDone: () => void }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setStandalone(inStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone) {
    // already installed — auto-continue
    setTimeout(onDone, 0);
    return null;
  }

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    onDone();
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rounded-3xl bg-primary/10 p-6">
        <Smartphone className="h-14 w-14 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Install SkillSwap</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add SkillSwap to your home screen for a faster, app-like experience with escrow-protected payments.
        </p>
      </div>

      {isIOS ? (
        <div className="rounded-xl border bg-card p-4 text-left text-sm">
          <p className="font-medium">On iPhone / iPad:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Tap the <span className="font-semibold">Share</span> button in Safari.</li>
            <li>Scroll and tap <span className="font-semibold">Add to Home Screen</span>.</li>
            <li>Open SkillSwap from your home screen.</li>
          </ol>
        </div>
      ) : deferred ? (
        <Button size="lg" className="w-full" onClick={handleInstall}>
          <Download className="mr-2 h-4 w-4" /> Install app
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Your browser may show an install icon in the address bar. You can continue without installing.
        </p>
      )}

      <Button variant="ghost" onClick={onDone} className="text-muted-foreground">
        <X className="mr-2 h-4 w-4" /> Continue in browser
      </Button>
    </div>
  );
}
