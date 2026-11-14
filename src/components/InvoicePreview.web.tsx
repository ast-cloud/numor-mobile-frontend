// Browser build only (used for previews during development): an iframe instead of a native web view.
import { createElement, useMemo, useState } from "react";
import { View } from "react-native";
import { renderInvoiceHtml, type InvoiceFormData } from "@/lib/invoiceTemplateRenderer";

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

const InvoicePreviewWrapper = ({ formData }: { formData: InvoiceFormData }) => {
  const [width, setWidth] = useState(0);
  const html = useMemo(() => renderInvoiceHtml(formData), [formData]);
  const scale = width > 0 ? Math.min(width / PAGE_WIDTH, 1) : 0;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: "100%", height: PAGE_HEIGHT * (scale || 0.4), overflow: "hidden", borderRadius: 8, backgroundColor: "#ffffff" }}>
      {scale > 0 &&
        createElement("iframe", {
          srcDoc: html,
          title: "Invoice Preview",
          style: { border: "none", width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" },
        })}
    </View>
  );
};

export default InvoicePreviewWrapper;
