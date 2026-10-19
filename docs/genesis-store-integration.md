# DOOM404 Genesis Store — production integration checklist

Status: prototype only. Branch: feature/doom404-genesis-merch. No live sales or checkout.

## Products
- GLITCH TEE: print-on-demand candidate; supplier SKU, sizes, colors and print areas TBD.
- SYSTEM HOODIE: print-on-demand candidate; embroidery/DTG compatibility and print area TBD.
- STEALTH CAP: embroidery candidate; validate thread count, digitizing, and logo size.

## Checkout and international launch gates
1. Merchant-owned Shopify store connected and payment gateway approved for India-based merchant receiving international payments.
2. Printful or other global provider account connected to Shopify. Verify destination coverage by product/variant and published rates.
3. Verify customer price vs supplier fulfillment charge, shipping, duties/taxes, refunds, chargebacks and working-capital exposure.
4. Validate print-ready artwork, intellectual-property rights, image uploads, allowed content, and resolution.
5. Define custom-design workflow: customer input -> approved print zone -> production-quality output -> Shopify line item/custom properties -> fulfillment provider order. Never transmit arbitrary browser preview as production artwork.
6. Confirm live 3D/2D product mockup accuracy against physical samples and selected sizes.
7. Verify accessibility and mobile usability, save/retrieve design flow, order status, email notifications, and data/privacy terms.
8. Place test orders to USA, UK, EU and India where supported; verify fulfillment, tracking, customs notices, returns and failed-payment handling.
9. Obtain explicit launch approval before activating checkout or modifying production site.

## Current prototype limitations
- HTML/CSS schematic garment previews, not photorealistic supplier-specific product images.
- Customization options are illustrative; supplier SKU and production print-area restrictions not yet mapped.
- Downloads a text specification only. No design database, Shopify cart, Printful integration, uploads, live 3D, or AR.
- Existing production website and GLITCH Scanner remain untouched.

## Next development milestones
A. Obtain Printful catalog variant IDs and template/placement specifications for all three products.
B. Build product-specific 2D compositing preview and safe printable-area validation.
C. Persist drafts securely; connect Shopify product variants and line-item design references.
D. Create server-side export and fulfillment handoff; never expose merchant credentials in browser.
E. Test payment, order and fulfillment lifecycle end-to-end in sandbox/test modes.
