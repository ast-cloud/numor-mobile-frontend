import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Box, CardDescription, CardHeader, CardTitle, Spinner } from "@/components/ui";

/** Settings card header: title + description on the left, an optional action on the right. */
export function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-0">
      <Box className="flex-1 gap-1">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </Box>
      {/* space-y-1.5 on the web header pushes the second child down by 6px */}
      {action ? <Box className="mt-1.5 ml-2">{action}</Box> : null}
    </CardHeader>
  );
}

export const SectionLoader = ({ className = "py-12", size = "w-6 h-6" }: { className?: string; size?: string }) => (
  <Box className={`items-center justify-center ${className}`}>
    <Spinner className={`${size} text-muted-foreground`} />
  </Box>
);

export function ConfirmDelete({
  open,
  title,
  description,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy} onPress={onCancel}>
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={busy} onPress={onConfirm}>
          {busy ? <Spinner className="w-4 h-4 mr-2" /> : null}
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
