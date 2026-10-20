"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PRESCRIPTION_BUCKET, isPdfPath } from "@/lib/prescriptions/files";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface FileViewerProps {
  paths: string[];
  /** "thumbs" = small previews for lists, "full" = large previews for pharmacists. */
  variant?: "thumbs" | "full";
}

interface SignedFile {
  path: string;
  signedUrl: string | null;
}

export function FileViewer({ paths, variant = "thumbs" }: FileViewerProps) {
  const query = useQuery({
    queryKey: ["prescription-files", paths],
    enabled: paths.length > 0,
    staleTime: 4 * 60 * 1000,
    queryFn: async (): Promise<SignedFile[]> => {
      const { data, error } = await createClient()
        .storage.from(PRESCRIPTION_BUCKET)
        .createSignedUrls(paths, 600);
      if (error) throw new Error(error.message);
      return (data ?? []).map((item) => ({
        path: item.path ?? "",
        signedUrl: item.signedUrl ?? null,
      }));
    },
  });

  const isFull = variant === "full";

  if (query.isLoading) {
    return (
      <div className={cn("grid gap-3", isFull ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-5")}>
        {paths.map((path) => (
          <Skeleton key={path} className={isFull ? "h-80 w-full rounded-xl" : "h-24 w-full rounded-lg"} />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We could not load the prescription files. Please refresh the page.
      </p>
    );
  }

  return (
    <ul className={cn("grid gap-3", isFull ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-5")}>
      {query.data.map((file, index) => {
        const label = `Prescription file ${index + 1}`;

        if (!file.signedUrl) {
          return (
            <li
              key={file.path || index}
              className="flex h-24 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-center text-xs text-red-700"
            >
              File unavailable
            </li>
          );
        }

        if (isPdfPath(file.path)) {
          return (
            <li key={file.path}>
              <a
                href={file.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-center text-sm font-semibold text-brand-800 hover:bg-brand-100",
                  isFull ? "h-40" : "h-24"
                )}
              >
                <FileText className="h-6 w-6" />
                <span className="inline-flex items-center gap-1">
                  Open PDF {index + 1}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            </li>
          );
        }

        return (
          <li key={file.path}>
            <a
              href={file.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label} (opens in a new tab)`}
              className="block overflow-hidden rounded-xl border border-brand-200 bg-white hover:border-brand-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.signedUrl}
                alt={label}
                loading="lazy"
                className={cn(
                  "w-full bg-white",
                  isFull ? "max-h-[75vh] object-contain" : "h-24 object-cover"
                )}
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
