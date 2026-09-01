type ProfileValidationInput = {
  displayName: string;
  handle: string;
  yearsExperience: string;
};

export function validateProfileInput(input: ProfileValidationInput): string | null {
  if (!input.displayName.trim()) return "Add a display name before saving.";
  const handle = input.handle.trim().toLowerCase();
  if (handle && !/^[a-z0-9_]{3,30}$/.test(handle)) {
    return "Handle must be 3–30 characters using lowercase letters, numbers, or underscores.";
  }
  const years = input.yearsExperience.trim() ? Number(input.yearsExperience) : null;
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 80)) {
    return "Years of experience must be a whole number from 0 to 80.";
  }
  return null;
}

export function normalizeProfileHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function validateProfileUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !!url.hostname;
  } catch {
    return false;
  }
}
