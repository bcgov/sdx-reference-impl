CREATE TABLE IF NOT EXISTS USERS.WIDGETS
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
    ON USERS.WIDGETS (SUBJECT);
