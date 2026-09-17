create table payment_accounts (
 id bigserial primary key,
 name varchar(120) not null,
 beneficiary_name varchar(200) not null,
 bank_code varchar(30) not null,
 bank_name varchar(120) not null,
 account_number varchar(40) not null,
 account_holder varchar(150) not null,
 qr_template varchar(80) not null default 'compact2',
 status varchar(20) not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),
 created_at timestamp not null default now()
);
create table course_fee_policies (
 course_instance_id bigint primary key references course_instances(id),
 payment_account_id bigint not null references payment_accounts(id),
 calculation varchar(20) not null check(calculation in ('PER_SESSION','FIXED')),
 unit_price numeric(15,0) not null check(unit_price>0),
 discount_amount numeric(15,0) not null default 0 check(discount_amount>=0),
 installments integer not null default 1 check(installments between 1 and 36),
 first_due_date date not null,
 period_months integer not null default 1 check(period_months between 1 and 12),
 bank_qr boolean not null default true,
 cash boolean not null default false,
 updated_by bigint not null references users(id),
 updated_at timestamp not null default now(),
 check(bank_qr or cash)
);
create table student_fees (
 id bigserial primary key,
 course_instance_id bigint not null references course_instances(id),
 student_id bigint not null references users(id),
 payment_account_id bigint not null references payment_accounts(id),
 title varchar(250) not null,
 installment_no integer not null check(installment_no>0),
 amount numeric(15,0) not null check(amount>0),
 due_date date not null,
 payment_reference varchar(30) not null unique,
 status varchar(30) not null default 'DRAFT' check(status in ('DRAFT','CONFIRMED','PARTIALLY_PAID','PAID','CANCELLED')),
 bank_qr boolean not null,
 cash boolean not null,
 confirmed_by bigint references users(id),
 confirmed_at timestamp,
 created_at timestamp not null default now(),
 updated_at timestamp not null default now(),
 unique(course_instance_id,student_id,installment_no)
);
create index student_fees_student_status on student_fees(student_id,status);
create table payment_transactions (
 id bigserial primary key,
 student_fee_id bigint not null references student_fees(id),
 payment_account_id bigint not null references payment_accounts(id),
 payment_reference varchar(30) not null,
 amount numeric(15,0) not null check(amount>0),
 method varchar(25) not null check(method in ('BANK_QR','CASH','ONLINE')),
 provider varchar(50) not null default 'MANUAL',
 status varchar(25) not null check(status in ('PENDING','PROCESSING','SUCCESS','FAILED','CANCELLED','REFUNDED')),
 provider_transaction_id varchar(160),
 paid_at timestamp,
 confirmed_at timestamp,
 confirmed_by bigint references users(id),
 confirmation_method varchar(60),
 note text,
 created_by bigint not null references users(id),
 created_at timestamp not null default now(),
 updated_at timestamp not null default now(),
 check(status<>'SUCCESS' or (confirmed_at is not null and confirmed_by is not null and provider_transaction_id is not null))
);
create index payment_transactions_fee on payment_transactions(student_fee_id,status);
create unique index payment_transactions_one_pending on payment_transactions(student_fee_id) where status in ('PENDING','PROCESSING');
create unique index payment_transactions_bank_reference on payment_transactions(payment_account_id,provider,provider_transaction_id) where provider_transaction_id is not null;
create table payment_confirmation_events (
 id bigserial primary key,
 transaction_id bigint not null references payment_transactions(id),
 action varchar(40) not null,
 actor_id bigint not null references users(id),
 note text,
 created_at timestamp not null default now()
);
