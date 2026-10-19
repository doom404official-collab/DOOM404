# DOOM404 // Supplier print boundaries — research baseline (2026-10-20)

Sources (official Printful):
- https://help.printful.com/hc/en-us/articles/50264024409233-What-is-the-safe-print-area
- https://help.printful.com/hc/en-us/articles/50264019148177-How-should-I-prepare-my-print-file-for-the-best-results
- https://help.printful.com/hc/en-us/articles/50263171283217-What-should-I-know-about-the-standard-15-18-print-placement-for-DTG-products
- https://help.printful.com/hc/en-us/articles/50263202274705-Does-the-new-larger-embroidery-area-of-the-hat-front-panel-change-anything-for-me
- https://help.printful.com/hc/en-us/articles/50263985175953-How-should-I-prepare-my-design-for-embroidery
- https://www.printful.com/custom/mens/t-shirts/oversized-faded-t-shirt-ascolour-5082
- https://www.printful.com/custom/collections/streetwear/unisex-oversized-hoodie-as-colour-5161

## Candidate product mapping
GLITCH TEE: AS Colour 5082 oversized faded tee. DTG front/back and sleeve placements shown in catalog. Exact placement rectangle and size exceptions: NOT VERIFIED. Obtain per-variant Printful File guidelines/template before using as hard constraints.

SYSTEM HOODIE: AS Colour 5161 oversized hoodie. DTG and other decorations shown. Exact front/back/sleeve rectangles and per-size constraints: NOT VERIFIED. Obtain template before enabling production output.

STEALTH CAP: Yupoong 6089M Classic Snapback candidate. Printful official help identifies front embroidery area 6.3 x 2.56 inches (16 x 6.5 cm) for this model. Confirm variant and placement at design time. Embroidery min text height 0.25 in; min line thickness 0.05 in; min negative space 0.25 in (flat/unlimited embroidery). Standard embroidery up to 6 thread colors. Simplify logo and digitize through Printful.

## General rules
- Safe print area is the dotted line in Printful Design Maker. Do not infer safe margin from outer print area; exact safe polygon must come from product-specific template.
- Standard 15 x 18 in DTG area applies only to selected products/sizes. Never assume it applies to these candidates without verification.
- Export print artwork in sRGB IEC61966-2.1. Printful advises 150–300 DPI depending on product; use actual dimensions to validate effective DPI.
- Customer uploaded images in merch.html are PREVIEW ONLY. The current 500x500 pixel minimum is not sufficient to guarantee production readiness.
- Do not enable paid checkout, order submission, production export, or green 'print-ready' labels until product/variant, technique, placement, safe-zone geometry and minimum DPI are validated.

## Required implementation data
For each supplier variant and placement, record supplier, catalog product ID, variant ID, technique, placement code, outer printable width/height (in), safe-zone polygon or inset (in), file pixel requirements, min DPI, allowed formats, and source template/version. Mark unverified fields null; never fabricate.

## Immediate product design direction
Tee: bold detailed back graphic plus small front emblem.
Hoodie: small chest mark, large back robot graphic; sleeves only after supplier confirmation.
Cap: simplified 404 symbol front embroidery, no fine robot details or microtext.

## Go/no-go
Product design concepts: GO.
Production-ready print boundaries for tee and hoodie: BLOCKED pending exact Printful templates.
Cap front outer embroidery area: VERIFIED for Yupoong 6089M; safe inset and actual digitized art: PENDING.
