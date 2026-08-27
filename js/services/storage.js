import { supabase } from '../config/supabase.js';

const IMAGE_BUCKET = 'prescription_images';

async function mapPrescription(prescription) {
  const status = String(prescription.status || '').toLowerCase();
  let imageUrl = '';

  if (prescription.image_path && prescription.image_path.includes('/')) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(prescription.image_path, 3600);

    if (error) {
      console.error(`Unable to create image URL for ${prescription.image_path}:`, error);
    }

    imageUrl = data?.signedUrl || '';
  }

  return {
    id: prescription.prescription_id,
    source: prescription.image_path?.split('/').pop() || 'Untitled prescription',
    imagePath: prescription.image_path || '',
    imageUrl,
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

  return Promise.all(data.map(mapPrescription));
}

export async function createPrescription(user, file, transcription) {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const imagePath = `${user.id}/${crypto.randomUUID()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(imagePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      user_id: user.id,
      image_path: imagePath,
      raw_ocr_text: transcription,
      status: 'pending',
    })
    .select('prescription_id, user_id, image_path, raw_ocr_text, status, created_at')
    .single();

  if (error) {
    await supabase.storage.from(IMAGE_BUCKET).remove([imagePath]);
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
