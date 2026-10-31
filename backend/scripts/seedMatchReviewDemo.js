
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

import { Institution } from '../src/models/Institution.js';
import { Bureau } from '../src/models/Bureau.js';
import { Case } from '../src/models/Case.js';
import { CaseAction } from '../src/models/CaseAction.js';

import { matchInstitution } from '../src/services/matcher.js';

const DEMO_COUNT = 5;

const createNameVariants = (name) => {
  const variants = [];

  // Introduce a small spelling error into one longer word.
  const words = name.split(' ');

  for (let i = 0; i < words.length; i++) {
    if (words[i].length >= 6) {
      const changed = [...words[i]];
      changed[changed.length - 2] = changed[changed.length - 2] === 'a'
        ? 'e'
        : 'a';

      const copy = [...words];
      copy[i] = changed.join('');

      variants.push(copy.join(' '));
    }
  }

  // Try removing a word to create a realistic incomplete institution name.
  if (words.length >= 3) {
    variants.push(words.slice(0, -1).join(' '));
  }

  return [...new Set(variants)].filter(Boolean);
};

const run = async () => {
  try {
    if (env.NODE_ENV === 'production') {
      throw new Error('Demo seeding is disabled in production.');
    }

    if (!env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from your environment.');
    }

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('\nConnected to MongoDB.');

    const [institutions, bureaus] = await Promise.all([
      Institution.find({}).lean(),
      Bureau.find({}).lean(),
    ]);

    if (institutions.length < DEMO_COUNT) {
      throw new Error(
        `Need at least ${DEMO_COUNT} institutions. Found ${institutions.length}.`
      );
    }

    if (bureaus.length === 0) {
      throw new Error('No bureaus found. Cannot distribute demo cases.');
    }

    const timestamp = Date.now();
    const preparedCases = [];

    // Find five different institutions with genuine matcher suggestions.
    for (const institution of institutions) {
      if (preparedCases.length >= DEMO_COUNT) break;

      const variants = createNameVariants(institution.name);

      for (const variant of variants) {
        const result = await matchInstitution({
          rawInstitutionName: variant,
          rawCity: institution.city,
          rawDistrict: institution.district,
          rawState: institution.state,
          rawPincode: institution.pincode,
        });

        const suggestions = result.candidates || [];

        // Only accept a result if the actual institution appears
        // among the suggestions returned by the matcher.
        const hasCorrectSuggestion = suggestions.some(
          (candidate) =>
            String(candidate.institution?._id) ===
            String(institution._id)
        );

        if (!hasCorrectSuggestion) continue;

        preparedCases.push({
          institution,
          rawInstitutionName: variant,
          matchScore: result.matchScore || 0,
          suggestions,
        });

        break;
      }
    }

    if (preparedCases.length !== DEMO_COUNT) {
      throw new Error(
        `Could generate only ${preparedCases.length}/${DEMO_COUNT} valid cases. ` +
        'No records were inserted. Check the matcher and institution data.'
      );
    }

    const createdCases = [];
    const createdActions = [];

    for (let i = 0; i < preparedCases.length; i++) {
      const item = preparedCases[i];
      const bureau = bureaus[i % bureaus.length];

      const caseId = `DEMO-MATCH-${timestamp}-${i + 1}`;
      const sourceCaseRef = `DEMO-MATCH-REF-${timestamp}-${i + 1}`;

      const newCase = await Case.create({
        caseId,
        sourceSystem: 'DEMO',
        sourceCaseRef,

        // Keep institution unassigned so the complaint needs review.
        institution: undefined,

        rawInstitutionName: item.rawInstitutionName,
        rawCity: item.institution.city,
        rawDistrict: item.institution.district || '',
        rawState: item.institution.state,
        rawPincode: item.institution.pincode || '',

        matchStatus: 'review',
        matchScore: item.matchScore,

        category: 'Admission Related',
        description:
          `DEMO complaint ${i + 1}: Institution identity requires verification. ` +
          'The suggested institution is available for officer review.',

        complainantType: 'Student',
        receivedDate: new Date(),

        status: 'pending',
        currentBureau: bureau._id,

        lastActionText: 'Demo complaint registered for match review',
        lastActionDate: new Date(),

        nextActionText: 'Verify suggested institution',
        expectedDisposalDate: new Date(
          Date.now() + 15 * 24 * 60 * 60 * 1000
        ),
      });

      createdCases.push(newCase);

      const action = await CaseAction.create({
        case: newCase._id,
        actionType: 'received',
        toStatus: 'pending',
        isPublic: true,
        remarks: 'Demo complaint created for institution match review.',
        timestamp: new Date(),
      });

      createdActions.push(action);

      console.log(
        `Created ${caseId} | Bureau: ${bureau.code} | ` +
        `Institution suggestion: ${item.institution.name} | ` +
        `Score: ${item.matchScore}`
      );
    }

    console.log('\n====================================');
    console.log('DEMO MATCH REVIEW DATA CREATED');
    console.log('====================================');
    console.log(`Cases created: ${createdCases.length}`);
    console.log(`Audit actions created: ${createdActions.length}`);
    console.log(`Available bureaus: ${bureaus.length}`);
    console.log('\nNo existing records were deleted or modified.');
  } catch (error) {
    console.error('\nDemo seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
