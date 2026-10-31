
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Case } from '../src/models/Case.js';
import { CaseAction } from '../src/models/CaseAction.js';
import { Institution } from '../src/models/Institution.js';

const run = async () => {
  try {
    if (env.NODE_ENV === 'production') {
      throw new Error('Demo seeding is disabled in production.');
    }

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('Connected to MongoDB.');

    const institutions = await Institution.find({}).limit(5).lean();

    if (institutions.length < 5) {
      throw new Error('At least 5 institutions are required.');
    }

    const timestamp = Date.now();

    for (let i = 0; i < 5; i++) {
      const inst = institutions[i];

      const newCase = await Case.create({
        caseId: `DEMO-ASSIGN-${timestamp}-${i + 1}`,
        sourceSystem: 'DEMO',
        sourceCaseRef: `DEMO-ASSIGN-REF-${timestamp}-${i + 1}`,

        institution: inst._id,
        rawInstitutionName: inst.name,
        rawCity: inst.city,
        rawDistrict: inst.district || '',
        rawState: inst.state,
        rawPincode: inst.pincode || '',

        matchStatus: 'matched',
        matchScore: 100,

        category: [
          'Admission Related',
          'Fee Issues',
          'Infrastructure',
          'Faculty Shortage',
          'General Grievance',
        ][i],

        description:
          `Demo assignment complaint ${i + 1}. ` +
          'This complaint is awaiting assignment to the appropriate bureau.',

        complainantType: 'Student',
        receivedDate: new Date(),

        status: 'pending',
        currentBureau: null,
        assignedOfficer: null,

        lastActionText: 'Complaint registered — awaiting bureau assignment',
        lastActionDate: new Date(),

        nextActionText: 'Assign to appropriate bureau',
        expectedDisposalDate: new Date(
          Date.now() + 15 * 24 * 60 * 60 * 1000
        ),
      });

      await CaseAction.create({
        case: newCase._id,
        actionType: 'received',
        toStatus: 'pending',
        isPublic: true,
        remarks: 'Demo complaint created for Super Admin assignment queue.',
        timestamp: new Date(),
      });

      console.log(`Created: ${newCase.caseId} | UNASSIGNED`);
    }

    console.log('\n5 unassigned demo complaints created successfully.');
  } catch (error) {
    console.error('Assignment demo seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
