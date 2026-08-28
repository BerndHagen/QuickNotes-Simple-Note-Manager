# Image and PDF OCR

## Image OCR

Printed-text OCR uses Tesseract.js in a worker and is classified as **local** processing. The source image remains a resource referenced by its Canvas/Paper image object. Tesseract language data may be downloaded and cached, but the image is processed in the browser.

The user selects an image, chooses a supported language, and starts OCR. Progress and cancellation come from the real worker operation. Output stores the image resource, spatial object, page/region, checksum-based fingerprint, provider/model details, language, and confidence when provided. Corrections remain searchable and survive reruns.

Tesseract is not presented as a handwriting recognizer. There are no accuracy claims beyond the provider output.

## PDF extraction

PDF.js opens the canonical PDF Blob and processes selected pages through the bounded intelligence queue. Each page follows this order:

1. Extract embedded text.
2. Persist useful native text as page-attributed `pdfText`.
3. Only when requested and native text is not useful, render the page at a bounded scale and run local OCR.

PDF results link to the resource and one-based page number. Search opens the attachment manager on that page. Rendering is capped to a 2,400-pixel maximum dimension, and page work is sequential/cancellable so large PDFs do not allocate every page at once.

## Known limitations

- Image/PDF annotation overlays are not implemented; existing spatial image ink remains the canonical Task 2 path where an image is placed on Paper/Canvas.
- OCR regions depend on provider output; PDF native text currently has page-level rather than word-level highlighting.
- Password-protected, malformed, or unsupported PDFs fail visibly and leave the original attachment intact.
- Cloud synchronization of new canonical PDF/audio blobs and recognized rows is not yet connected in the client.
