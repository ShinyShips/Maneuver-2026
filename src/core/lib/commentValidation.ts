export const MIN_DETAILED_COMMENT_LENGTH = 25;

export const isSubstantiveComment = (comment: string): boolean => {
  const normalized = comment.trim().replace(/\s+/g, ' ');
  if (normalized.length < MIN_DETAILED_COMMENT_LENGTH) {
    return false;
  }

  const words = normalized.split(' ').filter(Boolean);
  return words.length >= 5;
};
