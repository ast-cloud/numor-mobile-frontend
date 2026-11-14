// Settings cards for invoices: custom fields, item units and saved payment details.
import { useEffect, useState } from "react";
import { FileText, Landmark, Pencil, Plus, Trash2, X } from "lucide-react-native";
import PaymentAccountFormDialog from "@/components/PaymentAccountFormDialog";
import { Badge, Box, Button, Card, CardContent, Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Icon, Input, Label, Press, Spinner, Txt } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { InvoiceCustomField, createInvoiceCustomField, deleteInvoiceCustomField, updateInvoiceCustomField } from "@/lib/api/invoiceCustomFields";
import { InvoiceUnits, addCustomInvoiceUnit, deleteCustomInvoiceUnit, setActiveInvoiceUnits } from "@/lib/api/invoiceUnits";
import { PaymentAccount, deletePaymentAccount } from "@/lib/api/paymentAccounts";
import { ConfirmDelete, SectionHeader, SectionLoader } from "./shared";

const AddButton = ({ label, onPress, variant = "default" }: { label: string; onPress: () => void; variant?: "default" | "outline" }) => (
  <Button size="sm" variant={variant} className="h-7 px-2.5" textClassName="text-xs" onPress={onPress}>
    <Icon as={Plus} className="w-3 h-3 mr-1.5" />
    {label}
  </Button>
);

function RowActions({ onEdit, onDelete, what }: { onEdit: () => void; onDelete: () => void; what: string }) {
  const { colors } = useTheme();
  return (
    <Box className="flex-row gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8" onPress={onEdit} accessibilityLabel={`Edit ${what}`}>
        <Icon as={Pencil} className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" color={colors.destructive} onPress={onDelete} accessibilityLabel={`Delete ${what}`}>
        <Icon as={Trash2} className="w-3.5 h-3.5" />
      </Button>
    </Box>
  );
}

const EmptyState = ({ icon, children }: { icon: typeof FileText; children: React.ReactNode }) => (
  <Box className="items-center justify-center py-10">
    <Icon as={icon} className="w-8 h-8 text-muted-foreground mb-3" />
    <Txt className="text-sm text-muted-foreground text-center">{children}</Txt>
  </Box>
);

/* ---------------------------------------------------------- Custom fields */

export function InvoiceCustomFieldsSection({ fields, onRefetch, isLoading }: { fields: InvoiceCustomField[]; onRefetch: () => Promise<void>; isLoading: boolean }) {
  const { toast } = useToast();
  const { isOrgOwner, can } = useAuth();
  const canWrite = isOrgOwner || can("organizationSettings", "write");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceCustomField | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState<string[]>([""]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceCustomField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setValues([""]);
    setDialogOpen(true);
  };

  const openEdit = (field: InvoiceCustomField) => {
    setEditing(field);
    setName(field.name);
    setValues(field.predefinedValues.length ? [...field.predefinedValues] : [""]);
    setDialogOpen(true);
  };

  const handleValueChange = (idx: number, value: string) => setValues((prev) => prev.map((v, i) => (i === idx ? value : v)));
  const handleAddValue = () => setValues((prev) => [...prev, ""]);
  const handleRemoveValue = (idx: number) => setValues((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx)));

  const handleSave = async () => {
    const trimmedName = name.trim();
    const cleaned = values.map((v) => v.trim()).filter(Boolean);
    if (!trimmedName) {
      toast({ title: "Name required", description: "Please enter a field name.", variant: "destructive" });
      return;
    }
    if (cleaned.length === 0) {
      toast({ title: "Values required", description: "Add at least one predefined value.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        await updateInvoiceCustomField(editing.id, { name: trimmedName, predefinedValues: cleaned });
        toast({ title: "Custom field updated" });
      } else {
        await createInvoiceCustomField({ name: trimmedName, predefinedValues: cleaned });
        toast({ title: "Custom field created" });
      }
      setDialogOpen(false);
      await onRefetch();
    } catch {
      toast({ title: editing ? "Failed to update" : "Failed to create", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteInvoiceCustomField(deleteTarget.id);
      toast({ title: "Custom field deleted" });
      setDeleteTarget(null);
      await onRefetch();
    } catch {
      toast({ title: "Failed to delete", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <SectionHeader title="Invoices" description="Manage custom fields used on your invoices" action={canWrite && !isLoading ? <AddButton label="Add Custom Field" onPress={openCreate} /> : undefined} />
        <CardContent>
          {isLoading ? (
            <SectionLoader />
          ) : fields.length === 0 ? (
            <EmptyState icon={FileText}>No custom fields yet.{canWrite ? " Add one to provide quick-select values when creating invoices." : ""}</EmptyState>
          ) : (
            <Box className="gap-3">
              {fields.map((field) => (
                <Box key={field.id} className="flex-row items-start justify-between gap-4 p-4 border border-border rounded-lg bg-muted/20">
                  <Box className="flex-1 gap-2">
                    <Txt className="font-medium text-sm">{field.name}</Txt>
                    <Box className="flex-row flex-wrap gap-1.5">
                      {field.predefinedValues.length === 0 ? (
                        <Txt className="text-xs text-muted-foreground">No values</Txt>
                      ) : (
                        field.predefinedValues.map((v, i) => (
                          <Badge key={`${field.id}-${i}`} variant="secondary" textClassName="font-normal">
                            {v}
                          </Badge>
                        ))
                      )}
                    </Box>
                  </Box>
                  {canWrite && <RowActions what="field" onEdit={() => openEdit(field)} onDelete={() => setDeleteTarget(field)} />}
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !isSaving && setDialogOpen(open)}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Custom Field" : "Add Custom Field"}</DialogTitle>
          <DialogDescription>Define a field name and the values that will be suggested when creating invoices.</DialogDescription>
        </DialogHeader>
        <Box className="gap-4 py-2">
          <Box className="gap-2">
            <Label>Field Name</Label>
            <Input value={name} onChangeText={setName} placeholder="e.g. Project Code" />
          </Box>
          <Box className="gap-2">
            <Label>Predefined Values</Label>
            <Box className="gap-2">
              {values.map((v, idx) => (
                <Box key={idx} className="flex-row gap-2">
                  <Input
                    value={v}
                    onChangeText={(t) => handleValueChange(idx, t)}
                    placeholder={`Value ${idx + 1}`}
                    className="flex-1 w-auto"
                    submitBehavior="submit"
                    onSubmitEditing={() => idx === values.length - 1 && v.trim() && handleAddValue()}
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9" onPress={() => handleRemoveValue(idx)} accessibilityLabel="Remove value">
                    <Icon as={X} className="w-4 h-4" />
                  </Button>
                </Box>
              ))}
            </Box>
            <Box className="flex-row">
              <AddButton label="Add value" variant="outline" onPress={handleAddValue} />
            </Box>
          </Box>
        </Box>
        <DialogFooter>
          <Button variant="outline" className="mt-2" onPress={() => setDialogOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onPress={handleSave} disabled={isSaving}>
            {isSaving ? <Spinner className="w-4 h-4 mr-2" /> : null}
            {editing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        title="Delete custom field?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed. This cannot be undone.` : ""}
        busy={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------ Units */

function UnitChip({ label, active, dim, onPress, onRemove, removeLabel }: { label: string; active: boolean; dim?: boolean; onPress?: () => void; onRemove?: () => void; removeLabel?: string }) {
  return (
    <Press
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-row items-center rounded-full border px-2.5 py-0.5 ${active ? "border-transparent bg-secondary" : "border-border"} ${onRemove ? "gap-1 pr-1" : ""} ${dim ? "opacity-60" : ""}`}
    >
      <Txt className={`text-xs ${active ? "text-secondary-foreground" : ""}`}>{label}</Txt>
      {onRemove && (
        <Press onPress={onRemove} hitSlop={6} className="ml-0.5 rounded-full p-0.5" accessibilityLabel={removeLabel}>
          <Icon as={X} className="w-3 h-3" />
        </Press>
      )}
    </Press>
  );
}

export function InvoiceUnitsSection({ units, onRefetch, isLoading }: { units: InvoiceUnits; onRefetch: () => Promise<void>; isLoading: boolean }) {
  const { toast } = useToast();
  const { isOrgOwner, can } = useAuth();
  const canWrite = isOrgOwner || can("organizationSettings", "write");

  const { systemUnits, customUnits, activeUnits } = units;
  const allUnits = [...systemUnits, ...customUnits];

  const [activeSet, setActiveSet] = useState<Set<string>>(new Set(activeUnits));
  const [isPersisting, setIsPersisting] = useState(false);

  useEffect(() => {
    setActiveSet(new Set(activeUnits));
  }, [activeUnits]);

  const [addOpen, setAddOpen] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleActive = async (unit: string, checked: boolean) => {
    if (isPersisting) return;
    const next = new Set(activeSet);
    if (checked) {
      next.add(unit);
    } else {
      if (next.size === 1) {
        toast({ title: "At least one unit required", description: "Keep at least one unit active so the invoice dropdown isn't empty.", variant: "destructive" });
        return;
      }
      next.delete(unit);
    }

    const previous = activeSet;
    setActiveSet(next);
    setIsPersisting(true);
    try {
      await setActiveInvoiceUnits(Array.from(next));
    } catch (err) {
      setActiveSet(previous);
      toast({ title: "Failed to update active units", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsPersisting(false);
    }
  };

  const handleAddUnit = async () => {
    const trimmed = newUnit.trim();
    if (!trimmed) {
      toast({ title: "Unit name required", description: "Please enter a unit name.", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      await addCustomInvoiceUnit(trimmed);
      toast({ title: "Custom unit added" });
      setAddOpen(false);
      setNewUnit("");
      await onRefetch();
    } catch (err) {
      toast({ title: "Failed to add unit", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCustomInvoiceUnit(deleteTarget);
      toast({ title: "Custom unit deleted" });
      setDeleteTarget(null);
      await onRefetch();
    } catch (err) {
      toast({ title: "Failed to delete unit", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const activate = (unit: string) => (canWrite && !isPersisting ? () => toggleActive(unit, true) : undefined);

  return (
    <>
      <Card>
        <SectionHeader title="Invoice Item Units" description="Manage the units available for invoice line items and which ones show up when creating an invoice" />
        <CardContent>
          {isLoading ? (
            <SectionLoader />
          ) : (
            <Box className="gap-6">
              <Box className="gap-3">
                <Box className="flex-row items-start justify-between gap-4">
                  <Box className="flex-1 gap-1">
                    <Txt className="font-medium text-sm">Available Units</Txt>
                    <Txt className="text-xs text-muted-foreground">Built-in units plus any custom units you create.{canWrite ? " Click a unit to add it to your active list." : ""}</Txt>
                  </Box>
                  {canWrite && <AddButton label="Add Custom Unit" variant="outline" onPress={() => setAddOpen(true)} />}
                </Box>
                <Box className="flex-row flex-wrap gap-1.5">
                  {systemUnits.map((unit) => (
                    <UnitChip key={unit} label={unit} active={activeSet.has(unit)} dim={canWrite && isPersisting} onPress={activate(unit)} />
                  ))}
                  {customUnits.map((unit) => (
                    <UnitChip
                      key={unit}
                      label={unit}
                      active={activeSet.has(unit)}
                      dim={canWrite && isPersisting}
                      onPress={activate(unit)}
                      onRemove={canWrite ? () => setDeleteTarget(unit) : undefined}
                      removeLabel={`Delete ${unit}`}
                    />
                  ))}
                </Box>
              </Box>

              <Box className="gap-3 pt-4 border-t border-border">
                <Box className="gap-1">
                  <Txt className="font-medium text-sm">Active Units</Txt>
                  <Txt className="text-xs text-muted-foreground">These units will be shown in the dropdown when creating invoice line items.{canWrite ? " Click × to remove one." : ""}</Txt>
                </Box>
                <Box className="flex-row flex-wrap gap-1.5">
                  {allUnits
                    .filter((unit) => activeSet.has(unit))
                    .map((unit) => (
                      <UnitChip key={unit} label={unit} active onRemove={canWrite && !isPersisting ? () => toggleActive(unit, false) : undefined} removeLabel={`Deactivate ${unit}`} />
                    ))}
                </Box>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={(open) => !isAdding && setAddOpen(open)}>
        <DialogHeader>
          <DialogTitle>Add Custom Unit</DialogTitle>
          <DialogDescription>Create a unit that will be added to your Available Units list.</DialogDescription>
        </DialogHeader>
        <Box className="gap-2 py-2">
          <Label>Unit Name</Label>
          <Input value={newUnit} onChangeText={setNewUnit} placeholder="e.g. Pallets" maxLength={50} onSubmitEditing={() => newUnit.trim() && handleAddUnit()} />
        </Box>
        <DialogFooter>
          <Button variant="outline" className="mt-2" onPress={() => setAddOpen(false)} disabled={isAdding}>
            Cancel
          </Button>
          <Button onPress={handleAddUnit} disabled={isAdding}>
            {isAdding ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Add
          </Button>
        </DialogFooter>
      </Dialog>

      <ConfirmDelete
        open={!!deleteTarget}
        title="Delete custom unit?"
        description={deleteTarget ? `"${deleteTarget}" will be removed from Available Units. This cannot be undone.` : ""}
        busy={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUnit}
      />
    </>
  );
}

/* ------------------------------------------------------- Payment accounts */

const DETAIL_FIELDS: { key: keyof Omit<PaymentAccount, "id" | "nickname">; label: string }[] = [
  { key: "bankName", label: "Bank" },
  { key: "accountName", label: "Account name" },
  { key: "accountNumber", label: "Account no. / IBAN" },
  { key: "ifsc", label: "IFSC" },
  { key: "swift", label: "SWIFT/BIC" },
  { key: "bankAddress", label: "Bank address" },
];

export function PaymentAccountsSection({ accounts, onRefetch, isLoading }: { accounts: PaymentAccount[]; onRefetch: () => Promise<void>; isLoading: boolean }) {
  const { toast } = useToast();
  const { isOrgOwner, can } = useAuth();
  const canWrite = isOrgOwner || can("organizationSettings", "write");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePaymentAccount(deleteTarget.id);
      toast({ title: "Payment details deleted" });
      setDeleteTarget(null);
      await onRefetch();
    } catch (err) {
      toast({ title: "Failed to delete", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <SectionHeader
          title="Payment / Bank Details"
          description="Save the accounts you get paid into, then pick one while creating an invoice"
          action={
            canWrite && !isLoading ? (
              <AddButton
                label="Add Payment Details"
                onPress={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              />
            ) : undefined
          }
        />
        <CardContent>
          {isLoading ? (
            <SectionLoader />
          ) : accounts.length === 0 ? (
            <EmptyState icon={Landmark}>No saved payment details yet.{canWrite ? " Add a set to stop retyping them on every invoice." : ""}</EmptyState>
          ) : (
            <Box className="gap-3">
              {accounts.map((account) => (
                <Box key={account.id} className="flex-row items-start justify-between gap-4 p-4 border border-border rounded-lg bg-muted/20">
                  <Box className="flex-1 gap-2">
                    <Txt className="font-medium text-sm">{account.nickname}</Txt>
                    <Box className="gap-1">
                      {DETAIL_FIELDS.filter(({ key }) => account[key]).map(({ key, label }) => (
                        <Txt key={key} numberOfLines={1} className="text-xs text-muted-foreground">
                          <Txt className="font-medium text-foreground/70">{label}:</Txt> {account[key]}
                        </Txt>
                      ))}
                    </Box>
                  </Box>
                  {canWrite && (
                    <RowActions
                      what="payment details"
                      onEdit={() => {
                        setEditing(account);
                        setDialogOpen(true);
                      }}
                      onDelete={() => setDeleteTarget(account)}
                    />
                  )}
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <PaymentAccountFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={onRefetch} />

      <ConfirmDelete
        open={!!deleteTarget}
        title="Delete payment details?"
        description={deleteTarget ? `"${deleteTarget.nickname}" will no longer be offered on new invoices. Invoices already using it keep the details they were issued with.` : ""}
        busy={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
