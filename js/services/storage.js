import { supabase } from '../config/supabase.js';

const IMAGE_BUCKET = 'prescription_images';
const PRESCRIPTION_COLUMNS = 'prescription_id, user_id, image_path, source, raw_ocr_text, status, diagnosis, verified_at, created_at';
const ITEM_COLUMNS = 'item_id, prescription_id, medicine_name, dosage, confidence_score, is_edited';

async function mapPrescription(prescription, items = []) {
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
    source: prescription.source || 'N/A',
    imagePath: prescription.image_path || '',
    imageUrl,
    transcription: prescription.raw_ocr_text || '',
    status: status === 'reviewed' ? 'Reviewed' : 'Pending review',
    createdAt: prescription.created_at,
    savedAt: new Date(prescription.created_at).toLocaleString(),
    owner: prescription.user_id,
    diagnosis: prescription.diagnosis || '',
    verifiedAt: prescription.verified_at,
    items,
  };
}

export async function loadRecords() {
  const { data, error } = await supabase
    .from('prescriptions')
    .select(PRESCRIPTION_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('prescription_items')
    .select(ITEM_COLUMNS)
    .order('item_id', { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const itemsByPrescription = new Map();
  for (const item of itemRows) {
    const list = itemsByPrescription.get(item.prescription_id) || [];
    list.push(item);
    itemsByPrescription.set(item.prescription_id, list);
  }

  return Promise.all(data.map((row) => mapPrescription(row, itemsByPrescription.get(row.prescription_id) || [])));
}

// Lightweight query for the dashboard: no signed image URLs and no items.
export async function loadDashboardSummary() {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('prescription_id, source, status, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const pending = data.filter((row) => String(row.status).toLowerCase() !== 'reviewed');

  return {
    pendingCount: pending.length,
    verifiedCount: data.length - pending.length,
    todayCount: data.filter((row) => new Date(row.created_at) >= startOfToday).length,
    oldestPending: pending.slice(0, 5).map((row) => ({
      id: row.prescription_id,
      source: row.source || 'N/A',
      savedAt: new Date(row.created_at).toLocaleString(),
    })),
  };
}

export async function logAudit(user, prescriptionId, actionType, notes = '') {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: user.id,
    prescription_id: prescriptionId,
    action_type: actionType,
    notes,
  });

  // The audit trail must not block the user's action, but failures stay visible.
  if (error) {
    console.error(`Unable to write ${actionType} audit log:`, error);
  }
}

export async function logCsvExport(user, fileName, recordsCount) {
  const { error } = await supabase.from('csv_reports').insert({
    user_id: user.id,
    file_name: fileName,
    records_count: recordsCount,
  });

  if (error) {
    console.error('Unable to write CSV export log:', error);
  }
}

// Inserts the new items before deleting the old ones, so a failed insert never loses saved items.
async function replaceItems(prescriptionId, items) {
  const { data: oldItems, error: readError } = await supabase
    .from('prescription_items')
    .select('item_id')
    .eq('prescription_id', prescriptionId);

  if (readError) {
    throw readError;
  }

  const rows = items
    .filter((item) => item.medicine_name.trim() || item.dosage.trim())
    .map((item) => ({
      prescription_id: prescriptionId,
      medicine_name: item.medicine_name.trim(),
      dosage: item.dosage.trim(),
      confidence_score: item.confidence_score ?? null,
      is_edited: Boolean(item.is_edited),
    }));

  let savedItems = [];
  if (rows.length) {
    const { data, error } = await supabase.from('prescription_items').insert(rows).select(ITEM_COLUMNS);
    if (error) {
      throw error;
    }
    savedItems = data;
  }

  if (oldItems.length) {
    const { error: deleteError } = await supabase
      .from('prescription_items')
      .delete()
      .in('item_id', oldItems.map((item) => item.item_id));

    if (deleteError) {
      throw deleteError;
    }
  }

  return savedItems;
}

export async function createPrescription(user, file, transcription, source = 'N/A', fields = { diagnosis: '', items: [] }) {
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
      source: source.trim() || 'N/A',
      raw_ocr_text: transcription,
      status: 'pending',
      diagnosis: fields.diagnosis || '',
    })
    .select(PRESCRIPTION_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(IMAGE_BUCKET).remove([imagePath]);
    throw error;
  }

  let items = [];
  try {
    items = await replaceItems(data.prescription_id, fields.items || []);
  } catch (itemsError) {
    // Keep the saved prescription; the reviewer can add the fields during verification.
    console.error('Unable to save extracted items:', itemsError);
  }

  await logAudit(user, data.prescription_id, 'UPLOAD', `Uploaded ${file.name}; ${items.length} item(s) extracted`);
  return mapPrescription(data, items);
}

// Saves reviewer edits. With verify=true the record becomes Reviewed and is cleared for CSV export.
export async function saveRecord(user, recordId, { transcription, source = 'N/A', diagnosis = '', items = [], verify = false }) {
  const changes = {
    raw_ocr_text: transcription,
    source: source.trim() || 'N/A',
    diagnosis: diagnosis.trim(),
  };

  if (verify) {
    changes.status = 'reviewed';
    changes.verified_by = user.id;
    changes.verified_at = new Date().toISOString();
  }

  // Items first: a record must never be marked Reviewed without its verified items.
  const savedItems = await replaceItems(recordId, items);

  const { data, error } = await supabase
    .from('prescriptions')
    .update(changes)
    .eq('prescription_id', recordId)
    .select(PRESCRIPTION_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const editedCount = savedItems.filter((item) => item.is_edited).length;
  await logAudit(user, recordId, verify ? 'VERIFY' : 'EDIT', `${savedItems.length} item(s), ${editedCount} manually edited`);
  return mapPrescription(data, savedItems);
}
