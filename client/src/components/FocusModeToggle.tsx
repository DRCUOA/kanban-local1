import { Button } from "@/components/ui/button";
import { Focus } from "lucide-react";

interface FocusModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function FocusModeToggle({ enabled, onToggle }: FocusModeToggleProps) {
  return (
    <Button
      variant={enabled ? "default" : "outline"}
      size="icon"
      className="rounded-xl h-11 w-11 active:scale-90 transition-transform"
      onClick={() => {
        if ('vibrate' in navigator) navigator.vibrate(5);
        onToggle(!enabled);
      }}
    >
      <Focus className="h-5 w-5" />
    </Button>
  );
}
