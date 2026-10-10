-- Схема базы YDB. Применяется скриптом migrate.js.
CREATE TABLE IF NOT EXISTS guests (
    id Utf8 NOT NULL,
    name Utf8,
    know Uint8,
    reason Utf8,
    skills Utf8, -- JSON-массив строк
    seat Uint8,  -- NULL, пока гость не выбрал место
    created_at Timestamp,
    updated_at Timestamp,
    PRIMARY KEY (id)
);
