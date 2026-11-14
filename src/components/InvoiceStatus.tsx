// InvoiceProgressBadge + InvoiceEmailStatus from the web app (same polling and retry rules).
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, MailCheck, MailWarning, RotateCw } from "lucide-react-native";
import { Box, Button, Icon, Spinner, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "@/hooks/use-toast";
import { fetchInvoiceStatus, finalizeInvoice, resendInvoiceEmail, type InvoiceProgress } from "@/lib/api/invoices";

const POLL_MS = 2000;
// How long the success tick lingers.
const DONE_VISIBLE_MS = 2000;

const isSettled = (p: { pdfStatus: string; emailStatus: string }) =>
  ["READY", "FAILED"].includes(p.pdfStatus) && ["NOT_REQUESTED", "SENT", "FAILED"].includes(p.emailStatus);

/** PDF and email progress for one invoice row. Polls until both settle; a finished row never polls. */
export function InvoiceProgressBadge({
  invoiceId,
  pdfStatus = "NOT_STARTED",
  emailStatus = "NOT_REQUESTED",
  emailRequested = false,
  onStatusChange,
}: {
  invoiceId: string;
  pdfStatus?: string;
  emailStatus?: string;
  emailRequested?: boolean;
  onStatusChange?: (status: string) => void;
}) {
  const { colors } = useTheme();
  const [progress, setProgress] = useState<InvoiceProgress | null>(null);
  const [hidden, setHidden] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Already finished when first shown: nothing to report (FAILED still shows its retry).
  const finishedBeforeMount = useRef(
    pdfStatus === "READY" && (emailRequested ? emailStatus === "SENT" : ["SENT", "NOT_REQUESTED"].includes(emailStatus)),
  );

  const current = progress ?? { pdfStatus, emailStatus };
  const settled = isSettled(current);
  const idle = current.pdfStatus === "NOT_STARTED";

  useEffect(() => {
    if (idle || settled) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await fetchInvoiceStatus(invoiceId);
        if (cancelled) return;
        setProgress(next);
        onStatusChangeRef.current?.(next.status);
      } catch {
        // transient - the next tick retries
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [invoiceId, idle, settled]);

  useEffect(() => {
    const finishedCleanly = current.pdfStatus === "READY" && ["SENT", "NOT_REQUESTED"].includes(current.emailStatus);
    if (!finishedCleanly) return;
    const timer = setTimeout(() => setHidden(true), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current.pdfStatus, current.emailStatus]);

  const retry = async (action: () => Promise<unknown>, failureTitle: string) => {
    setRetrying(true);
    try {
      await action();
      setProgress(null);
      setHidden(false);
    } catch (err) {
      toast({ title: failureTitle, description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  if (idle || hidden || finishedBeforeMount.current) return null;

  const retryButton = (label: string, action: () => Promise<unknown>, failureTitle: string) => (
    <Button variant="ghost" size="sm" disabled={retrying} onPress={() => retry(action, failureTitle)} className="h-7 gap-1.5 px-2" textClassName="text-xs" color={colors.destructive}>
      {retrying ? <Spinner className="h-3 w-3" /> : <Icon as={RotateCw} className="h-3 w-3" />}
      {label}
    </Button>
  );

  if (current.pdfStatus === "FAILED") return retryButton("Retry PDF generation", () => finalizeInvoice(invoiceId), "Could not restart PDF generation");
  if (current.pdfStatus === "READY" && current.emailStatus === "FAILED")
    return retryButton("Retry sending email", () => resendInvoiceEmail(invoiceId), "Could not resend the email");

  const line = (icon: React.ReactNode, text: string) => (
    <Box className="flex-row items-center gap-1.5">
      {icon}
      <Txt className="text-xs text-muted-foreground">{text}</Txt>
    </Box>
  );

  if (current.pdfStatus === "READY" && current.emailStatus === "PENDING") return line(<Spinner className="h-3 w-3 text-muted-foreground" />, "Sharing with Client");
  if (current.pdfStatus === "READY") return line(<Icon as={CheckCircle2} className="h-3 w-3 text-green-600" />, "All done");
  return line(<Spinner className="h-3 w-3 text-muted-foreground" />, "Generating PDF");
}

/** Whether the invoice reached the client by email, with a send / retry button when it did not. */
export function InvoiceEmailStatus({
  invoiceId,
  emailStatus = "NOT_REQUESTED",
  emailSentAt = null,
  emailRequested = false,
  emailError = null,
  pdfReady,
}: {
  invoiceId: string;
  emailStatus?: string;
  emailSentAt?: string | null;
  emailRequested?: boolean;
  emailError?: string | null;
  pdfReady: boolean;
}) {
  const [state, setState] = useState({ emailStatus, emailSentAt, emailError, pdfReady, emailRequested });
  const [sending, setSending] = useState(false);

  const idRef = useRef(invoiceId);
  useEffect(() => {
    if (idRef.current !== invoiceId) {
      idRef.current = invoiceId;
      setState({ emailStatus, emailSentAt, emailError, pdfReady, emailRequested });
    }
  }, [invoiceId, emailStatus, emailSentAt, emailError, pdfReady, emailRequested]);

  useEffect(() => {
    const awaitingPdf = !state.pdfReady;
    const awaitingSend = state.emailStatus === "PENDING" || (state.emailRequested && state.emailStatus === "NOT_REQUESTED");
    if (!awaitingPdf && !awaitingSend) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchInvoiceStatus(invoiceId);
        if (cancelled) return;
        setState({ emailStatus: next.emailStatus, emailSentAt: next.emailSentAt, emailError: next.emailError, emailRequested: next.emailRequested, pdfReady: next.pdfStatus === "READY" });
        if (next.pdfStatus === "FAILED") cancelled = true;
      } catch {
        // transient
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [invoiceId, state.pdfReady, state.emailStatus, state.emailRequested]);

  const send = async () => {
    setSending(true);
    try {
      const next = await resendInvoiceEmail(invoiceId);
      setState((s) => ({ ...s, emailStatus: next.emailStatus ?? "PENDING", emailRequested: true, emailError: null }));
    } catch (err) {
      toast({ title: "Could not send the email", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!state.pdfReady) return null;

  if (state.emailStatus === "SENT") {
    const when = state.emailSentAt ? format(new Date(state.emailSentAt), "h:mm a d MMM yyyy").replace(/\b(AM|PM)\b/, (m) => m.toLowerCase()) : null;
    return (
      <Box className="flex-row items-center gap-1.5 mt-1">
        <Icon as={MailCheck} className="h-3.5 w-3.5 text-green-600" />
        <Txt className="flex-1 text-xs text-muted-foreground">{when ? `Shared with client on e-mail at ${when}` : "Shared with client on e-mail"}</Txt>
      </Box>
    );
  }

  if (state.emailStatus === "PENDING") {
    return (
      <Box className="flex-row items-center gap-1.5 mt-1">
        <Spinner className="h-3.5 w-3.5 text-muted-foreground" />
        <Txt className="text-xs text-muted-foreground">Sending email to client...</Txt>
      </Box>
    );
  }

  const failed = state.emailStatus === "FAILED";
  return (
    <Box className="flex-row items-center gap-1.5 mt-1">
      {failed && <Icon as={MailWarning} className="h-3.5 w-3.5 text-destructive" />}
      <Txt className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`}>{failed ? "Email sending failed" : "Not shared with client yet"}</Txt>
      <Button variant="ghost" size="sm" disabled={sending} onPress={send} className="h-6 gap-1 px-2" textClassName="text-xs">
        {sending ? <Spinner className="h-3 w-3" /> : <Icon as={RotateCw} className="h-3 w-3" />}
        {failed ? "Retry" : "Send email"}
      </Button>
    </Box>
  );
}
