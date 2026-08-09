export function validatePollDraft(
  options: string[],
  endsAt: string,
  now = Date.now(),
): string | null {
  const cleanedOptions = options.map((option) => option.trim()).filter(Boolean);
  if (cleanedOptions.length < 2) return "A poll needs at least 2 options";

  const uniqueOptions = new Set(cleanedOptions.map((option) => option.toLowerCase()));
  if (uniqueOptions.size !== cleanedOptions.length) return "Poll options must be unique";

  if (endsAt) {
    const endTime = new Date(endsAt).getTime();
    if (!Number.isFinite(endTime) || endTime <= now) {
      return "Poll end time must be in the future";
    }
  }

  return null;
}

export function validateFeedbackRequest(tags: string[]): string | null {
  return tags.length > 0 ? null : "Choose at least one feedback area";
}
