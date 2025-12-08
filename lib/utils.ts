import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine utility for conditional class names and Tailwind merge.
 *
 * Uses clsx to normalize conditional class values and tailwind-merge to resolve
 * conflicting Tailwind CSS classes into a single string.
 *
 * @param {...ClassValue[]} inputs - A list of class values (strings, arrays, objects)
 * @returns {string} The merged className string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
