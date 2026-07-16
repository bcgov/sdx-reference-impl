CREATE TABLE IF NOT EXISTS WIDGETS.WIDGET_ACCESS_EVENTS
(
    ID         uuid                     not null
        constraint "WIDGET_ACCESS_EVENT_PK"
            primary key,
    SUBJECT    varchar(255)             not null,
    USERNAME   varchar(255)             not null,
    EVENT      varchar(100)             not null,
    CREATED_AT timestamp with time zone not null DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "WIDGET_ACCESS_EVENT_SUBJECT_IDX"
    ON WIDGETS.WIDGET_ACCESS_EVENTS (SUBJECT);

CREATE INDEX IF NOT EXISTS "WIDGET_ACCESS_EVENT_CREATED_AT_IDX"
    ON WIDGETS.WIDGET_ACCESS_EVENTS (CREATED_AT);
