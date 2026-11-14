import { useMemo, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { renderInvoiceHtml, type InvoiceFormData } from "@/lib/invoiceTemplateRenderer";

// A4 at 96dpi, the size the invoice template is designed for.
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

/** Scales the fixed-size A4 page down to the available width, like the web preview does. */
export const scaledHtml = (html: string, scale: number) => {
  const inject = `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>html{width:${PAGE_WIDTH}px;transform-origin:0 0;transform:scale(${scale});}body{margin:0;background:#fff;}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${inject}</head>`) : `${inject}${html}`;
};

/**
 * The same invoice.html template the website renders, filled by the same renderer and
 * shown in a web view, so the preview matches the PDF the backend generates.
 */
const InvoicePreviewWrapper = ({ formData }: { formData: InvoiceFormData }) => {
  const [width, setWidth] = useState(0);
  const html = useMemo(() => renderInvoiceHtml(formData), [formData]);
  const scale = width > 0 ? Math.min(width / PAGE_WIDTH, 1) : 0;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: "100%", height: scale > 0 ? PAGE_HEIGHT * scale : PAGE_HEIGHT * 0.4, overflow: "hidden", borderRadius: 8, backgroundColor: "#ffffff" }}>
      {scale > 0 && (
        <WebView
          originWhitelist={["*"]}
          source={{ html: scaledHtml(html, scale) }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          javaScriptEnabled={false}
          style={{ flex: 1, backgroundColor: "#ffffff" }}
        />
      )}
    </View>
  );
};

export default InvoicePreviewWrapper;
