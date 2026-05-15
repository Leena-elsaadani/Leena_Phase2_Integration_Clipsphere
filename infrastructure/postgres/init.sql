CREATE DATABASE authdb;
CREATE DATABASE userdb;

\c authdb

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO users (id, email, name, role) VALUES
('00000000-0000-0000-0000-000000000001', 'john.smith@example.com', 'John Smith', 'user'),
('00000000-0000-0000-0000-000000000002', 'johnny.carter@example.com', 'Johnny Carter', 'user'),
('00000000-0000-0000-0000-000000000003', 'john.doe@example.com', 'John Doe', 'user'),
('00000000-0000-0000-0000-000000000004', 'sarah.johnson@example.com', 'Sarah Johnson', 'user'),
('00000000-0000-0000-0000-000000000005', 'emily.brown@example.com', 'Emily Brown', 'user'),
('00000000-0000-0000-0000-000000000006', 'michael.davis@example.com', 'Michael Davis', 'user'),
('00000000-0000-0000-0000-000000000007', 'jane.wilson@example.com', 'Jane Wilson', 'user'),
('00000000-0000-0000-0000-000000000008', 'alice.cooper@example.com', 'Alice Cooper', 'user'),
('00000000-0000-0000-0000-000000000009', 'robert.taylor@example.com', 'Robert Taylor', 'user'),
('00000000-0000-0000-0000-000000000010', 'david.miller@example.com', 'David Miller', 'user')
ON CONFLICT (id) DO NOTHING;
