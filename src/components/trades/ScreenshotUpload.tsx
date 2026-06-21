"use client";
import { useState, useRef } from "react";
import { X, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

// Compress image to max 800px wide, quality 0.7
function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 800;
        const ratio = Math.min(1, maxW / img.width);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ScreenshotUpload({ label, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const compressed = await compressImage(file);
    onChange(compressed);
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border group">
          <img src={value} alt={label} className="w-full h-32 object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur text-white hover:bg-white/30 transition-colors">
              Replace
            </button>
            <button type="button" onClick={() => onChange("")}
              className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-red-500/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
            uploading ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20" : "border-border hover:border-indigo-400 hover:bg-muted/50"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <p className="text-xs text-muted-foreground">Compressing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Drop or click to upload</p>
              <p className="text-[10px] text-muted-foreground/60">Auto-compressed to 800px</p>
            </div>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}
