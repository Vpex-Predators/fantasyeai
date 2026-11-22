import React, { useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Account-deletion entry point (the settings chip in the signed-in profile
// card). Explains the consequences, wipes the account server-side, surfaces
// errors, and signs the user out locally on success.
export default function DeleteAccountDialog() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async (e) => {
    e.preventDefault(); // keep the dialog open until the request settles
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await base44.functions.invoke("deleteMyAccount", {});
      setOpen(false);
      logout(false); // clears the token locally without a redirect loop
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Deletion failed — nothing was removed. Try again.");
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!deleting) {
          setOpen(o);
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Account settings"
          className="no-callout flex min-h-[48px] shrink-0 items-center gap-1 px-1 text-white/50 transition-colors hover:text-white"
        >
          <Settings className="h-4 w-4" />
          <span className="text-sm font-bold uppercase tracking-wider">Settings</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-lg">Delete your account?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-white/70">
            This permanently erases everything FantasyEdge AI stores for you — your team
            lock, saved player analyses, waiver scan history, and refresh data. You'll be
            signed out immediately. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm font-medium text-rose-300" role="alert">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} className="h-11 min-h-[48px] px-4 text-sm">
            Keep my account
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="h-11 min-h-[48px] px-4 text-sm bg-rose-600 text-white hover:bg-rose-500"
          >
            {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}