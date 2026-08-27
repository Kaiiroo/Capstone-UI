import { supabase } from '../config/supabase.js';

function mapPrescription(prescription) {
  const status = String(prescription.status || '').toLowerCase();
  return {
    id: prescription.prescription_id,
    source: prescription.image_path || 'Untitled prescription',
    transcription: prescription.raw_ocr_text || '',
    status: status === 'reviewed' ? 'Reviewed' : 'Pending review',
    savedAt: new Date(prescription.created_at).toLocaleString(),
    owner: prescription.user_id,
  };
}

export async function loadRecords(user) {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('prescription_id, user_id, image_path, raw_ocr_text, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(mapPrescription);
}

export async function createPrescription(user, file, transcription) {
  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      user_id: user.id,
      image_path: file.name,
      raw_ocr_text: transcription,
      status: 'pending',
    })
    .select('prescription_id, user_id, image_path, raw_ocr_text, status, created_at')
    .single();

  if (error) {
    throw error;
  }

  return mapPrescription(data);
}

export async function updatePrescription(prescriptionId, transcription) {
  const { data, error } = await supabase
    .from('prescriptions')
    .update({ raw_ocr_text: transcription })
    .eq('prescription_id', prescriptionId)
    .select('prescription_id, user_id, image_path, raw_ocr_text, status, created_at')
    .single();

  if (error) {
    throw error;
  }

  return mapPrescription(data);
}
