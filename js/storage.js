import { RECORDS_KEY } from './state.js';

export function loadRecords() {
  const saved = localStorage.getItem(RECORDS_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  return [
    {
      id: 'seed-1',
      source: 'Cardiology consult',
      transcription: 'Patient reported persistent fatigue. Medication reviewed and updated for follow-up.',
      status: 'Pending review',
      savedAt: '2026-08-10 09:15',
      owner: 'staff',
    },
    {
      id: 'seed-2',
      source: 'Neurology referral',
      transcription: 'Referral completed. Patient scheduled for outpatient review next week.',
      status: 'Reviewed',
      savedAt: '2026-08-10 11:05',
      owner: 'admin',
    },
  ];
}

export function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}
