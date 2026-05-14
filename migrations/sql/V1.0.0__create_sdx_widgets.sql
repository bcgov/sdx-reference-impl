CREATE SCHEMA IF NOT EXISTS USERS;

CREATE TABLE IF NOT EXISTS USERS.SDX_WIDGETS
(
    ID          uuid                     not null
        constraint "SDX_WIDGET_PK"
            primary key,
    SUBJECT     varchar(255)             not null,
    NAME        varchar(200)             not null,
    DESCRIPTION varchar(1000),
    STATUS      varchar(20)              not null DEFAULT 'active',
    METADATA    jsonb                    not null DEFAULT '{}'::jsonb,
    CREATED_AT  timestamp with time zone not null DEFAULT now(),
    UPDATED_AT  timestamp with time zone not null DEFAULT now(),
    constraint "SDX_WIDGET_STATUS_CK"
        check (STATUS in ('active', 'inactive', 'archived'))
);

CREATE INDEX IF NOT EXISTS "SDX_WIDGET_SUBJECT_IDX"
    ON USERS.SDX_WIDGETS (SUBJECT);

CREATE TABLE IF NOT EXISTS USERS.SDX_WIDGET_IDEMPOTENCY
(
    ID              uuid                     not null
        constraint "SDX_WIDGET_IDEMPOTENCY_PK"
            primary key,
    SUBJECT         varchar(255)             not null,
    IDEMPOTENCY_KEY varchar(255)             not null,
    REQUEST_HASH    varchar(64)              not null,
    WIDGET_ID       uuid                     not null
        constraint "SDX_WIDGET_IDEMPOTENCY_WIDGET_FK"
            references USERS.SDX_WIDGETS
            on delete cascade,
    CREATED_AT      timestamp with time zone not null DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SDX_WIDGET_IDEMPOTENCY_UQ"
    ON USERS.SDX_WIDGET_IDEMPOTENCY (SUBJECT, IDEMPOTENCY_KEY);

CREATE INDEX IF NOT EXISTS "SDX_WIDGET_IDEMPOTENCY_WIDGET_ID_IDX"
    ON USERS.SDX_WIDGET_IDEMPOTENCY (WIDGET_ID);
