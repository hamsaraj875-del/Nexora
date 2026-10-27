/**
 * Normalization utilities for institutions, dates, statuses, categories.
 * Conforms strictly to SPEC Section 7 & Section 4.
 */

const ABBREVIATIONS = {
  inst: 'institute',
  tech: 'technology',
  engg: 'engineering',
  univ: 'university',
  coll: 'college',
  poly: 'polytechnic',
  mgmt: 'management',
  sci: 'science',
  dept: 'department',
  res: 'research',
  ed: 'education',
  edu: 'education',
  gov: 'government',
  govt: 'government',
  nat: 'national',
  intl: 'international',
};

const FILLER_WORDS = new Set(['the', 'of', 'and', '&', 'for', 'in', 'at']);

export const normalizeInstitutionName = (name) => {
  if (!name || typeof name !== 'string') return '';

  let normalized = name.toLowerCase();

  // Remove punctuation (retain alphanumeric and spaces)
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Split into tokens
  const words = normalized.split(/\s+/).filter(Boolean);

  // Expand abbreviations and remove filler words
  const cleaned = words
    .map((word) => ABBREVIATIONS[word] || word)
    .filter((word) => !FILLER_WORDS.has(word));

  return cleaned.join(' ').trim();
};

export const normalizeCity = (city) => {
  if (!city || typeof city !== 'string') return '';
  return city.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

export const normalizeDate = (rawDate, allowDefault = false) => {
  if (!rawDate) {
    if (allowDefault) return new Date();
    throw new Error('Received date is required.');
  }
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date value: "${rawDate}". Expected valid ISO or date format.`);
  }
  const year = d.getFullYear();
  const currentYear = new Date().getFullYear();
  if (year < 1990 || year > currentYear + 1) {
    throw new Error(`Date year ${year} is outside reasonable bounds (1990-${currentYear + 1}).`);
  }
  return d;
};

export const normalizeStatus = (rawStatus) => {
  if (!rawStatus) return 'pending';
  const s = rawStatus.toLowerCase().trim().replace(/[-\s]/g, '_');
  if (['pending', 'open', 'new', 'unassigned'].includes(s)) return 'pending';
  if (['under_process', 'in_progress', 'processing', 'reviewing', 'active'].includes(s)) return 'under_process';
  if (['needs_info', 'need_info', 'info_needed', 'more_info'].includes(s)) return 'needs_info';
  if (['disposed', 'resolved', 'closed', 'completed', 'done'].includes(s)) return 'disposed';
  if (['transferred', 'forwarded', 'routed'].includes(s)) return 'transferred';
  if (['escalated', 'escalate'].includes(s)) return 'escalated';
  if (['rejected', 'reject'].includes(s)) return 'rejected';
  return 'pending';
};

export const normalizeCategory = (rawCategory) => {
  if (!rawCategory) return 'General Grievance';
  const c = rawCategory.trim();
  const lower = c.toLowerCase();
  if (lower.includes('fee')) return 'Fee Issues';
  if (lower.includes('facult') || lower.includes('professor') || lower.includes('staff') || lower.includes('teacher')) return 'Faculty Shortage';
  if (lower.includes('fake') || lower.includes('forg') || lower.includes('document')) return 'Fake Documents';
  if (lower.includes('infrastruct') || lower.includes('lab') || lower.includes('build')) return 'Infrastructure';
  if (lower.includes('admiss')) return 'Admission Irregularities';
  if (lower.includes('harass') || lower.includes('ragging')) return 'Harassment';
  return c;
};
