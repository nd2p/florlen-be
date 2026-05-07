const { supabaseAdmin } = require('../config/supabase');

const uploadFile = async (bucket, path, fileBuffer, contentType) => {
  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
    contentType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

  return { path: data.path, publicUrl };
};

const deleteFile = async (bucket, path) => {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);

  if (error) throw new Error(error.message);
};

module.exports = { uploadFile, deleteFile };
