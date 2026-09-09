// Keep browser-side editorial limits in one place so the authoring guard and
// learner viewer cannot silently drift apart. The API remains authoritative
// and mirrors these values in public/api/editorialMedia.php.
export const EDITORIAL_PRESENTATION_MAX_BYTES = 50 * 1024 * 1024;
export const EDITORIAL_PRESENTATION_MAX_SLIDES = 50;
