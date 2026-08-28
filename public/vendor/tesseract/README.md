# Local OCR runtime assets

These files are copied from the pinned `tesseract.js` and `tesseract.js-core`
npm dependencies so QuickNotes can start its OCR worker under the application
Content Security Policy without loading executable scripts from a third party.

Language data remains an optional on-demand download managed by Tesseract.js;
user images are processed by this same-origin worker and are not uploaded.
The adjacent license files are distributed with the runtime assets.
