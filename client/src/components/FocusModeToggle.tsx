import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Focus } from "lucide-react";

interface FocusModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function FocusModeToggle({ enabled, onToggle }: FocusModeToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? "default" : "outline"}
          size="icon"
          className="rounded-xl h-11 w-11"
          onClick={() => onToggle(!enabled)}
        >
          <Focus className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{enabled ? "Exit Focus Mode" : "Enter Focus Mode"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
