import { useState } from "react";
import { Building2, Globe, Hash, Home, LucideIcon, Mail, MapPin, Phone, Receipt, User } from "lucide-react-native";
import { Box, Button, Dialog, DialogHeader, DialogTitle, Icon, Input, Select, Spinner, Txt } from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { createClient, type ClientData } from "@/lib/api/clients";
import { INDIAN_STATES } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";
import { getTaxLabel, getTaxSystem } from "@/lib/taxSystem";

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: (client: ClientData) => void;
}

export const IconLabel = ({ icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
  <Box className="flex-row items-center gap-2">
    <Icon as={icon} className="w-3.5 h-3.5 text-muted-foreground" />
    <Txt className="text-sm leading-[14px] font-medium">{children}</Txt>
  </Box>
);

const EMPTY = { name: "", email: "", phone: "", streetAddress: "", city: "", state: "", zipCode: "", country: "", taxId: "" };

const AddClientDialog = ({ open, onOpenChange, onClientCreated }: AddClientDialogProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const reset = () => setForm(EMPTY);

  const handleSave = async () => {
    const required: { key: keyof typeof form; label: string }[] = [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "streetAddress", label: "Street Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "zipCode", label: "Zip Code" },
      { key: "country", label: "Country" },
    ];
    const missing = required.find((f) => !form[f.key].trim());
    if (missing) {
      toast({ title: `${missing.label} required`, description: `Please enter ${missing.label.toLowerCase()}.`, variant: "destructive" });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const created = await createClient({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        streetAddress: form.streetAddress || null,
        city: form.city || null,
        state: form.state || null,
        zipCode: form.zipCode || null,
        country: form.country || null,
        taxId: form.taxId || null,
        taxSystem: getTaxSystem(form.country) || null,
      });
      toast({ title: "Client created", description: "New client has been added." });
      onClientCreated(created);
      reset();
      onOpenChange(false);
    } catch {
      toast({ title: "Save failed", description: "Could not create client.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const incomplete =
    !form.name.trim() || !form.email.trim() || !form.streetAddress.trim() || !form.city.trim() || !form.state.trim() || !form.zipCode.trim() || !form.country.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogHeader>
        <DialogTitle>Add New Client</DialogTitle>
      </DialogHeader>
      <Box className="gap-4">
        <Box className="gap-2">
          <IconLabel icon={User}>Name *</IconLabel>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Client name" />
        </Box>
        <Box className="flex-row gap-3">
          <Box className="flex-1 gap-2">
            <IconLabel icon={Mail}>Email *</IconLabel>
            <Input type="email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
          </Box>
          <Box className="flex-1 gap-2">
            <IconLabel icon={Phone}>Phone</IconLabel>
            <Input type="tel" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
          </Box>
        </Box>
        <Box className="gap-2">
          <IconLabel icon={Home}>Street Address *</IconLabel>
          <Input value={form.streetAddress} onChangeText={(v) => setForm({ ...form, streetAddress: v })} />
        </Box>
        <Box className="flex-row gap-3">
          <Box className="flex-1 gap-2">
            <IconLabel icon={Building2}>City *</IconLabel>
            <Input value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
          </Box>
          <Box className="flex-1 gap-2">
            <IconLabel icon={MapPin}>State *</IconLabel>
            {form.country === "India" ? (
              <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })} options={INDIAN_STATES} placeholder="Select state" />
            ) : (
              <Input value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
            )}
          </Box>
        </Box>
        <Box className="flex-row gap-3">
          <Box className="flex-1 gap-2">
            <IconLabel icon={Hash}>Zip Code *</IconLabel>
            <Input value={form.zipCode} onChangeText={(v) => setForm({ ...form, zipCode: v })} />
          </Box>
          <Box className="flex-1 gap-2">
            <IconLabel icon={Globe}>Country *</IconLabel>
            <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v, state: "" })} options={COUNTRIES} placeholder="Select country" />
          </Box>
        </Box>
        <Box className="gap-2">
          <IconLabel icon={Receipt}>{getTaxLabel(form.country)}</IconLabel>
          <Input value={form.taxId} onChangeText={(v) => setForm({ ...form, taxId: v })} placeholder="Enter tax identification number" />
        </Box>
        <Box className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onPress={handleSave} disabled={isSaving || incomplete}>
            {isSaving && <Spinner className="w-4 h-4 mr-2" />}
            Save Client
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default AddClientDialog;
