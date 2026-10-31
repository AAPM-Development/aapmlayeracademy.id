import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/** True for mouse and trackpad. Touch devices would open the keyboard over the page on load. */
export const hasFinePointer = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches === true;
