DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'widgets'
          AND table_name = 'widgets'
          AND column_name = 'metadata'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'widgets'
          AND table_name = 'widgets'
          AND column_name = 'additional_data'
    ) THEN
        ALTER TABLE WIDGETS.WIDGETS
            RENAME COLUMN METADATA TO ADDITIONAL_DATA;
    END IF;
END $$;
