import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Spinner, Txt } from "@/components/ui";
import { useToast } from "@/hooks/use-toast";
import { PaymentAccount, PaymentAccountInput, createPaymentAccount, updatePaymentAccount } from "@/lib/api/paymentAccounts";

interface PaymentAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this set; otherwise it creates a new one. */
  editing?: PaymentAccount | null;
  onSaved: (account: PaymentAccount) => void;
}

const EMPTY: PaymentAccountInput = { nickname: "", bankName: "", accountName: "", accountNumber: "", ifsc: "", swift: "", bankAddress: "" };

const DETAIL_FIELDS: { key: keyof Omit<PaymentAccountInput, "nickname">; label: string; placeholder: string }[] = [
  { key: "bankName", label: "Bank Name", placeholder: "e.g. HDFC Bank" },
  { key: "accountName", label: "Account Name", placeholder: "e.g. Numor Technologies Pvt Ltd" },
  { key: "accountNumber", label: "Account Number / IBAN", placeholder: "e.g. 1234567890" },
  { key: "ifsc", label: "IFSC Code", placeholder: "e.g. HDFC0000123" },
  { key: "swift", label: "SWIFT/BIC", placeholder: "e.g. HDFCINBB" },
  { key: "bankAddress", label: "Bank Address", placeholder: "e.g. MG Road, Bengaluru" },
];

const toInput = (account: PaymentAccount): PaymentAccountInput => ({
  nickname: account.nickname,
  bankName: account.bankName ?? "",
  accountName: account.accountName ?? "",
  accountNumber: account.accountNumber ?? "",
  ifsc: account.ifsc ?? "",
  swift: account.swift ?? "",
  bankAddress: account.bankAddress ?? "",
});

const PaymentAccountFormDialog = ({ open, onOpenChange, editing = null, onSaved }: PaymentAccountFormDialogProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<PaymentAccountInput>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editing ? toInput(editing) : EMPTY);
  }, [open, editing]);

  const setField = (key: keyof PaymentAccountInput, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const nickname = form.nickname.trim();
    if (!nickname) {
      toast({ title: "Nickname required", description: "Give this set a name you will recognise, e.g. HDFC Current.", variant: "destructive" });
      return;
    }
    if (!DETAIL_FIELDS.some(({ key }) => (form[key] ?? "").trim())) {
      toast({ title: "Details required", description: "Fill at least one bank or payment field.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const payload: PaymentAccountInput = { ...form, nickname };
      const saved = editing ? await updatePaymentAccount(editing.id, payload) : await createPaymentAccount(payload);
      toast({ title: editing ? "Payment details updated" : "Payment details saved" });
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast({ title: editing ? "Failed to update" : "Failed to save", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit Payment Details" : "Add Payment Details"}</DialogTitle>
        <DialogDescription>Fill the fields that apply. Only the ones you fill appear on the invoice.</DialogDescription>
      </DialogHeader>

      <Box className="gap-4 py-2">
        <Box className="gap-2">
          <Label>Nickname</Label>
          <Input value={form.nickname} onChangeText={(v) => setField("nickname", v)} placeholder="e.g. HDFC Current" />
          <Txt className="text-xs text-muted-foreground">Only you see this. It is how you pick this set on an invoice.</Txt>
        </Box>
        {DETAIL_FIELDS.map(({ key, label, placeholder }) => (
          <Box key={key} className="gap-2">
            <Label>{label}</Label>
            <Input value={form[key] ?? ""} onChangeText={(v) => setField(key, v)} placeholder={placeholder} autoCapitalize={key === "ifsc" || key === "swift" ? "characters" : undefined} />
          </Box>
        ))}
      </Box>

      <DialogFooter>
        <Button variant="outline" className="mt-2" onPress={() => onOpenChange(false)} disabled={isSaving}>
          Cancel
        </Button>
        <Button onPress={handleSave} disabled={isSaving}>
          {isSaving && <Spinner className="w-4 h-4 mr-2" />}
          {editing ? "Save changes" : "Save"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default PaymentAccountFormDialog;
