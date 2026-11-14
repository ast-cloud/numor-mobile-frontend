import React, { useEffect, useRef } from "react";
import { Animated, Image, Platform, ScrollView, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, CheckCircle2, ChevronDown, MapPin, Plus, Settings2, Trash2, Upload } from "lucide-react-native";
import AddClientDialog from "@/components/AddClientDialog";
import InvoicePreviewWrapper from "@/components/InvoicePreview";
import PaymentAccountFormDialog from "@/components/PaymentAccountFormDialog";
import { Box, Button, ButtonProps, Calendar, Checkbox, Dialog, Icon, Input, Label, Popover, Press, Select, Spinner, Textarea, Txt } from "@/components/ui";
import { CreateInvoiceDialogProps, getTaxOptions, hasTaxDropdown, maskAccountNumber, useInvoiceForm } from "@/hooks/use-invoice-form";
import { useTheme } from "@/hooks/use-theme";
import { formatMoney } from "@/lib/amountInWords";
import { INDIAN_STATES } from "@/lib/constants";
import { SELLER_COUNTRY_OPTIONS } from "@/lib/countries";
import { getTaxLabel } from "@/lib/taxSystem";

/** Button that shakes when `active` flips on (web: animate-jiggle on a failed submit). */
function JiggleButton({ jiggleKey, active, ...props }: ButtonProps & { jiggleKey: number; active: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    Animated.sequence(
      [-4, 4, -3, 3, 0].map((v) => Animated.timing(x, { toValue: v, duration: 60, useNativeDriver: Platform.OS !== "web" })),
    ).start();
  }, [jiggleKey, active, x]);
  return (
    <Animated.View style={{ transform: [{ translateX: x }] }}>
      <Button {...props} />
    </Animated.View>
  );
}

function DateButton({ value, onChange, open, setOpen }: { value?: Date; onChange: (d: Date | undefined) => void; open: boolean; setOpen: (o: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="p-0"
      trigger={({ ref, toggle }) => (
        <Button ref={ref} variant="outline" className="w-full justify-start" textClassName="font-normal" color={value ? undefined : colors["muted-foreground"]} onPress={toggle}>
          <Icon as={CalendarIcon} className="mr-2 h-4 w-4" />
          {value ? format(value, "dd MMM yyyy") : "Select date"}
        </Button>
      )}
    >
      <Calendar
        mode="single"
        selected={value}
        defaultMonth={value}
        onSelect={(date) => {
          onChange(date);
          setOpen(false);
        }}
      />
    </Popover>
  );
}

function Avatar({ uri, size, children }: { uri?: string; size: number; children: React.ReactNode }) {
  return (
    <Box className="rounded-full border border-border bg-muted items-center justify-center overflow-hidden" style={{ width: size, height: size }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" /> : children}
    </Box>
  );
}

/** Radio-style card used for saved clients and saved payment details. */
function ChoiceCard({ selected, onPress, title, lines }: { selected: boolean; onPress: () => void; title: string; lines: (string | false | null | undefined)[] }) {
  return (
    <Press
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      activeOpacity={0.85}
      className={`rounded-lg border-2 p-3 ${selected ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <Box className="flex-row items-start gap-2">
        {selected ? <Icon as={CheckCircle2} className="h-4 w-4 mt-0.5 text-primary" /> : <Box className="h-4 w-4 mt-0.5 rounded-full border-2 border-muted-foreground/40" />}
        <Box className="flex-1 gap-0.5">
          <Txt numberOfLines={1} className="text-sm font-medium">
            {title}
          </Txt>
          {lines.filter(Boolean).map((l, i) => (
            <Txt key={i} numberOfLines={1} className="text-xs text-muted-foreground">
              {l}
            </Txt>
          ))}
        </Box>
      </Box>
    </Press>
  );
}

const AddNewCard = ({ onPress }: { onPress: () => void }) => (
  <Press onPress={onPress} className="items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border p-3 min-h-[92px]" activeClassName="border-primary/40 bg-muted/40">
    <Icon as={Plus} className="h-5 w-5 text-muted-foreground" />
    <Txt className="text-sm font-medium">Add New</Txt>
  </Press>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => <Txt className="font-display font-medium">{children}</Txt>;

const CreateInvoiceDialog = (props: CreateInvoiceDialogProps) => {
  const f = useInvoiceForm(props);
  const { width } = useWindowDimensions();
  const { formData } = f;
  const sideMargin = width * 0.025; // w-[95vw]

  const pickSellerLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    // A data URL, like the web's FileReader, so the logo also renders inside the invoice preview.
    f.handleSellerChange("logo", a.base64 ? `data:${a.mimeType || "image/jpeg"};base64,${a.base64}` : a.uri);
  };

  const isCrossBorder = !!(formData.seller.country && formData.clientCountry && formData.seller.country !== formData.clientCountry);
  const taxSummary = f.buildTaxSummary();
  const totalRow = (label: string, value: string, strong?: boolean) => (
    <Box key={label} className="flex-row justify-end gap-8">
      <Txt className={strong ? "text-base font-semibold" : "text-sm text-muted-foreground"}>{label}</Txt>
      <Txt className={`w-24 text-right ${strong ? "text-base font-semibold" : "text-sm font-medium"}`}>{value}</Txt>
    </Box>
  );

  const flaggedMissingDesc = formData.lineItems.some((i) => f.submittedItemIds.includes(i.id) && !i.description.trim());
  const showClientError = !f.hasClientSelected;
  const showNoItems = f.attemptedAction === "create" && !f.hasAtLeastOneItem;

  return (
    <>
      {!f.isEditMode && !f.isPrefillMode && (
        <Button size="icon" className="h-9 w-9 rounded-lg" onPress={() => f.handleOpenChange(true)} accessibilityLabel="Create invoice">
          <Icon as={Plus} className="h-5 w-5" />
        </Button>
      )}

      <Dialog
        open={f.open}
        onOpenChange={f.handleOpenChange}
        sideMargin={sideMargin}
        className="max-w-4xl"
        maxHeightRatio={0.95}
        heightRatio={f.showPreview && !f.editLoading ? 0.85 : undefined}
        scrollRef={f.formScrollRef}
        contentClassName="px-6"
      >
        {f.editLoading ? (
          <Box className="items-center justify-center h-64">
            <Spinner className="h-6 w-6 text-primary" />
          </Box>
        ) : f.showPreview ? (
          <Box className="flex-1">
            <Box className="px-6 pt-6 pb-4 flex-row items-center gap-2 justify-center">
              <Button variant="ghost" size="icon" className="h-8 w-8" onPress={f.handleBackToForm} accessibilityLabel="Back">
                <Icon as={ArrowLeft} className="h-4 w-4" />
              </Button>
              <Txt className="font-display text-xl font-semibold">Invoice Preview</Txt>
            </Box>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
              <InvoicePreviewWrapper formData={formData as never} />
            </ScrollView>

            <Box className="gap-3 p-6 border-t border-border">
              <Press className="flex-row items-center gap-2" activeOpacity={1} onPress={() => f.setSendEmail(!f.sendEmail)}>
                <Checkbox checked={f.sendEmail} onCheckedChange={f.setSendEmail} />
                <Txt className="text-sm">Share Invoice with client on email</Txt>
              </Press>
              <Box className="flex-row flex-wrap justify-end gap-3">
                <Button variant="outline" onPress={f.handleBackToForm}>
                  Back to Edit
                </Button>
                <Button onPress={f.handleConfirmInvoice} disabled={f.confirmingInvoice}>
                  {f.confirmingInvoice ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  {f.confirmingInvoice ? "Generating PDF..." : "Confirm & Create Invoice"}
                </Button>
              </Box>
            </Box>
          </Box>
        ) : (
          <>
            <Box className="py-6 items-center">
              <Txt className="font-display text-xl font-semibold text-center">
                {f.isEditMode ? "Edit Draft Invoice" : f.isPrefillMode ? "Edit & Re-share Invoice" : "Create New Invoice"}
              </Txt>
            </Box>

            <Box className="gap-6 pb-6">
              {/* Dates */}
              <Box className="flex-row gap-4">
                <Box className="flex-1 gap-2">
                  <Label>Invoice Date</Label>
                  <DateButton value={formData.invoiceDate} onChange={(d) => f.handleInputChange("invoiceDate", d)} open={f.invoiceDateOpen} setOpen={f.setInvoiceDateOpen} />
                </Box>
                <Box className="flex-1 gap-2">
                  <Label>Due Date</Label>
                  <DateButton value={formData.dueDate} onChange={(d) => f.handleInputChange("dueDate", d)} open={f.dueDateOpen} setOpen={f.setDueDateOpen} />
                </Box>
              </Box>

              {/* Currency & tax type */}
              <Box className="flex-row gap-4">
                <Box className="gap-2 flex-shrink">
                  <Label>Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => f.handleInputChange("currency", v)} options={["USD", "EUR", "GBP", "AED", "INR"]} placeholder="Select currency" className="w-[150px]" />
                </Box>
                <Box className="gap-2 flex-shrink">
                  <Label>Tax Type</Label>
                  <Select value={formData.taxType} onValueChange={(v) => f.handleInputChange("taxType", v)} options={["VAT", "GST", "Sales Tax", "None"]} placeholder="Select tax type" className="w-[150px]" />
                </Box>
              </Box>

              {/* Seller */}
              <Box className="gap-2">
                <SectionTitle>Seller Information</SectionTitle>
                <Box className="border border-border rounded-lg overflow-hidden">
                  <Press className="flex-row items-center justify-between p-4" activeClassName="bg-muted/50" onPress={() => f.setSellerExpanded(!f.sellerExpanded)}>
                    <Box className="flex-1 flex-row items-center gap-3">
                      <Avatar uri={formData.seller.logo} size={40}>
                        <Txt className="text-xs">{formData.seller.name ? formData.seller.name.charAt(0).toUpperCase() : "S"}</Txt>
                      </Avatar>
                      <Box className="flex-1">
                        <Txt numberOfLines={1} className="font-medium text-sm">
                          {formData.seller.name || "Seller Information"}
                        </Txt>
                        <Txt numberOfLines={1} className="text-xs text-muted-foreground">
                          {formData.seller.email || "No email set"}
                        </Txt>
                      </Box>
                    </Box>
                    <Box style={{ transform: [{ rotate: f.sellerExpanded ? "180deg" : "0deg" }] }}>
                      <Icon as={ChevronDown} className="h-4 w-4 text-muted-foreground" />
                    </Box>
                  </Press>

                  {f.sellerExpanded && (
                    <Box className="px-4 pb-4 gap-4 border-t border-border">
                      <Box className="flex-row items-start gap-4 pt-4">
                        <Press className="items-center gap-2" onPress={pickSellerLogo}>
                          <Avatar uri={formData.seller.logo} size={64}>
                            <Icon as={Upload} className="h-6 w-6 text-muted-foreground" />
                          </Avatar>
                          <Txt className="text-xs text-muted-foreground">Upload Logo</Txt>
                        </Press>
                        <Box className="flex-1 gap-4">
                          <Box className="gap-2">
                            <Label>Name</Label>
                            <Input placeholder="e.g. Acme Corporation LLC" value={formData.seller.name} onChangeText={(v) => f.handleSellerChange("name", v)} />
                          </Box>
                          <Box className="gap-2">
                            <Label>{getTaxLabel(formData.seller.country)}</Label>
                            <Input placeholder="e.g. TRN-100234567890003" value={formData.seller.taxId} onChangeText={(v) => f.handleSellerChange("taxId", v)} />
                          </Box>
                          <Box className="gap-2">
                            <Label>Email</Label>
                            <Input type="email" placeholder="e.g. billing@acmecorp.com" value={formData.seller.email} onChangeText={(v) => f.handleSellerChange("email", v)} />
                            {f.attemptedSubmit && !f.sellerEmailValid && <Txt className="text-xs text-destructive">Enter a valid email address, or leave it blank.</Txt>}
                          </Box>
                          <Box className="gap-2">
                            <Label>Phone Number</Label>
                            <Input type="tel" placeholder="e.g. +971 4 123 4567" value={formData.seller.phone} onChangeText={(v) => f.handleSellerChange("phone", v)} />
                          </Box>
                          <Box className="gap-4 p-4 border border-border rounded-lg bg-muted/20">
                            <Box className="flex-row items-center gap-2">
                              <Icon as={MapPin} className="w-4 h-4 text-muted-foreground" />
                              <Txt className="text-sm font-medium text-muted-foreground">Business Address</Txt>
                            </Box>
                            <Box className="gap-4">
                              <Box className="gap-2">
                                <Label>Street Address</Label>
                                <Input placeholder="e.g. 123 Business Street, Suite 100" value={formData.seller.streetAddress} onChangeText={(v) => f.handleSellerChange("streetAddress", v)} />
                              </Box>
                              <Box className="gap-2">
                                <Label>City</Label>
                                <Input placeholder="e.g. Dubai" value={formData.seller.city} onChangeText={(v) => f.handleSellerChange("city", v)} />
                              </Box>
                              <Box className="gap-2">
                                <Label>State / Province</Label>
                                {formData.seller.country === "India" ? (
                                  <Select value={formData.seller.state} onValueChange={(v) => f.handleSellerChange("state", v)} options={INDIAN_STATES} placeholder="Select state" />
                                ) : (
                                  <Input placeholder="e.g. Dubai" value={formData.seller.state} onChangeText={(v) => f.handleSellerChange("state", v)} />
                                )}
                              </Box>
                              <Box className="gap-2">
                                <Label>ZIP / Postal Code</Label>
                                <Input placeholder="e.g. 00000" value={formData.seller.zip} onChangeText={(v) => f.handleSellerChange("zip", v)} />
                              </Box>
                              <Box className="gap-2">
                                <Label>Country</Label>
                                <Select value={formData.seller.country} onValueChange={(v) => f.handleSellerChange("country", v)} options={SELLER_COUNTRY_OPTIONS} placeholder="Select country" />
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Custom fields */}
              <Box className="p-3 border border-border rounded-lg bg-muted/20 gap-3">
                <Box className="flex-row items-center gap-2">
                  <Icon as={Settings2} className="w-4 h-4 text-muted-foreground" />
                  <Txt className="text-sm font-medium text-muted-foreground">Custom Fields</Txt>
                </Box>

                {f.orgCustomFieldDefs.length > 0 && (
                  <Box className="gap-2">
                    {f.orgCustomFieldDefs.map((def) => {
                      const selected = formData.customFields.find((cf) => cf.definitionId === def.id);
                      const isChecked = !!selected;
                      return (
                        <Box key={def.id} className="gap-2">
                          <Press className="flex-row items-center gap-2" activeOpacity={1} onPress={() => f.toggleCustomField(def, !isChecked)}>
                            <Checkbox checked={isChecked} onCheckedChange={(c) => f.toggleCustomField(def, c)} />
                            <Txt className="text-xs">{def.name}</Txt>
                          </Press>
                          {isChecked ? (
                            def.predefinedValues.length > 0 ? (
                              <Select
                                value={selected?.value ?? ""}
                                onValueChange={(v) => f.setCustomFieldValue(def.id, v)}
                                placeholder="Select a value"
                                className="h-8"
                                textClassName="text-xs"
                                options={[...def.predefinedValues, ...(selected?.value && !def.predefinedValues.includes(selected.value) ? [selected.value] : [])]}
                              />
                            ) : (
                              <Input className="h-8 text-xs" placeholder="Enter a value" value={selected?.value ?? ""} onChangeText={(v) => f.setCustomFieldValue(def.id, v)} />
                            )
                          ) : (
                            <Txt className="text-xs text-muted-foreground">Not included</Txt>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {f.orgCustomFieldDefs.length === 0 && f.adhocCustomFields.length === 0 && (
                  <Txt className="text-sm text-muted-foreground">No custom fields configured. Add one below for this invoice only.</Txt>
                )}

                {f.adhocCustomFields.length > 0 && (
                  <Box className="gap-2">
                    {f.adhocCustomFields.map((field) => (
                      <Box key={field.uid} className="gap-2">
                        <Input className="h-8 text-xs" placeholder="Field name" value={field.name} onChangeText={(v) => f.updateAdhocCustomField(field.uid, { name: v })} />
                        <Input className="h-8 text-xs" placeholder="Enter a value" value={field.value} onChangeText={(v) => f.updateAdhocCustomField(field.uid, { value: v })} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" accessibilityLabel="Remove custom field" onPress={() => f.removeAdhocCustomField(field.uid)}>
                          <Icon as={Trash2} className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}

                <Button variant="outline" size="sm" className="h-7 self-start" textClassName="text-xs" onPress={f.addAdhocCustomField}>
                  <Icon as={Plus} className="h-3 w-3 mr-1.5" />
                  Add custom field
                </Button>
              </Box>

              {/* Client */}
              <Box className="gap-3">
                <SectionTitle>Select Client</SectionTitle>
                <Box className="gap-3">
                  {f.savedClients.map((client) => {
                    const taxId = client.taxId || client.gstin;
                    return (
                      <ChoiceCard
                        key={client.id}
                        selected={f.selectedClientId === client.id}
                        onPress={() => f.handleClientSelect(client.id)}
                        title={client.name}
                        lines={[client.email, [client.city, client.state, client.country].filter(Boolean).join(", "), taxId && `GSTIN: ${taxId}`]}
                      />
                    );
                  })}
                  {f.canAddClient && <AddNewCard onPress={() => f.setAddClientOpen(true)} />}
                </Box>
                {!f.selectedClientId && !!formData.clientName.trim() && (
                  <Txt className="text-xs text-muted-foreground">
                    This invoice is billed to {formData.clientName.trim()}
                    {formData.clientEmail.trim() ? ` (${formData.clientEmail.trim()})` : ""}, who is no longer in your saved clients. Choosing one above replaces them.
                  </Txt>
                )}
                {f.attemptedSubmit && !f.hasClientSelected && <Txt className="text-xs text-destructive">Please select a client.</Txt>}
              </Box>

              {/* Line items */}
              <Box className="gap-4">
                <Box className="flex-row items-center justify-between">
                  <SectionTitle>Line Items</SectionTitle>
                  <Button variant="outline" size="sm" onPress={f.addLineItem}>
                    <Icon as={Plus} className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </Box>

                <Box className="border border-border rounded-lg overflow-hidden">
                  <Box className="bg-muted p-3">
                    <Txt className="text-sm font-medium">Items</Txt>
                  </Box>

                  {/* The web lays these seven columns out in one row, which leaves each field a few
                      characters wide on a phone. Here every item is a small stacked form instead. */}
                  {formData.lineItems.map((item, idx) => (
                    <Box key={item.id} className="border-t border-border p-3 gap-2">
                      <Box className="flex-row items-center justify-between">
                        <Txt className="text-xs font-medium text-muted-foreground">Item {idx + 1}</Txt>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onPress={() => f.removeLineItem(item.id)} accessibilityLabel={`Remove item ${idx + 1}`}>
                          <Icon as={Trash2} className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </Box>
                      <Box>
                        <Input placeholder="Description" value={item.description} onChangeText={(v) => f.handleLineItemChange(item.id, "description", v)} />
                        {f.attemptedSubmit && f.submittedItemIds.includes(item.id) && !item.description.trim() && (
                          <Txt className="text-xs text-destructive mt-1">Description is required.</Txt>
                        )}
                      </Box>
                      <Box className="flex-row gap-2">
                        <Box className="flex-1 gap-1">
                          <Txt className="text-xs text-muted-foreground">Qty</Txt>
                          <LineNumberInput value={item.quantity} onChange={(n) => f.handleLineItemChange(item.id, "quantity", n)} />
                        </Box>
                        <Box className="flex-1 gap-1">
                          <Txt className="text-xs text-muted-foreground">Unit</Txt>
                          <Select
                            value={item.unit}
                            onValueChange={(v) => f.handleLineItemChange(item.id, "unit", v)}
                            options={f.unitOptions.includes(item.unit) ? f.unitOptions : [item.unit, ...f.unitOptions]}
                          />
                        </Box>
                      </Box>
                      <Box className="flex-row gap-2">
                        <Box className="flex-1 gap-1">
                          <Txt className="text-xs text-muted-foreground">Rate</Txt>
                          <LineNumberInput value={item.rate} blankWhenZero placeholder="0.00" onChange={(n) => f.handleLineItemChange(item.id, "rate", n)} />
                        </Box>
                        <Box className="flex-1 gap-1">
                          <Txt className="text-xs text-muted-foreground">Tax %</Txt>
                          {isCrossBorder ? (
                            <Input value="0" disabled className="bg-muted" />
                          ) : hasTaxDropdown(formData.seller.country) ? (
                            <Select
                              value={String(item.taxPercent)}
                              onValueChange={(v) => f.handleLineItemChange(item.id, "taxPercent", parseFloat(v))}
                              options={getTaxOptions(formData.seller.country).map((t) => ({ value: String(t), label: `${t}%` }))}
                              contentClassName="min-w-[70px]"
                            />
                          ) : (
                            <LineNumberInput value={item.taxPercent} onChange={(n) => f.handleLineItemChange(item.id, "taxPercent", n)} />
                          )}
                        </Box>
                      </Box>
                      <Box className="flex-row justify-between items-center pt-1">
                        <Txt className="text-sm text-muted-foreground">Total</Txt>
                        <Txt className="font-medium">{formatMoney(f.calculateLineTotal(item), formData.currency)}</Txt>
                      </Box>
                    </Box>
                  ))}

                  {formData.lineItems.length === 0 && (
                    <Box className="border-t border-border p-8 items-center">
                      <Button variant="outline" size="icon" onPress={f.addLineItem} accessibilityLabel="Add the first item" className="h-10 w-10 rounded-full border-2 border-dashed border-border">
                        <Icon as={Plus} className="h-5 w-5" />
                      </Button>
                    </Box>
                  )}

                  <Box className="border-t border-border bg-muted/50 p-3 gap-2">
                    {totalRow("Subtotal:", `${formData.currency} ${formatMoney(f.calculateSubtotal(), formData.currency)}`)}
                    {taxSummary
                      ? Object.entries(taxSummary).map(([label, { rate, amount }]) => totalRow(`${label} (${rate}%):`, `${formData.currency} ${formatMoney(amount, formData.currency)}`))
                      : totalRow(
                          `${formData.taxType && formData.taxType !== "None" ? formData.taxType : "Tax"}${isCrossBorder ? " (0%)" : ""}:`,
                          `${formData.currency} ${isCrossBorder ? formatMoney(0, formData.currency) : formatMoney(f.calculateTotalTax(), formData.currency)}`,
                        )}
                    {totalRow("Total:", `${formData.currency} ${formatMoney(f.calculateTotal(), formData.currency)}`, true)}
                  </Box>
                </Box>
              </Box>

              {/* Bank / payment details */}
              <Box className="gap-3">
                <SectionTitle>Bank / Payment Details</SectionTitle>
                <Txt className="text-sm text-muted-foreground">Select from saved accounts or add a new one:</Txt>
                <Box className="gap-3">
                  {f.paymentAccounts.map((account) => {
                    const masked = maskAccountNumber(account.accountNumber);
                    const code = account.ifsc ? `IFSC Code: ${account.ifsc}` : account.swift ? `SWIFT/BIC: ${account.swift}` : "";
                    return (
                      <ChoiceCard
                        key={account.id}
                        selected={f.selectedPaymentAccount?.id === account.id}
                        onPress={() => f.handlePaymentAccountSelect(account.id)}
                        title={account.nickname}
                        lines={[(account.bankName || masked) && [account.bankName, masked].filter(Boolean).join(" - "), account.accountName, code]}
                      />
                    );
                  })}
                  <AddNewCard onPress={() => f.setPaymentAccountDialogOpen(true)} />
                </Box>
                {!f.selectedPaymentAccount && !!f.legacyBankSummary && (
                  <Txt className="text-xs text-muted-foreground">
                    This invoice carries details entered earlier: {f.legacyBankSummary}. Choosing a saved account above replaces them.
                  </Txt>
                )}
              </Box>

              {/* Notes */}
              <Box className="gap-2">
                <Label>Notes / Terms</Label>
                <Textarea placeholder="e.g. Payment due within 14 days of invoice date..." value={formData.notes} onChangeText={(v) => f.handleInputChange("notes", v)} />
              </Box>

              {/* Actions */}
              <Box className="items-end gap-2 pt-4 pb-6 border-t border-border">
                <Box className="flex-row justify-end gap-3">
                  <Button variant="outline" onPress={() => f.handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <JiggleButton jiggleKey={f.jiggleKey} active={f.attemptedAction === "draft"} variant="secondary" onPress={f.handleSaveAsDraft} disabled={f.savingDraft}>
                    {f.savingDraft ? "Saving..." : "Save as Draft"}
                  </JiggleButton>
                  <JiggleButton jiggleKey={f.jiggleKey} active={f.attemptedAction === "create"} onPress={f.handlePreview}>
                    Create Invoice
                  </JiggleButton>
                </Box>
                {f.attemptedAction && (showClientError || showNoItems || flaggedMissingDesc) && (
                  <Box className="gap-0.5 items-end">
                    {showClientError && (
                      <Txt className="text-xs text-destructive text-right">
                        Please select a client before{f.attemptedAction === "draft" ? " saving the draft." : " creating the invoice."}
                      </Txt>
                    )}
                    {showNoItems && <Txt className="text-xs text-destructive text-right">Add at least one item.</Txt>}
                    {!showNoItems && flaggedMissingDesc && <Txt className="text-xs text-destructive text-right">Description is required for all items.</Txt>}
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}
      </Dialog>

      <AddClientDialog open={f.addClientOpen} onOpenChange={f.setAddClientOpen} onClientCreated={f.handleClientCreated} />
      <PaymentAccountFormDialog open={f.paymentAccountDialogOpen} onOpenChange={f.setPaymentAccountDialogOpen} onSaved={f.handlePaymentAccountCreated} />
    </>
  );
};

/** Numeric field that keeps what the user is typing (e.g. "12.") while reporting a number. */
function LineNumberInput({ value, onChange, blankWhenZero, placeholder }: { value: number; onChange: (n: number) => void; blankWhenZero?: boolean; placeholder?: string }) {
  const [text, setText] = React.useState(blankWhenZero && !value ? "" : String(value));
  useEffect(() => {
    if ((parseFloat(text) || 0) !== value) setText(blankWhenZero && !value ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      type="number"
      placeholder={placeholder}
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(",", ".").replace(/[^0-9.]/g, "");
        setText(clean);
        onChange(parseFloat(clean) || 0);
      }}
    />
  );
}

export default CreateInvoiceDialog;
