"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/prescriptions/files";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "product-images";
const MAX_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface ProductImagesProps {
  productId: string;
  imageUrls: string[];
  onChange: (urls: string[]) => void;
}

export function ProductImages({ productId, imageUrls, onChange }: ProductImagesProps) {
  const [uploading, setUploading] = useState(0);

  async function handleFiles(files: FileList) {
    const supabase = createClient();
    const added: string[] = [];
    const room = MAX_IMAGES - imageUrls.length;

    if (room <= 0) {
      toast.error(`A product can have up to ${MAX_IMAGES} photos.`);
      return;
    }

    for (const file of Array.from(files).slice(0, room)) {
      const extension = EXTENSIONS[file.type];
      if (!extension) {
        toast.error(`"${file.name}" is not supported. Use JPG, PNG or WebP.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" is ${formatFileSize(file.size)}. The limit is 5 MB.`);
        continue;
      }

      const safeName =
        file.name
          .replace(/\.[^.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "photo";
      const path = `${productId}/${crypto.randomUUID()}-${safeName}.${extension}`;

      setUploading((count) => count + 1);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
      setUploading((count) => count - 1);

      if (error) {
        toast.error(`Could not upload "${file.name}". ${error.message}`);
        continue;
      }

      added.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    if (added.length > 0) {
      onChange([...imageUrls, ...added]);
    }
  }

  return (
    <div>
      {imageUrls.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imageUrls.map((url, index) => (
            <li
              key={url}
              className="relative overflow-hidden rounded-xl border border-brand-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Product photo ${index + 1}`} className="aspect-square w-full object-contain" />
              {index === 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2.5 py-1 text-[0.65rem] font-bold text-white">
                  Main photo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange([url, ...imageUrls.filter((item) => item !== url)])}
                  className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[0.65rem] font-bold text-brand-700 shadow hover:bg-white"
                >
                  <Star className="h-3 w-3" />
                  Make main
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(imageUrls.filter((item) => item !== url))}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-red-700 shadow hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50",
          imageUrls.length >= MAX_IMAGES && "pointer-events-none opacity-50"
        )}
      >
        {uploading > 0 ? (
          <LoaderCircle className="h-7 w-7 animate-spin text-brand-600" />
        ) : (
          <ImagePlus className="h-7 w-7 text-brand-600" />
        )}
        <span className="text-sm font-bold text-brand-800">
          {uploading > 0 ? "Uploading..." : "Add photos"}
        </span>
        <span className="text-xs text-muted-foreground">
          JPG, PNG or WebP, up to 5 MB each. The first photo is the main one.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
