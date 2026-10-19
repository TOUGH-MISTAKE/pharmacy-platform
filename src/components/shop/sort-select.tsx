"use client";

import { useRouter } from "next/navigation";

interface SortSelectProps {
  value: string;
  options: { value: string; label: string; href: string }[];
}

export function SortSelect({ value, options }: SortSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort by</span>
      <select
        value={value}
        onChange={(event) => {
          const option = options.find((item) => item.value === event.target.value);
          if (option) router.push(option.href);
        }}
        className="h-10 rounded-full border border-brand-200 bg-white px-3 text-sm font-medium text-brand-800"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
