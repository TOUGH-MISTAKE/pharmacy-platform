"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, LoaderCircle, Lock, CloudUpload, X } from "lucide-react";
import { toast } from "sonner";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { selectClass, textareaClass } from "@/components/prescriptions/field-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  PRESCRIPTION_BUCKET,
  buildStoragePath,
  formatFileSize,
  validateFile,
} from "@/lib/prescriptions/files";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

interface BranchOption {
  id: string;
  name: string;
  town: string;
}

function todayAsInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function UploadForm() {
  const router = useRouter();
  const { loading: authLoading, userId } = useAuthUser();

  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const filesRef = useRef<SelectedFile[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const branchesQuery = useQuery({
    queryKey: ["branches-for-upload"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<BranchOption[]> => {
      const { data, error } = await createClient()
        .from("branches")
        .select("id, name, town")
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as BranchOption[];
    },
  });

  function addFiles(incoming: FileList | File[]) {
    const errors: string[] = [];
    const accepted: SelectedFile[] = [];
    const current = [...files];

    for (const file of Array.from(incoming)) {
      if (current.length + accepted.length >= MAX_FILES) {
        errors.push(`You can upload up to ${MAX_FILES} files per prescription.`);
        break;
      }
      const problem = validateFile(file);
      if (problem) {
        errors.push(problem);
        continue;
      }
      const duplicate = [...current, ...accepted].some(
        (item) => item.file.name === file.name && item.file.size === file.size
      );
      if (duplicate) continue;

      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    }

    setFileErrors(errors);
    if (accepted.length > 0) {
      setFiles((existing) => [...existing, ...accepted]);
    }
  }

  function removeFile(id: string) {
    setFiles((existing) => {
      const target = existing.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return existing.filter((item) => item.id !== id);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);

    if (files.length === 0) {
      setFormError("Please add at least one photo or PDF of your prescription.");
      return;
    }
    if (prescriptionDate && prescriptionDate > todayAsInputValue()) {
      setFormError("The prescription date cannot be in the future.");
      return;
    }
    if (!confirmed) {
      setFormError("Please confirm the statement at the bottom of the form.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const uploadedPaths: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        setProgress(`Uploading file ${index + 1} of ${files.length}...`);
        const { file } = files[index];
        const path = buildStoragePath(user.id, file);
        const { error } = await supabase.storage
          .from(PRESCRIPTION_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          throw new Error(`Could not upload "${file.name}". ${error.message}`);
        }
        uploadedPaths.push(path);
      }

      setProgress("Saving your prescription...");
      const { error: insertError } = await supabase.from("prescriptions").insert({
        patient_id: user.id,
        branch_id: branchId || null,
        file_paths: uploadedPaths,
        doctor_name: doctorName.trim() || null,
        facility_name: facilityName.trim() || null,
        prescription_date: prescriptionDate || null,
        patient_notes: notes.trim() || null,
      });
      if (insertError) {
        throw new Error(insertError.message);
      }

      toast.success("Prescription submitted. A pharmacist will review it shortly.");
      router.push("/account/prescriptions");
      router.refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (authLoading) {
    return <Skeleton className="h-96 w-full rounded-3xl" />;
  }

  if (!userId) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Lock className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-brand-900">Sign in to upload</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We need to know who the prescription belongs to, so we can keep it private and link it
          to your orders.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login?next=/prescriptions"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full px-6")}
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-3xl border border-brand-100 bg-white p-5 sm:p-8"
    >
      {formError ? <FormAlert message={formError} /> : null}

      <div>
        <p className="text-sm font-semibold text-brand-900">
          Prescription photos or PDF <span className="text-destructive">*</span>
        </p>

        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition",
            dragging
              ? "border-brand-500 bg-brand-50"
              : "border-brand-200 bg-brand-50/50 hover:border-brand-400 hover:bg-brand-50"
          )}
        >
          <CloudUpload className="h-8 w-8 text-brand-600" />
          <span className="text-sm font-bold text-brand-800">
            Tap to take a photo or choose a file
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG, WebP or PDF. Up to {MAX_FILES} files, 10 MB each.
          </span>
          <input
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {fileErrors.length > 0 ? (
          <ul role="alert" className="mt-2 space-y-1 text-sm text-destructive">
            {fileErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        {files.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.map((item) => (
              <li
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-brand-200 bg-white"
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={`Preview of ${item.file.name}`}
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-brand-50 text-brand-600">
                    <FileText className="h-8 w-8" />
                  </div>
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-semibold text-brand-900">{item.file.name}</p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-700 shadow hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="doctorName" label="Doctor's name (optional)">
          <Input
            id="doctorName"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
            className="h-11"
          />
        </FormField>
        <FormField id="facilityName" label="Hospital or clinic (optional)">
          <Input
            id="facilityName"
            value={facilityName}
            onChange={(event) => setFacilityName(event.target.value)}
            className="h-11"
          />
        </FormField>
        <FormField id="prescriptionDate" label="Date on the prescription (optional)">
          <Input
            id="prescriptionDate"
            type="date"
            max={todayAsInputValue()}
            value={prescriptionDate}
            onChange={(event) => setPrescriptionDate(event.target.value)}
            className="h-11"
          />
        </FormField>
        <FormField
          id="branchId"
          label="Preferred branch (optional)"
          hint="Where you would like to collect or be served from."
        >
          <select
            id="branchId"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className={selectClass}
          >
            <option value="">No preference</option>
            {(branchesQuery.data ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.town})
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id="notes" label="Notes for the pharmacist (optional)">
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          placeholder="Allergies, brand preferences, or anything we should know."
          className={textareaClass}
        />
      </FormField>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-brand-300 accent-brand-600"
        />
        <span>
          I confirm this prescription was issued to me, or I am authorised to order on behalf of the
          patient named on it.
        </span>
      </label>

      <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-full">
        {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {submitting ? (progress ?? "Submitting...") : "Submit prescription"}
      </Button>
    </form>
  );
}
