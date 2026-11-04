-- Databases made before migrations existed are marked as already at version 1, so this could be
-- the first script they run. They might not have this newer table yet.
CREATE TABLE IF NOT EXISTS document_files (
    document_id  VARCHAR(30) NOT NULL PRIMARY KEY,
    content_type VARCHAR(40) NOT NULL,
    content      LONGBLOB    NOT NULL,
    CONSTRAINT fk_file_document FOREIGN KEY (document_id) REFERENCES documents (id)
);

-- A new lender stays hidden from applicants until an admin approves it.
-- Lenders that already exist were active before this rule, so they stay approved.
ALTER TABLE lender_profiles ADD COLUMN approval_status VARCHAR(10) NOT NULL DEFAULT 'PENDING';
UPDATE lender_profiles SET approval_status = 'APPROVED';

-- Existing accounts stay usable. New ones confirm their email when a mail service is set up.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET email_verified = TRUE;

CREATE TABLE email_verification_tokens (
    id         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    VARCHAR(20) NOT NULL,
    token_hash CHAR(64)    NOT NULL UNIQUE,
    expires_at DATETIME(6) NOT NULL,
    used       BOOLEAN     NOT NULL,
    CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users (id)
);

-- The applicant's answer when a lender asks for more information.
ALTER TABLE lender_decisions
    ADD COLUMN applicant_reply    VARCHAR(500) NULL,
    ADD COLUMN applicant_reply_at DATETIME(6)  NULL;
