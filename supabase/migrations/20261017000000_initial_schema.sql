-- =====================================================================
-- PHARMACY PLATFORM : PHASE 1 : INITIAL SCHEMA (Supabase / PostgreSQL)
-- Run ONCE on a fresh project (SQL Editor -> New query -> paste -> Run).
-- Contents: extensions, enums, tables, helper functions, triggers,
--           RLS policies, storage buckets + policies, RPCs, views, seed data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type public.user_role           as enum ('patient', 'pharmacist', 'branch_manager', 'admin');
create type public.rx_status           as enum ('pending', 'approved', 'rejected', 'dispensed', 'expired', 'cancelled');
create type public.fulfilment_type     as enum ('pickup', 'delivery');
create type public.order_status        as enum ('pending_payment', 'awaiting_verification', 'confirmed', 'packing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled', 'refunded');
create type public.payment_method      as enum ('mpesa', 'card', 'cash_on_pickup');
create type public.payment_status      as enum ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded');
create type public.discount_type       as enum ('percentage', 'fixed');
create type public.subscription_status as enum ('active', 'paused', 'cancelled');

-- ---------------------------------------------------------------------
-- 2. GENERIC UTILITY: updated_at trigger function
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. TABLES
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 100001;

-- 3.1 Branches
create table public.branches (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,
  address                 text not null,
  town                    text not null,
  county                  text not null,
  phone                   text,
  email                   text,
  latitude                double precision not null check (latitude between -90 and 90),
  longitude               double precision not null check (longitude between -180 and 180),
  opening_hours           jsonb not null default '{}'::jsonb,
  ppb_license_no          text,
  has_pharmacist_on_duty  boolean not null default true,
  offers_pickup           boolean not null default true,
  offers_delivery         boolean not null default true,
  delivery_radius_km      numeric(6,2) not null default 10 check (delivery_radius_km >= 0),
  delivery_fee            numeric(10,2) not null default 0 check (delivery_fee >= 0),
  free_delivery_threshold numeric(10,2) check (free_delivery_threshold is null or free_delivery_threshold >= 0),
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- 3.2 Profiles (one per auth user)
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text not null default '',
  phone             text check (phone is null or phone ~ '^254[17][0-9]{8}$'),
  date_of_birth     date,
  role              public.user_role not null default 'patient',
  branch_id         uuid references public.branches(id) on delete set null,
  data_consent_at   timestamptz,
  marketing_opt_in  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3.3 Delivery addresses
create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles(id) on delete cascade,
  label         text not null default 'Home',
  address_line  text not null,
  town          text not null,
  county        text not null,
  latitude      double precision check (latitude is null or latitude between -90 and 90),
  longitude     double precision check (longitude is null or longitude between -180 and 180),
  phone         text check (phone is null or phone ~ '^254[17][0-9]{8}$'),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3.4 Brands and categories
create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  logo_url   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 3.5 Products
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  sku                   text not null unique,
  slug                  text not null unique,
  name                  text not null,
  generic_name          text,
  description           text,
  brand_id              uuid references public.brands(id) on delete set null,
  category_id           uuid references public.categories(id) on delete set null,
  dosage_form           text,
  strength              text,
  pack_size             text,
  price_kes             numeric(12,2) not null check (price_kes >= 0),
  compare_at_price_kes  numeric(12,2) check (compare_at_price_kes is null or compare_at_price_kes >= price_kes),
  requires_prescription boolean not null default false,
  is_chronic_eligible   boolean not null default false,
  image_urls            text[] not null default '{}',
  is_active             boolean not null default true,
  search_vector         tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' || coalesce(generic_name, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 3.6 Branch inventory
create table public.branch_inventory (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  quantity          int not null default 0 check (quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  reorder_level     int not null default 10 check (reorder_level >= 0),
  updated_at        timestamptz not null default now(),
  unique (branch_id, product_id)
);

-- 3.7 Discounts
create table public.discounts (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null,
  description          text,
  discount_type        public.discount_type not null,
  value                numeric(10,2) not null check (value > 0),
  min_order_amount     numeric(12,2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount  numeric(12,2) check (max_discount_amount is null or max_discount_amount > 0),
  starts_at            timestamptz,
  ends_at              timestamptz,
  usage_limit          int check (usage_limit is null or usage_limit > 0),
  used_count           int not null default 0 check (used_count >= 0),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint discounts_percentage_max check (discount_type <> 'percentage' or value <= 100)
);
create unique index discounts_code_unique on public.discounts (upper(code));

-- 3.8 Prescriptions
create table public.prescriptions (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.profiles(id) on delete restrict,
  branch_id         uuid references public.branches(id) on delete set null,
  file_paths        text[] not null check (cardinality(file_paths) between 1 and 5),
  doctor_name       text,
  facility_name     text,
  prescription_date date,
  patient_notes     text,
  status            public.rx_status not null default 'pending',
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,
  pharmacist_notes  text,
  expires_at        timestamptz,
  dispensed_by      uuid references public.profiles(id) on delete set null,
  dispensed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3.9 Orders
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default ('ORD-' || lpad(nextval('public.order_number_seq')::text, 8, '0')),
  patient_id       uuid not null references public.profiles(id) on delete restrict,
  branch_id        uuid not null references public.branches(id) on delete restrict,
  status           public.order_status not null default 'pending_payment',
  fulfilment_type  public.fulfilment_type not null,
  delivery_address jsonb,
  subtotal         numeric(12,2) not null check (subtotal >= 0),
  discount_total   numeric(12,2) not null default 0 check (discount_total >= 0),
  delivery_fee     numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total            numeric(12,2) not null check (total >= 0),
  discount_id      uuid references public.discounts(id) on delete set null,
  prescription_id  uuid references public.prescriptions(id) on delete set null,
  payment_method   public.payment_method not null,
  payment_status   public.payment_status not null default 'pending',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orders_delivery_needs_address check (fulfilment_type <> 'delivery' or delivery_address is not null)
);

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete restrict,
  product_name  text not null,
  sku           text not null,
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  quantity      int not null check (quantity > 0),
  line_total    numeric(12,2) not null check (line_total >= 0),
  unique (order_id, product_id)
);

-- 3.10 Payments (written ONLY by Edge Functions using the service role)
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders(id) on delete restrict,
  method                public.payment_method not null,
  status                public.payment_status not null default 'pending',
  amount                numeric(12,2) not null check (amount >= 0),
  currency              text not null default 'KES',
  phone                 text,
  provider_reference    text,
  merchant_request_id   text,
  checkout_request_id   text,
  mpesa_receipt_number  text,
  result_code           int,
  result_desc           text,
  raw_callback          jsonb,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index payments_checkout_request_unique on public.payments (checkout_request_id) where checkout_request_id is not null;
create unique index payments_mpesa_receipt_unique    on public.payments (mpesa_receipt_number) where mpesa_receipt_number is not null;
create unique index payments_provider_ref_unique     on public.payments (method, provider_reference) where provider_reference is not null;

-- 3.11 Webhook idempotency log (service role only)
create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  payload      jsonb not null,
  processed    boolean not null default false,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now(),
  unique (provider, event_id)
);

-- 3.12 Chronic refill subscriptions
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references public.profiles(id) on delete cascade,
  product_id           uuid not null references public.products(id) on delete restrict,
  branch_id            uuid not null references public.branches(id) on delete restrict,
  prescription_id      uuid references public.prescriptions(id) on delete set null,
  quantity             int not null default 1 check (quantity between 1 and 50),
  frequency_days       int not null check (frequency_days between 7 and 365),
  next_refill_date     date not null,
  fulfilment_type      public.fulfilment_type not null default 'pickup',
  delivery_address_id  uuid references public.addresses(id) on delete set null,
  payment_method       public.payment_method not null default 'mpesa',
  status               public.subscription_status not null default 'active',
  last_order_id        uuid references public.orders(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 3.13 Audit log
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  actor_id    uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. INDEXES
-- ---------------------------------------------------------------------
create index products_category_idx        on public.products (category_id);
create index products_brand_idx           on public.products (brand_id);
create index products_active_idx          on public.products (is_active);
create index products_search_idx          on public.products using gin (search_vector);
create index products_name_trgm_idx       on public.products using gin (name extensions.gin_trgm_ops);
create index categories_parent_idx        on public.categories (parent_id);
create index inventory_product_idx        on public.branch_inventory (product_id);
create index addresses_patient_idx        on public.addresses (patient_id);
create index prescriptions_patient_idx    on public.prescriptions (patient_id);
create index prescriptions_queue_idx      on public.prescriptions (status, created_at);
create index orders_patient_idx           on public.orders (patient_id, created_at desc);
create index orders_branch_status_idx     on public.orders (branch_id, status);
create index orders_prescription_idx      on public.orders (prescription_id);
create index order_items_order_idx        on public.order_items (order_id);
create index payments_order_idx           on public.payments (order_id);
create index subscriptions_patient_idx    on public.subscriptions (patient_id);
create index subscriptions_due_idx        on public.subscriptions (next_refill_date) where status = 'active';
create index audit_logs_record_idx        on public.audit_logs (table_name, record_id);

-- ---------------------------------------------------------------------
-- 5. updated_at TRIGGERS
-- ---------------------------------------------------------------------
create trigger trg_branches_updated_at         before update on public.branches         for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at         before update on public.profiles         for each row execute function public.set_updated_at();
create trigger trg_addresses_updated_at        before update on public.addresses        for each row execute function public.set_updated_at();
create trigger trg_products_updated_at         before update on public.products         for each row execute function public.set_updated_at();
create trigger trg_branch_inventory_updated_at before update on public.branch_inventory for each row execute function public.set_updated_at();
create trigger trg_prescriptions_updated_at    before update on public.prescriptions    for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at           before update on public.orders           for each row execute function public.set_updated_at();
create trigger trg_payments_updated_at         before update on public.payments         for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at    before update on public.subscriptions    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. ROLE HELPER FUNCTIONS (SECURITY DEFINER avoids RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_pharmacist()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist', 'admin'));
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist', 'branch_manager', 'admin'));
$$;

create or replace function public.staff_can_access_branch(p_branch_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin'
           or (p.role in ('pharmacist', 'branch_manager') and p.branch_id = p_branch_id))
  );
$$;

-- ---------------------------------------------------------------------
-- 7. AUTH: auto-create profile on signup (role is ALWAYS patient)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_phone text := coalesce(new.phone, new.raw_user_meta_data->>'phone');
begin
  insert into public.profiles (id, email, full_name, phone, data_consent_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when v_phone ~ '^254[17][0-9]{8}$' then v_phone else null end,
    case when (new.raw_user_meta_data->>'data_consent') = 'true' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block privilege escalation: only admins (or the service role / SQL editor) may change role or branch
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.branch_id is distinct from old.branch_id then
      raise exception 'You are not allowed to change role or branch assignment';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- 8. PRESCRIPTION WORKFLOW ENFORCEMENT
--    pending -> approved | rejected ; approved -> dispensed | expired
--    patient may cancel while pending
-- ---------------------------------------------------------------------
create or replace function public.prescriptions_workflow()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_path text;
begin
  if tg_op = 'INSERT' then
    foreach v_path in array new.file_paths loop
      if split_part(v_path, '/', 1) <> new.patient_id::text then
        raise exception 'Invalid prescription file path';
      end if;
    end loop;
    if v_uid is not null then
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
      new.pharmacist_notes := null;
      new.expires_at := null;
      new.dispensed_by := null;
      new.dispensed_at := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.patient_id is distinct from old.patient_id
     or new.file_paths is distinct from old.file_paths then
    raise exception 'Prescription owner and files cannot be changed';
  end if;

  if v_uid is not null and not public.is_pharmacist() then
    new.reviewed_by      := old.reviewed_by;
    new.reviewed_at      := old.reviewed_at;
    new.rejection_reason := old.rejection_reason;
    new.pharmacist_notes := old.pharmacist_notes;
    new.expires_at       := old.expires_at;
    new.dispensed_by     := old.dispensed_by;
    new.dispensed_at     := old.dispensed_at;
  end if;

  if new.status is distinct from old.status then
    if v_uid is not null and not public.is_pharmacist() then
      if v_uid <> old.patient_id or not (old.status = 'pending' and new.status = 'cancelled') then
        raise exception 'Only a pharmacist can change this prescription status';
      end if;
    else
      if v_uid is not null and v_uid = old.patient_id then
        raise exception 'You cannot review your own prescription';
      end if;

      if not (
        (old.status = 'pending'  and new.status in ('approved', 'rejected', 'cancelled'))
        or (old.status = 'approved' and new.status in ('dispensed', 'expired'))
      ) then
        raise exception 'Invalid prescription status change: % -> %', old.status, new.status;
      end if;

      if new.status = 'approved' then
        new.reviewed_by := coalesce(v_uid, new.reviewed_by);
        new.reviewed_at := now();
        new.expires_at  := coalesce(new.expires_at, now() + interval '6 months');
      elsif new.status = 'rejected' then
        if btrim(coalesce(new.rejection_reason, '')) = '' then
          raise exception 'A rejection reason is required';
        end if;
        new.reviewed_by := coalesce(v_uid, new.reviewed_by);
        new.reviewed_at := now();
      elsif new.status = 'dispensed' then
        new.dispensed_by := coalesce(v_uid, new.dispensed_by);
        new.dispensed_at := now();
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_prescriptions_workflow
  before insert or update on public.prescriptions
  for each row execute function public.prescriptions_workflow();

-- When a prescription is approved/rejected, move linked orders forward/cancel them
create or replace function public.prescriptions_sync_orders()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      update public.orders
         set status = case when payment_method = 'cash_on_pickup' then 'confirmed'::public.order_status
                           else 'pending_payment'::public.order_status end
       where prescription_id = new.id and status = 'awaiting_verification';
    elsif new.status in ('rejected', 'cancelled') then
      update public.orders
         set status = 'cancelled'
       where prescription_id = new.id and status = 'awaiting_verification';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prescriptions_sync_orders
  after update on public.prescriptions
  for each row execute function public.prescriptions_sync_orders();

-- ---------------------------------------------------------------------
-- 9. ORDER GUARD + STOCK SYNC
-- ---------------------------------------------------------------------
create or replace function public.orders_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- service role / SQL editor / Edge Functions: unrestricted
  if v_uid is null then
    return new;
  end if;

  if new.patient_id       is distinct from old.patient_id
     or new.order_number    is distinct from old.order_number
     or new.branch_id       is distinct from old.branch_id
     or new.fulfilment_type is distinct from old.fulfilment_type
     or new.delivery_address is distinct from old.delivery_address
     or new.subtotal        is distinct from old.subtotal
     or new.discount_total  is distinct from old.discount_total
     or new.delivery_fee    is distinct from old.delivery_fee
     or new.total           is distinct from old.total
     or new.discount_id     is distinct from old.discount_id
     or new.prescription_id is distinct from old.prescription_id
     or new.payment_method  is distinct from old.payment_method
     or new.payment_status  is distinct from old.payment_status then
    raise exception 'Order identity and financial fields are read-only';
  end if;

  if new.status is distinct from old.status then
    if public.is_staff() then
      if old.status in ('cancelled', 'refunded') then
        raise exception 'A closed order cannot be reopened';
      end if;

      if new.status in ('confirmed', 'packing', 'ready_for_pickup', 'out_for_delivery', 'completed')
         and old.payment_method <> 'cash_on_pickup'
         and old.payment_status <> 'paid' then
        raise exception 'This order has not been paid';
      end if;

      if old.status = 'awaiting_verification' then
        if new.status not in ('pending_payment', 'confirmed', 'cancelled') then
          raise exception 'This order is awaiting prescription verification';
        end if;
        if new.status in ('pending_payment', 'confirmed')
           and not exists (
             select 1 from public.prescriptions rx
             where rx.id = old.prescription_id and rx.status = 'approved'
           ) then
          raise exception 'The prescription must be approved first';
        end if;
      end if;
    else
      if not (
        old.status in ('pending_payment', 'awaiting_verification')
        and new.status = 'cancelled'
        and old.payment_status in ('pending', 'failed', 'cancelled')
      ) then
        raise exception 'You can only cancel an order that has not been paid';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_orders_guard
  before update on public.orders
  for each row execute function public.orders_guard();

create or replace function public.orders_stock_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'cancelled' and old.status not in ('cancelled', 'completed', 'refunded') then
      update public.branch_inventory bi
         set reserved_quantity = greatest(bi.reserved_quantity - oi.quantity, 0)
        from public.order_items oi
       where oi.order_id = new.id
         and bi.branch_id = new.branch_id
         and bi.product_id = oi.product_id;

      if new.discount_id is not null then
        update public.discounts set used_count = greatest(used_count - 1, 0) where id = new.discount_id;
      end if;

    elsif new.status = 'completed' and old.status not in ('completed', 'cancelled', 'refunded') then
      update public.branch_inventory bi
         set quantity          = greatest(bi.quantity - oi.quantity, 0),
             reserved_quantity = greatest(bi.reserved_quantity - oi.quantity, 0)
        from public.order_items oi
       where oi.order_id = new.id
         and bi.branch_id = new.branch_id
         and bi.product_id = oi.product_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_orders_stock_sync
  after update of status on public.orders
  for each row execute function public.orders_stock_sync();

-- ---------------------------------------------------------------------
-- 10. AUDIT TRIGGERS
-- ---------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_logs (table_name, record_id, action, actor_id, old_data, new_data)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger trg_audit_prescriptions
  after insert or update or delete on public.prescriptions
  for each row execute function public.log_audit();

create trigger trg_audit_orders
  after update on public.orders
  for each row when (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status)
  execute function public.log_audit();

create trigger trg_audit_profiles
  after update on public.profiles
  for each row when (old.role is distinct from new.role or old.branch_id is distinct from new.branch_id)
  execute function public.log_audit();

-- ---------------------------------------------------------------------
-- 11. ENABLE ROW LEVEL SECURITY ON EVERY TABLE
-- ---------------------------------------------------------------------
alter table public.branches         enable row level security;
alter table public.profiles         enable row level security;
alter table public.addresses        enable row level security;
alter table public.brands           enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.branch_inventory enable row level security;
alter table public.discounts        enable row level security;
alter table public.prescriptions    enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.payments         enable row level security;
alter table public.webhook_events   enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.audit_logs       enable row level security;

-- Defence in depth: anonymous visitors get no direct access to sensitive tables
revoke all on public.profiles, public.addresses, public.branch_inventory, public.discounts,
              public.prescriptions, public.orders, public.order_items, public.payments,
              public.subscriptions, public.audit_logs from anon;
revoke all on public.webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------
-- 12. RLS POLICIES
-- ---------------------------------------------------------------------

-- 12.1 profiles
create policy "profiles_select_own"   on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_select_staff" on public.profiles for select to authenticated
  using (public.is_staff());
create policy "profiles_update_own"   on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 12.2 addresses
create policy "addresses_owner_all" on public.addresses for all to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));

-- 12.3 branches (public read of active; admin manages)
create policy "branches_public_read" on public.branches for select to anon, authenticated
  using (is_active);
create policy "branches_staff_read_all" on public.branches for select to authenticated
  using (public.is_staff());
create policy "branches_admin_write" on public.branches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 12.4 brands
create policy "brands_public_read" on public.brands for select to anon, authenticated
  using (is_active);
create policy "brands_staff_read_all" on public.brands for select to authenticated
  using (public.is_staff());
create policy "brands_admin_write" on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 12.5 categories
create policy "categories_public_read" on public.categories for select to anon, authenticated
  using (is_active);
create policy "categories_staff_read_all" on public.categories for select to authenticated
  using (public.is_staff());
create policy "categories_admin_write" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 12.6 products
create policy "products_public_read" on public.products for select to anon, authenticated
  using (is_active);
create policy "products_staff_read_all" on public.products for select to authenticated
  using (public.is_staff());
create policy "products_admin_write" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 12.7 branch_inventory (staff only; shoppers use the product_availability view)
create policy "inventory_staff_select" on public.branch_inventory for select to authenticated
  using (public.staff_can_access_branch(branch_id));
create policy "inventory_staff_insert" on public.branch_inventory for insert to authenticated
  with check (public.staff_can_access_branch(branch_id));
create policy "inventory_staff_update" on public.branch_inventory for update to authenticated
  using (public.staff_can_access_branch(branch_id)) with check (public.staff_can_access_branch(branch_id));
create policy "inventory_admin_delete" on public.branch_inventory for delete to authenticated
  using (public.is_admin());

-- 12.8 discounts (admin only; shoppers validate via calculate_discount())
create policy "discounts_admin_all" on public.discounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 12.9 prescriptions (medical data: patient + pharmacists/admins only)
create policy "rx_select_own_or_pharmacist" on public.prescriptions for select to authenticated
  using (patient_id = (select auth.uid()) or public.is_pharmacist());
create policy "rx_insert_own_pending" on public.prescriptions for insert to authenticated
  with check (patient_id = (select auth.uid()) and status = 'pending');
create policy "rx_update_pharmacist" on public.prescriptions for update to authenticated
  using (public.is_pharmacist()) with check (public.is_pharmacist());
create policy "rx_update_own_cancel" on public.prescriptions for update to authenticated
  using (patient_id = (select auth.uid()) and status = 'pending')
  with check (patient_id = (select auth.uid()) and status in ('pending', 'cancelled'));

-- 12.10 orders (created only through place_order())
create policy "orders_select_own_or_staff" on public.orders for select to authenticated
  using (patient_id = (select auth.uid()) or public.staff_can_access_branch(branch_id));
create policy "orders_update_own_or_staff" on public.orders for update to authenticated
  using (patient_id = (select auth.uid()) or public.staff_can_access_branch(branch_id))
  with check (patient_id = (select auth.uid()) or public.staff_can_access_branch(branch_id));

-- 12.11 order_items (inherit visibility from orders)
create policy "order_items_select_via_order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

-- 12.12 payments (read-only for users; writes via service role)
create policy "payments_select_via_order" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = payments.order_id));

-- 12.13 subscriptions
create policy "subscriptions_select_own_or_staff" on public.subscriptions for select to authenticated
  using (patient_id = (select auth.uid()) or public.staff_can_access_branch(branch_id));
create policy "subscriptions_insert_own" on public.subscriptions for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = subscriptions.product_id
        and p.is_active
        and p.is_chronic_eligible
        and (
          not p.requires_prescription
          or exists (
            select 1 from public.prescriptions rx
            where rx.id = subscriptions.prescription_id
              and rx.patient_id = (select auth.uid())
              and rx.status = 'approved'
          )
        )
    )
  );
create policy "subscriptions_update_own" on public.subscriptions for update to authenticated
  using (patient_id = (select auth.uid()))
  with check (
    patient_id = (select auth.uid())
    and (
      prescription_id is null
      or exists (
        select 1 from public.prescriptions rx
        where rx.id = subscriptions.prescription_id and rx.patient_id = (select auth.uid())
      )
    )
  );
create policy "subscriptions_delete_own" on public.subscriptions for delete to authenticated
  using (patient_id = (select auth.uid()));

-- 12.14 audit_logs (admins read; inserts only via trigger)
create policy "audit_admin_select" on public.audit_logs for select to authenticated
  using (public.is_admin());

-- 12.15 webhook_events: RLS on, no policies, no grants => service role only

-- ---------------------------------------------------------------------
-- 13. STORAGE BUCKETS + POLICIES
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prescriptions', 'prescriptions', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Prescriptions bucket: files live under "<patient_uuid>/<filename>"
create policy "rx_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "rx_files_select_own_or_pharmacist" on storage.objects for select to authenticated
  using (bucket_id = 'prescriptions'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_pharmacist()));
create policy "rx_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'prescriptions' and public.is_admin());

-- Product images: public read, admin write
create policy "product_images_public_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "product_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 14. VIEWS
-- ---------------------------------------------------------------------
-- Shoppers see only in/out of stock per branch, never raw quantities.
-- (Intentionally a definer view so it can read branch_inventory for everyone.)
create view public.product_availability as
  select product_id, branch_id, (quantity - reserved_quantity) > 0 as in_stock
  from public.branch_inventory;
grant select on public.product_availability to anon, authenticated;

-- Staff low-stock alerts (security_invoker => RLS applies, so staff see only their branch)
create view public.low_stock_alerts with (security_invoker = true) as
  select
    bi.id                               as inventory_id,
    bi.branch_id,
    b.name                              as branch_name,
    bi.product_id,
    p.name                              as product_name,
    p.sku,
    bi.quantity,
    bi.reserved_quantity,
    (bi.quantity - bi.reserved_quantity) as available_quantity,
    bi.reorder_level
  from public.branch_inventory bi
  join public.branches b on b.id = bi.branch_id
  join public.products p on p.id = bi.product_id
  where (bi.quantity - bi.reserved_quantity) <= bi.reorder_level;
grant select on public.low_stock_alerts to authenticated;

-- ---------------------------------------------------------------------
-- 15. RPC FUNCTIONS
-- ---------------------------------------------------------------------

-- 15.1 Nearest branches (haversine, km)
create or replace function public.nearest_branches(
  p_lat double precision,
  p_lng double precision,
  p_limit int default 5
)
returns table (
  id uuid, name text, slug text, address text, town text, county text, phone text,
  latitude double precision, longitude double precision,
  offers_pickup boolean, offers_delivery boolean, opening_hours jsonb,
  distance_km double precision
)
language sql stable
as $$
  select
    b.id, b.name, b.slug, b.address, b.town, b.county, b.phone,
    b.latitude, b.longitude, b.offers_pickup, b.offers_delivery, b.opening_hours,
    round((6371 * acos(least(1, greatest(-1,
      cos(radians(p_lat)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(b.latitude))
    ))))::numeric, 2)::double precision as distance_km
  from public.branches b
  where b.is_active
  order by distance_km
  limit greatest(p_limit, 1);
$$;

-- 15.2 Discount calculation (also used internally by place_order)
create or replace function public.calculate_discount(p_code text, p_subtotal numeric)
returns table (discount_id uuid, discount_amount numeric, message text)
language plpgsql stable security definer set search_path = public
as $$
declare
  d   public.discounts%rowtype;
  amt numeric;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select null::uuid, 0::numeric, null::text;
    return;
  end if;

  select * into d from public.discounts where upper(code) = upper(btrim(p_code)) and is_active;
  if not found then
    return query select null::uuid, 0::numeric, 'Invalid discount code'::text;
    return;
  end if;
  if d.starts_at is not null and d.starts_at > now() then
    return query select null::uuid, 0::numeric, 'This code is not active yet'::text;
    return;
  end if;
  if d.ends_at is not null and d.ends_at < now() then
    return query select null::uuid, 0::numeric, 'This code has expired'::text;
    return;
  end if;
  if d.usage_limit is not null and d.used_count >= d.usage_limit then
    return query select null::uuid, 0::numeric, 'This code has been fully redeemed'::text;
    return;
  end if;
  if p_subtotal < d.min_order_amount then
    return query select null::uuid, 0::numeric, ('Minimum order of KES ' || d.min_order_amount::text || ' required')::text;
    return;
  end if;

  if d.discount_type = 'percentage' then
    amt := round(p_subtotal * d.value / 100, 2);
  else
    amt := d.value;
  end if;
  if d.max_discount_amount is not null then
    amt := least(amt, d.max_discount_amount);
  end if;
  amt := least(amt, p_subtotal);

  return query select d.id, amt, 'Discount applied'::text;
end;
$$;

-- 15.3 Secure order placement
-- p_items example: [{"product_id":"<uuid>","quantity":2},{"product_id":"<uuid>","quantity":1}]
create or replace function public.place_order(
  p_branch_id       uuid,
  p_fulfilment      public.fulfilment_type,
  p_payment_method  public.payment_method,
  p_items           jsonb,
  p_address_id      uuid default null,
  p_prescription_id uuid default null,
  p_discount_code   text default null,
  p_notes           text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_branch       public.branches%rowtype;
  v_address      jsonb;
  v_requested    int;
  v_resolved     int;
  v_subtotal     numeric(12,2);
  v_needs_rx     boolean;
  v_rx_id        uuid;
  v_rx_status    public.rx_status;
  v_discount     record;
  v_discount_amt numeric(12,2) := 0;
  v_fee          numeric(12,2) := 0;
  v_total        numeric(12,2);
  v_status       public.order_status;
  v_item         record;
  v_order_id     uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Validate payload shape
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where i->>'product_id' is null
       or coalesce((i->>'quantity')::int, 0) < 1
       or (i->>'quantity')::int > 50
  ) then
    raise exception 'Invalid cart items';
  end if;

  -- Branch and fulfilment
  select * into v_branch from public.branches where id = p_branch_id and is_active;
  if not found then
    raise exception 'The selected branch is not available';
  end if;
  if p_fulfilment = 'pickup' and not v_branch.offers_pickup then
    raise exception 'This branch does not offer pickup';
  end if;
  if p_fulfilment = 'delivery' and not v_branch.offers_delivery then
    raise exception 'This branch does not offer delivery';
  end if;
  if p_payment_method = 'cash_on_pickup' and p_fulfilment <> 'pickup' then
    raise exception 'Cash payment is only available for pickup orders';
  end if;

  if p_fulfilment = 'delivery' then
    select to_jsonb(a) - 'patient_id' into v_address
      from public.addresses a
     where a.id = p_address_id and a.patient_id = v_uid;
    if v_address is null then
      raise exception 'A valid delivery address is required';
    end if;
  end if;

  -- Re-price from the database (never trust client prices)
  select count(distinct (i->>'product_id')) into v_requested from jsonb_array_elements(p_items) i;

  select count(*), coalesce(sum(p.price_kes * t.qty), 0), coalesce(bool_or(p.requires_prescription), false)
    into v_resolved, v_subtotal, v_needs_rx
    from (
      select (i->>'product_id')::uuid as pid, sum((i->>'quantity')::int) as qty
        from jsonb_array_elements(p_items) i
       group by 1
    ) t
    join public.products p on p.id = t.pid and p.is_active;

  if v_resolved <> v_requested then
    raise exception 'One or more products are no longer available';
  end if;

  -- Prescription rule
  if v_needs_rx then
    if p_prescription_id is null then
      raise exception 'This order contains prescription-only items. Please attach a prescription.';
    end if;
    select rx.status into v_rx_status
      from public.prescriptions rx
     where rx.id = p_prescription_id
       and rx.patient_id = v_uid
       and rx.status in ('pending', 'approved')
       and (rx.expires_at is null or rx.expires_at > now());
    if not found then
      raise exception 'Prescription not found, expired, or not valid for ordering';
    end if;
    v_rx_id := p_prescription_id;
  end if;

  -- Discount
  select * into v_discount from public.calculate_discount(p_discount_code, v_subtotal);
  if p_discount_code is not null and btrim(p_discount_code) <> '' and v_discount.discount_id is null then
    raise exception '%', v_discount.message;
  end if;
  v_discount_amt := coalesce(v_discount.discount_amount, 0);
  if v_discount.discount_id is not null then
    update public.discounts
       set used_count = used_count + 1
     where id = v_discount.discount_id
       and (usage_limit is null or used_count < usage_limit);
    if not found then
      raise exception 'This discount code is no longer available';
    end if;
  end if;

  -- Delivery fee
  if p_fulfilment = 'delivery' then
    if v_branch.free_delivery_threshold is not null and v_subtotal >= v_branch.free_delivery_threshold then
      v_fee := 0;
    else
      v_fee := v_branch.delivery_fee;
    end if;
  end if;

  v_total := greatest(v_subtotal - v_discount_amt + v_fee, 0);

  -- Reserve stock atomically (fails the whole order if any line is short)
  for v_item in
    select t.pid, t.qty, p.name
      from (
        select (i->>'product_id')::uuid as pid, sum((i->>'quantity')::int) as qty
          from jsonb_array_elements(p_items) i
         group by 1
      ) t
      join public.products p on p.id = t.pid
  loop
    update public.branch_inventory
       set reserved_quantity = reserved_quantity + v_item.qty
     where branch_id = p_branch_id
       and product_id = v_item.pid
       and quantity - reserved_quantity >= v_item.qty;
    if not found then
      raise exception 'Insufficient stock at this branch for %', v_item.name;
    end if;
  end loop;

  -- Initial status
  if v_needs_rx and v_rx_status <> 'approved' then
    v_status := 'awaiting_verification';
  elsif p_payment_method = 'cash_on_pickup' then
    v_status := 'confirmed';
  else
    v_status := 'pending_payment';
  end if;

  insert into public.orders (
    patient_id, branch_id, status, fulfilment_type, delivery_address,
    subtotal, discount_total, delivery_fee, total,
    discount_id, prescription_id, payment_method, notes
  )
  values (
    v_uid, p_branch_id, v_status, p_fulfilment, v_address,
    v_subtotal, v_discount_amt, v_fee, v_total,
    v_discount.discount_id, v_rx_id, p_payment_method, nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, sku, unit_price, quantity, line_total)
  select v_order_id, p.id, p.name, p.sku, p.price_kes, t.qty, p.price_kes * t.qty
    from (
      select (i->>'product_id')::uuid as pid, sum((i->>'quantity')::int) as qty
        from jsonb_array_elements(p_items) i
       group by 1
    ) t
    join public.products p on p.id = t.pid;

  return v_order_id;
end;
$$;

-- Lock down who may call the RPCs
revoke all on function public.place_order(uuid, public.fulfilment_type, public.payment_method, jsonb, uuid, uuid, text, text) from public, anon;
grant execute on function public.place_order(uuid, public.fulfilment_type, public.payment_method, jsonb, uuid, uuid, text, text) to authenticated;

revoke all on function public.calculate_discount(text, numeric) from public, anon;
grant execute on function public.calculate_discount(text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 16. SAMPLE SEED DATA (safe to edit or delete later)
-- ---------------------------------------------------------------------
insert into public.branches
  (name, slug, address, town, county, phone, latitude, longitude, opening_hours, delivery_fee, free_delivery_threshold, delivery_radius_km)
values
  ('Nairobi CBD Branch',   'nairobi-cbd',  'Moi Avenue, Nairobi CBD',        'Nairobi', 'Nairobi', '254700000001', -1.2833, 36.8219,
    '{"mon_fri":"07:30-20:00","sat":"08:00-19:00","sun":"09:00-17:00"}'::jsonb, 200, 3000, 12),
  ('Westlands Branch',     'westlands',    'Woodvale Grove, Westlands',      'Nairobi', 'Nairobi', '254700000002', -1.2676, 36.8108,
    '{"mon_fri":"07:00-21:00","sat":"08:00-21:00","sun":"09:00-19:00"}'::jsonb, 250, 3500, 10),
  ('Nyeri Town Branch',    'nyeri-town',   'Kenyatta Road, Nyeri Town',      'Nyeri',   'Nyeri',   '254700000003', -0.4167, 36.9500,
    '{"mon_fri":"08:00-19:00","sat":"08:00-18:00","sun":"10:00-16:00"}'::jsonb, 300, 4000, 15);

insert into public.categories (name, slug, sort_order) values
  ('Prescription Medicines',   'prescription-medicines', 1),
  ('Pain Relief',              'pain-relief',            2),
  ('Vitamins & Supplements',   'vitamins-supplements',   3),
  ('Chronic Care',             'chronic-care',           4),
  ('Skincare',                 'skincare',               5),
  ('First Aid & Antiseptics',  'first-aid',              6),
  ('Baby & Mum',               'baby-mum',               7),
  ('Personal Care',            'personal-care',          8);

insert into public.brands (name, slug) values
  ('Panadol', 'panadol'),
  ('Centrum', 'centrum'),
  ('Nivea',   'nivea'),
  ('Dettol',  'dettol');

insert into public.products
  (sku, slug, name, generic_name, description, brand_id, category_id, dosage_form, strength, pack_size,
   price_kes, requires_prescription, is_chronic_eligible)
values
  ('OTC-PANADOL-EXTRA-24', 'panadol-extra-24-tablets', 'Panadol Extra 24 Tablets', 'Paracetamol + Caffeine',
   'Fast relief from headache, muscle aches and fever.',
   (select id from public.brands where slug = 'panadol'), (select id from public.categories where slug = 'pain-relief'),
   'Tablet', '500mg/65mg', '24 tablets', 320, false, false),
  ('OTC-CENTRUM-ADV-30', 'centrum-advance-30-tablets', 'Centrum Advance 30 Tablets', 'Multivitamin & Minerals',
   'Daily multivitamin for adults.',
   (select id from public.brands where slug = 'centrum'), (select id from public.categories where slug = 'vitamins-supplements'),
   'Tablet', null, '30 tablets', 1450, false, true),
  ('OTC-NIVEA-SOFT-200', 'nivea-soft-cream-200ml', 'Nivea Soft Moisturising Cream 200ml', null,
   'Light moisturising cream for face, hands and body.',
   (select id from public.brands where slug = 'nivea'), (select id from public.categories where slug = 'skincare'),
   'Cream', null, '200ml', 590, false, false),
  ('OTC-DETTOL-ANTI-500', 'dettol-antiseptic-500ml', 'Dettol Antiseptic Liquid 500ml', 'Chloroxylenol',
   'Antiseptic disinfectant for cuts, grazes and household use.',
   (select id from public.brands where slug = 'dettol'), (select id from public.categories where slug = 'first-aid'),
   'Liquid', null, '500ml', 780, false, false),
  ('RX-AMOX-500-21', 'amoxicillin-500mg-21-capsules', 'Amoxicillin 500mg Capsules', 'Amoxicillin',
   'Antibiotic. Prescription required.',
   null, (select id from public.categories where slug = 'prescription-medicines'),
   'Capsule', '500mg', '21 capsules', 450, true, false),
  ('RX-METFORMIN-500-100', 'metformin-500mg-100-tablets', 'Metformin 500mg Tablets', 'Metformin Hydrochloride',
   'Type 2 diabetes management. Prescription required.',
   null, (select id from public.categories where slug = 'chronic-care'),
   'Tablet', '500mg', '100 tablets', 600, true, true),
  ('RX-AMLODIPINE-5-30', 'amlodipine-5mg-30-tablets', 'Amlodipine 5mg Tablets', 'Amlodipine Besilate',
   'Blood pressure management. Prescription required.',
   null, (select id from public.categories where slug = 'chronic-care'),
   'Tablet', '5mg', '30 tablets', 380, true, true),
  ('RX-OMEPRAZOLE-20-14', 'omeprazole-20mg-14-capsules', 'Omeprazole 20mg Capsules', 'Omeprazole',
   'Reduces stomach acid. Prescription required.',
   null, (select id from public.categories where slug = 'prescription-medicines'),
   'Capsule', '20mg', '14 capsules', 420, true, false);

insert into public.branch_inventory (branch_id, product_id, quantity, reorder_level)
select b.id, p.id, 40 + (abs(hashtext(b.slug || p.sku)) % 160), 15
from public.branches b
cross join public.products p;

insert into public.discounts (code, description, discount_type, value, min_order_amount, max_discount_amount, ends_at)
values ('WELCOME10', '10% off your first order (max KES 500)', 'percentage', 10, 1000, 500, now() + interval '1 year');

-- ---------------------------------------------------------------------
-- 17. REFRESH API SCHEMA CACHE + VERIFY RLS (last result shown in editor)
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;
