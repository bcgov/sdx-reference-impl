CREATE SCHEMA IF NOT EXISTS WIDGETS;

CREATE TABLE IF NOT EXISTS WIDGETS.WIDGETS
(
    ID          uuid                     not null
        constraint "WIDGET_PK"
            primary key,
    SUBJECT     varchar(255)             not null,
    NAME        varchar(200)             not null,
    DESCRIPTION varchar(1000),
    STATUS      varchar(20)              not null DEFAULT 'active',
    METADATA    jsonb                    not null DEFAULT '{}'::jsonb,
    CREATED_AT  timestamp with time zone not null DEFAULT now(),
    UPDATED_AT  timestamp with time zone not null DEFAULT now(),
    constraint "WIDGET_STATUS_CK"
        check (STATUS in ('active', 'inactive', 'archived'))
);

CREATE INDEX IF NOT EXISTS "WIDGET_SUBJECT_IDX"
    ON WIDGETS.WIDGETS (SUBJECT);

CREATE TABLE IF NOT EXISTS WIDGETS.WIDGET_IDEMPOTENCY
(
    ID              uuid                     not null
        constraint "WIDGET_IDEMPOTENCY_PK"
            primary key,
    SUBJECT         varchar(255)             not null,
    IDEMPOTENCY_KEY varchar(255)             not null,
    REQUEST_HASH    varchar(64)              not null,
    WIDGET_ID       uuid                     not null
        constraint "WIDGET_IDEMPOTENCY_WIDGET_FK"
            references WIDGETS.WIDGETS
            on delete cascade,
    CREATED_AT      timestamp with time zone not null DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "WIDGET_IDEMPOTENCY_UQ"
    ON WIDGETS.WIDGET_IDEMPOTENCY (SUBJECT, IDEMPOTENCY_KEY);

CREATE INDEX IF NOT EXISTS "WIDGET_IDEMPOTENCY_WIDGET_ID_IDX"
    ON WIDGETS.WIDGET_IDEMPOTENCY (WIDGET_ID);
