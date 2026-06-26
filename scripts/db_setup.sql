-- SQL Schema Initialization for Collaborative Document Editor
-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    last_compacted_lamport BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Document Collaborators (Permissions & Roles)
CREATE TABLE IF NOT EXISTS document_collaborators (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    PRIMARY KEY (document_id, user_id)
);

-- 4. Operations (Event Sourcing / CRDT Log)
CREATE TABLE IF NOT EXISTS operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- 'upsert_block', 'delete_block', 'set_title'
    block_id VARCHAR(100),     -- Null for 'set_title'
    content TEXT,              -- Null for 'delete_block'
    block_type VARCHAR(50),    -- 'paragraph', 'heading', etc.
    position VARCHAR(255),     -- Fractional index string
    timestamp BIGINT NOT NULL,
    lamport BIGINT NOT NULL,
    client_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Document Versions (Snapshots for Time Travel / Compaction)
CREATE TABLE IF NOT EXISTS versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_name VARCHAR(100) NOT NULL,
    content_snapshot TEXT NOT NULL, -- JSON string of compiled blocks
    lamport BIGINT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_doc_lamport ON operations(document_id, lamport);
CREATE INDEX IF NOT EXISTS idx_versions_doc ON versions(document_id);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

-- Helper Function to check if the current user has access to a document
CREATE OR REPLACE FUNCTION has_document_access(doc_id UUID, req_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM documents d WHERE d.id = doc_id AND d.owner_id = req_user_id
    ) OR EXISTS (
        SELECT 1 FROM document_collaborators dc WHERE dc.document_id = doc_id AND dc.user_id = req_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Define RLS Policies based on 'app.current_user_id' session setting
-- To act as a tenant, queries must set the config first: SET LOCAL app.current_user_id = 'user-uuid'

-- RLS for Documents
CREATE POLICY doc_access_policy ON documents
    FOR ALL
    USING (
        owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
        OR EXISTS (
            SELECT 1 FROM document_collaborators dc 
            WHERE dc.document_id = id 
            AND dc.user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
        )
    );

-- RLS for Document Collaborators
CREATE POLICY collaborator_access_policy ON document_collaborators
    FOR ALL
    USING (
        has_document_access(document_id, NULLIF(current_setting('app.current_user_id', true), '')::UUID)
    );

-- RLS for Operations
CREATE POLICY operation_access_policy ON operations
    FOR ALL
    USING (
        has_document_access(document_id, NULLIF(current_setting('app.current_user_id', true), '')::UUID)
    );

-- RLS for Versions
CREATE POLICY version_access_policy ON versions
    FOR ALL
    USING (
        has_document_access(document_id, NULLIF(current_setting('app.current_user_id', true), '')::UUID)
    );
