export function validateNamingInput({ surname, given }) {
  const normalizedSurname = typeof surname === 'string' ? surname.trim() : '';
  const normalizedGiven = Array.isArray(given)
    ? given.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    : [];

  if (!normalizedSurname) {
    return { valid: false, error: 'surname is required' };
  }

  if (normalizedSurname.length !== 1) {
    return { valid: false, error: 'only single-character surnames are supported for now' };
  }

  if (normalizedGiven.length < 1 || normalizedGiven.length > 2) {
    return { valid: false, error: 'given name must contain one or two hanja characters' };
  }

  return {
    valid: true,
    value: {
      surname: normalizedSurname,
      given: normalizedGiven
    }
  };
}

export function validateRecommendInput({ surname, topK, givenLength }) {
  const normalizedSurname = typeof surname === 'string' ? surname.trim() : '';
  const normalizedTopK = Math.max(1, Math.min(20, Number(topK || 5)));
  const normalizedGivenLength = Number(givenLength || 2) === 1 ? 1 : 2;

  if (!normalizedSurname) {
    return { valid: false, error: 'surname is required' };
  }

  if (normalizedSurname.length !== 1) {
    return { valid: false, error: 'only single-character surnames are supported for now' };
  }

  return {
    valid: true,
    value: {
      surname: normalizedSurname,
      topK: normalizedTopK,
      givenLength: normalizedGivenLength
    }
  };
}
