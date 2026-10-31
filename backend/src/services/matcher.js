
import Fuse from 'fuse.js';
import { Institution } from '../models/Institution.js';
import {
  normalizeInstitutionName,
  normalizeCity,
} from './normalizer.js';

export const MATCH_THRESHOLDS = {
  AUTO_MATCH: 90,
  REVIEW_QUEUE: 75,
};

/**
 * Match an incoming complaint to an AICTE Master Institution.
 */
export const matchInstitution = async (input) => {
  const {
    aictePermanentId,
    rawInstitutionName,
    rawCity,
    rawDistrict,
    rawState,
    rawPincode,
  } = input;

  // 1. Exact AICTE Permanent ID match
  if (aictePermanentId) {
    const trimmedId = aictePermanentId.trim();

    const instById = await Institution.findOne({
      aictePermanentId: trimmedId,
    });

    if (instById) {
      return {
        institution: instById,
        matchStatus: 'matched',
        matchScore: 100,
      };
    }
  }

  const normName = normalizeInstitutionName(rawInstitutionName);
  const normCity = normalizeCity(rawCity);

  if (!normName) {
    return {
      institution: null,
      matchStatus: 'unmatched',
      matchScore: 0,
    };
  }

  // 2. Exact normalized name + city + state match
  if (normCity) {
    const candidatesByName = await Institution.find({
      normalizedName: normName,
    });

    const exactCityMatch = candidatesByName.find((inst) => {
      const cityMatches = normalizeCity(inst.city) === normCity;

      const stateMatches =
        !rawState ||
        String(inst.state || '').trim().toLowerCase() ===
          rawState.trim().toLowerCase();

      return cityMatches && stateMatches;
    });

    if (exactCityMatch) {
      return {
        institution: exactCityMatch,
        matchStatus: 'matched',
        matchScore: 98,
      };
    }
  }

  // 3. Restrict fuzzy matching by supplied state
  const query = {};

  if (rawState) {
    query.state = new RegExp(
      `^${rawState.trim()}$`,
      'i'
    );
  }

  let candidates = await Institution.find(query);

  // Never search other states if the supplied state has no match.
  if (candidates.length === 0 && rawState) {
    return {
      institution: null,
      matchStatus: 'unmatched',
      matchScore: 0,
      candidates: [],
    };
  }

  // 4. Restrict candidates to the supplied city when available.
  if (normCity) {
    candidates = candidates.filter(
      (inst) => normalizeCity(inst.city) === normCity
    );
  }

  if (candidates.length === 0) {
    return {
      institution: null,
      matchStatus: 'unmatched',
      matchScore: 0,
      candidates: [],
    };
  }

  // 5. Fuzzy name matching
  const fuse = new Fuse(candidates, {
    keys: ['normalizedName', 'name'],
    includeScore: true,
    threshold: 0.45,
  });

  const results = fuse.search(normName);

  if (results.length > 0) {
    const best = results[0];
    const item = best.item;

    let score = Math.round((1 - best.score) * 100);

    // City bonus
    if (rawCity && normalizeCity(item.city) === normCity) {
      score = Math.min(100, score + 8);
    }

    // Pincode bonus
    if (
      rawPincode &&
      item.pincode &&
      rawPincode.trim() === item.pincode.trim()
    ) {
      score = Math.min(100, score + 5);
    }

    const topCandidates = results.slice(0, 5).map((r) => ({
      institution: r.item,
      score: Math.round((1 - r.score) * 100),
    }));

    if (score >= MATCH_THRESHOLDS.AUTO_MATCH) {
      return {
        institution: item,
        matchStatus: 'matched',
        matchScore: score,
        candidates: topCandidates,
      };
    }

    if (score >= MATCH_THRESHOLDS.REVIEW_QUEUE) {
      return {
        institution: item,
        matchStatus: 'review',
        matchScore: score,
        candidates: topCandidates,
      };
    }
  }

  return {
    institution: null,
    matchStatus: 'unmatched',
    matchScore: 0,
    candidates: [],
  };
};
