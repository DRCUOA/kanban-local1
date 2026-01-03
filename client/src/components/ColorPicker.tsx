import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
}

// Predefined color palette
const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
];

export function ColorPicker({ value = "#3B82F6", onChange, label }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  // Sync input value when prop value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Normalize color to hex format
  const normalizeToHex = (color: string): string => {
    if (!color || color === "") return "#3B82F6"; // Default fallback
    
    // If already hex, return as is
    if (color.startsWith("#")) {
      // Expand short hex (#RGB to #RRGGBB)
      if (color.length === 4) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
      }
      return color;
    }
    
    // Convert rgb to hex
    const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return `#${[r, g, b].map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      }).join("")}`;
    }
    
    return color; // Return as-is if can't normalize
  };

  const handleColorChange = (color: string) => {
    const normalizedColor = normalizeToHex(color);
    setInputValue(normalizedColor);
    onChange(normalizedColor);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // Validate and update if valid hex or rgb
    if (isValidColor(newValue)) {
      const normalizedColor = normalizeToHex(newValue);
      onChange(normalizedColor);
    }
  };

  const isValidColor = (color: string): boolean => {
    // Check hex format (#RRGGBB or #RGB)
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    // Check rgb format (rgb(r, g, b))
    const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i;
    return hexRegex.test(color) || rgbRegex.test(color);
  };

  // Convert hex to rgb for display
  const hexToRgb = (hex: string): string | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`
      : null;
  };

  // Convert rgb to hex
  const rgbToHex = (rgb: string): string | null => {
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return null;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return `#${[r, g, b].map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("")}`;
  };

  const displayValue = inputValue.startsWith("rgb") 
    ? rgbToHex(inputValue) || inputValue 
    : inputValue;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-12 h-12 rounded-xl border-2 border-border neo-raised cursor-pointer transition-all hover:scale-105",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
              style={{ backgroundColor: displayValue }}
              title="Click to open color picker"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Preset Colors</Label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 transition-all hover:scale-110",
                        displayValue === color ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        handleColorChange(color);
                        setIsOpen(false);
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Custom Color</Label>
                <input
                  type="color"
                  value={displayValue.startsWith("#") ? displayValue : "#3B82F6"}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-full h-10 rounded-xl cursor-pointer"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <div className="flex-1">
          <Input
            type="text"
            placeholder="#3B82F6 or rgb(59, 130, 246)"
            value={inputValue}
            onChange={handleInputChange}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter hex (#RRGGBB) or rgb(r, g, b)
          </p>
        </div>
      </div>
    </div>
  );
}
