CREATE TABLE IF NOT EXISTS WIDGETS.USERS
(
    SUBJECT      varchar(255)             not null
        constraint "USER_PK"
            primary key,
    DISPLAY_NAME varchar(255)             not null,
    LAST_SEEN_AT timestamp with time zone not null DEFAULT now(),
    CREATED_AT   timestamp with time zone not null DEFAULT now(),
    UPDATED_AT   timestamp with time zone not null DEFAULT now()
);

INSERT INTO WIDGETS.USERS (SUBJECT, DISPLAY_NAME)
SELECT DISTINCT SUBJECT, SUBJECT
FROM WIDGETS.WIDGETS
ON CONFLICT (SUBJECT) DO NOTHING;
