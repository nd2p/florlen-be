const dotenv = require('dotenv');
const path = require('path');
// Load environment variables from backend directory .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const { supabaseAdmin } = require('../src/config/supabase');

async function createSuperAdmin() {
  const email = 'dev.florlen@gmail.com';
  const password = 'Florlen@2026';
  const fullName = 'Florlen Admin';

  console.log(`Checking if user ${email} already exists...`);

  // Fetch users list to see if they already exist
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    process.exit(1);
  }

  const users = listData?.users || [];
  let user = users.find((u) => u.email === email);

  if (!user) {
    console.log(`Creating user ${email}...`);
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      process.exit(1);
    }
    user = createData.user;
    console.log(`User created successfully with ID: ${user.id}`);
  } else {
    console.log(`User ${email} already exists with ID: ${user.id}`);
  }

  console.log(`Updating profile to super_admin...`);

  // Wait a brief moment to ensure trigger has completed
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Update the profile to set role = 'super_admin' and full_name
  const { data, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      role: 'super_admin',
      full_name: fullName,
      display_name: 'Florlen Admin',
      is_active: true,
    })
    .eq('id', user.id)
    .select();

  if (updateError) {
    console.error('Error updating profile role:', updateError);
    process.exit(1);
  }

  console.log(`Profile updated successfully!`, data);
  console.log(`\n========================================`);
  console.log(`Super Admin credentials:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: super_admin`);
  console.log(`========================================\n`);
}

createSuperAdmin();
