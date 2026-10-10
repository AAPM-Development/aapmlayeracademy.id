// Opens APPI's floating panel from any learner page, optionally with a
// prepared question in the composer. The floating assistant listens; the
// learner still reviews and sends the question.
export const ASK_APPI_EVENT = "aapm:ask-appi";

export function askAppi(prompt = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASK_APPI_EVENT, { detail: { prompt: String(prompt || "") } }));
}
