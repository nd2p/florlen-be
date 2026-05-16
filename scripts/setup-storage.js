require('dotenv').config();
const { Client } = require('pg');
const { supabaseAdmin } = require('../src/config/supabase');

const BUCKETS = [
  { id: 'product-images', public: true },
  { id: 'collection-images', public: true },
  { id: 'mockups', public: true },
  { id: 'reference-uploads', public: false },
  { id: 'blog-assets', public: true },
];

const POLICY_SQL = `
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('collection-images', 'collection-images', true),
  ('mockups', 'mockups', true),
  ('reference-uploads', 'reference-uploads', false),
  ('blog-assets', 'blog-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read product images'
  ) then
    create policy "Public read product images"
      on storage.objects for select
      using (bucket_id = 'product-images');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read collection images'
  ) then
    create policy "Public read collection images"
      on storage.objects for select
      using (bucket_id = 'collection-images');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins upload collection images'
  ) then
    create policy "Admins upload collection images"
      on storage.objects for insert
      with check (
        bucket_id = 'collection-images'
        and exists (
          select 1
          from public.profiles
          where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins upload product images'
  ) then
    create policy "Admins upload product images"
      on storage.objects for insert
      with check (
        bucket_id = 'product-images'
        and exists (
          select 1
          from public.profiles
          where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read mockups'
  ) then
    create policy "Public read mockups"
      on storage.objects for select
      using (bucket_id = 'mockups');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins upload mockups'
  ) then
    create policy "Admins upload mockups"
      on storage.objects for insert
      with check (
        bucket_id = 'mockups'
        and exists (
          select 1
          from public.profiles
          where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users upload own reference images'
  ) then
    create policy "Users upload own reference images"
      on storage.objects for insert
      with check (
        bucket_id = 'reference-uploads'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users read own reference images'
  ) then
    create policy "Users read own reference images"
      on storage.objects for select
      using (
        bucket_id = 'reference-uploads'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read blog assets'
  ) then
    create policy "Public read blog assets"
      on storage.objects for select
      using (bucket_id = 'blog-assets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins upload blog assets'
  ) then
    create policy "Admins upload blog assets"
      on storage.objects for insert
      with check (
        bucket_id = 'blog-assets'
        and exists (
          select 1
          from public.profiles
          where id = auth.uid()
            and role in ('admin', 'super_admin')
        )
      );
  end if;
end $$;
`;

const DB_CONNECTION_STRING =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const ensureBuckets = async () => {
  const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw listError;

  const existingIds = new Set(existingBuckets.map((bucket) => bucket.id));
  const createdBuckets = [];

  for (const bucket of BUCKETS) {
    if (existingIds.has(bucket.id)) continue;

    const { data, error } = await supabaseAdmin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
    });

    if (error) throw error;
    createdBuckets.push(data.name);
  }

  return { createdBuckets };
};

const ensurePolicies = async () => {
  const client = new Client({ connectionString: DB_CONNECTION_STRING });
  await client.connect();

  try {
    await client.query(POLICY_SQL);
  } finally {
    await client.end();
  }
};

const main = async () => {
  const { createdBuckets } = await ensureBuckets();
  await ensurePolicies();

  const { data: finalBuckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;

  console.log(
    JSON.stringify(
      {
        createdBuckets,
        buckets: finalBuckets.map((bucket) => ({ id: bucket.id, public: bucket.public })),
        dbConnection: DB_CONNECTION_STRING,
        policies: [
          'Public read product images',
          'Admins upload product images',
          'Public read collection images',
          'Admins upload collection images',
          'Public read mockups',
          'Admins upload mockups',
          'Users upload own reference images',
          'Users read own reference images',
          'Public read blog assets',
          'Admins upload blog assets',
        ],
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
