"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/admin/slug";
import { createClient } from "@/lib/supabase/client";

interface InlineCreateProps {
  table: "brands" | "categories";
  label: string;
  onCreated: (id: string) => void;
}

/** A tiny "add a new brand or category" box that sits under a dropdown. */
export function InlineCreate({ table, label, onCreated }: InlineCreateProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const clean = name.trim();
    const slug = slugify(clean);
    if (clean.length < 2 || !slug) {
      toast.error(`Enter a ${label.toLowerCase()} name.`);
      return;
    }

    setSaving(true);
    const { data, error } = await createClient()
      .from(table)
      .insert({ name: clean, slug })
      .select("id")
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error(
        error?.code === "23505"
          ? `A ${label.toLowerCase()} with that name already exists. Pick it from the list.`
          : `We could not add the ${label.toLowerCase()}. Please try again.`
      );
      return;
    }

    toast.success(`${label} added.`);
    setName("");
    setOpen(false);
    onCreated((data as { id: string }).id);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs font-semibold text-brand-600 hover:underline"
      >
        + Add a new {label.toLowerCase()}
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={`New ${label.toLowerCase()} name`}
        aria-label={`New ${label.toLowerCase()} name`}
        className="h-9"
      />
      <Button type="button" size="sm" disabled={saving} onClick={handleCreate} className="rounded-full">
        {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
        Add
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
        Cancel
      </Button>
    </div>
  );
}
