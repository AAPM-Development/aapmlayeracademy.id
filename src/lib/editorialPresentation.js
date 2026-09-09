export const EDITORIAL_PRESENTATION_FORMATS = {
  pptx: {
    extension: "pptx",
    label: "PowerPoint",
    shortLabel: "PPTX",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    viewer: "slides",
  },
  ppt: {
    extension: "ppt",
    label: "PowerPoint lama",
    shortLabel: "PPT",
    mime: "application/vnd.ms-powerpoint",
    viewer: "download",
  },
  key: {
    extension: "key",
    label: "Keynote",
    shortLabel: "KEY",
    mime: "application/x-iwork-keynote-sffkey",
    viewer: "download",
  },
  odp: {
    extension: "odp",
    label: "OpenDocument Presentation",
    shortLabel: "ODP",
    mime: "application/vnd.oasis.opendocument.presentation",
    viewer: "download",
  },
  pdf: {
    extension: "pdf",
    label: "PDF",
    shortLabel: "PDF",
    mime: "application/pdf",
    viewer: "pdf",
  },
};

export const EDITORIAL_PRESENTATION_EXTENSIONS = Object.keys(EDITORIAL_PRESENTATION_FORMATS);

export const EDITORIAL_PRESENTATION_ACCEPT = [
  ...EDITORIAL_PRESENTATION_EXTENSIONS.map((extension) => `.${extension}`),
  ...Object.values(EDITORIAL_PRESENTATION_FORMATS).map(({ mime }) => mime),
].join(",");

export function getEditorialPresentationFormat(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/^\./, "");
  return EDITORIAL_PRESENTATION_FORMATS[raw] ? raw : null;
}

export function getEditorialPresentationFormatFromName(value) {
  const name = String(value || "").trim();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return getEditorialPresentationFormat(extension);
}

export function getEditorialPresentationFormatFromUrl(value) {
  const raw = String(value || "").split(/[?#]/, 1)[0];
  return getEditorialPresentationFormatFromName(raw);
}

export function editorialPresentationMeta(value) {
  const format = getEditorialPresentationFormat(value) || "pptx";
  return { format, ...EDITORIAL_PRESENTATION_FORMATS[format] };
}

export function isUploadedEditorialPresentation(value) {
  return Boolean(getEditorialPresentationFormat(value));
}
