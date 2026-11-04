-- Hibernate only validates this schema; it never changes it. Statements are safe to re-run.

CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(20)  NOT NULL PRIMARY KEY,
    role          VARCHAR(20)  NOT NULL,
    email         VARCHAR(190) NOT NULL UNIQUE,
    phone         VARCHAR(20)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at    DATETIME(6)  NOT NULL
);

CREATE TABLE IF NOT EXISTS beneficiary_profiles (
    user_id    VARCHAR(20)  NOT NULL PRIMARY KEY,
    name       VARCHAR(80)  NOT NULL,
    age        INT          NULL,
    occupation VARCHAR(80)  NULL,
    address    VARCHAR(200) NULL,
    city       VARCHAR(80)  NULL,
    state      VARCHAR(80)  NULL,
    pincode    VARCHAR(6)   NULL,
    CONSTRAINT fk_beneficiary_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS lender_profiles (
    user_id          VARCHAR(20)  NOT NULL PRIMARY KEY,
    institution_name VARCHAR(100) NOT NULL,
    contact_person   VARCHAR(80)  NOT NULL,
    license_number   VARCHAR(40)  NOT NULL,
    logo_color       VARCHAR(7)   NOT NULL,
    CONSTRAINT fk_lender_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                  BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id             VARCHAR(20)  NOT NULL,
    token_hash          CHAR(64)     NOT NULL UNIQUE,
    expires_at          DATETIME(6)  NOT NULL,
    rotated_at          DATETIME(6)  NULL,
    revoked             BOOLEAN      NOT NULL,
    persistent          BOOLEAN      NOT NULL,
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    VARCHAR(20) NOT NULL,
    token_hash CHAR(64)    NOT NULL UNIQUE,
    expires_at DATETIME(6) NOT NULL,
    used       BOOLEAN     NOT NULL,
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS loan_applications (
    id                VARCHAR(20)    NOT NULL PRIMARY KEY,
    beneficiary_id    VARCHAR(20)    NOT NULL,
    monthly_income    DECIMAL(14, 2) NOT NULL,
    monthly_expenses  DECIMAL(14, 2) NOT NULL,
    existing_emi      DECIMAL(14, 2) NOT NULL,
    loan_amount       DECIMAL(14, 2) NOT NULL,
    loan_purpose      VARCHAR(30)    NOT NULL,
    tenure_months     INT            NOT NULL,
    repayment_history VARCHAR(10)    NOT NULL,
    electricity_usage DECIMAL(10, 2) NULL,
    status            VARCHAR(20)    NOT NULL,
    consent_given_at  DATETIME(6)    NOT NULL,
    submitted_at      DATETIME(6)    NOT NULL,
    last_updated_at   DATETIME(6)    NOT NULL,
    INDEX idx_application_beneficiary (beneficiary_id),
    CONSTRAINT fk_application_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS credit_assessments (
    application_id         VARCHAR(20)   NOT NULL PRIMARY KEY,
    risk_score             INT           NOT NULL,
    risk_category          VARCHAR(10)   NOT NULL,
    probability_of_default DECIMAL(5, 4) NULL,
    model_confidence       DECIMAL(5, 4) NULL,
    income_bracket         VARCHAR(20)   NOT NULL,
    composite_score        INT           NOT NULL,
    segment                VARCHAR(20)   NOT NULL,
    is_thin_file           BOOLEAN       NOT NULL,
    explanations           TEXT          NOT NULL,
    explanation_method     VARCHAR(20)   NOT NULL,
    verification_status    VARCHAR(20)   NOT NULL,
    CONSTRAINT fk_assessment_application FOREIGN KEY (application_id) REFERENCES loan_applications (id)
);

-- A row here is what gives a lender access to an application.
CREATE TABLE IF NOT EXISTS lender_decisions (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(20)  NOT NULL,
    lender_id      VARCHAR(20)  NOT NULL,
    status         VARCHAR(20)  NOT NULL,
    note           VARCHAR(500) NULL,
    last_updated   DATETIME(6)  NOT NULL,
    UNIQUE KEY uq_decision (application_id, lender_id),
    INDEX idx_decision_lender (lender_id),
    CONSTRAINT fk_decision_application FOREIGN KEY (application_id) REFERENCES loan_applications (id),
    CONSTRAINT fk_decision_lender FOREIGN KEY (lender_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS loan_offers (
    id             VARCHAR(20)    NOT NULL PRIMARY KEY,
    application_id VARCHAR(20)    NOT NULL,
    lender_id      VARCHAR(20)    NOT NULL,
    amount         DECIMAL(14, 2) NOT NULL,
    interest_rate  DECIMAL(5, 2)  NOT NULL,
    tenure_months  INT            NOT NULL,
    status         VARCHAR(20)    NOT NULL,
    features       VARCHAR(500)   NOT NULL,
    created_at     DATETIME(6)    NOT NULL,
    expires_at     DATETIME(6)    NULL,
    -- Set only on an accepted offer, so the database itself allows one per application.
    accepted_application_id VARCHAR(20) GENERATED ALWAYS AS (CASE WHEN status = 'ACCEPTED' THEN application_id END) STORED,
    UNIQUE KEY uq_one_accepted_offer (accepted_application_id),
    INDEX idx_offer_application (application_id),
    INDEX idx_offer_lender (lender_id),
    CONSTRAINT fk_offer_application FOREIGN KEY (application_id) REFERENCES loan_applications (id),
    CONSTRAINT fk_offer_lender FOREIGN KEY (lender_id) REFERENCES users (id)
);

-- What's known about each document slot. The file itself is in document_files.
CREATE TABLE IF NOT EXISTS documents (
    id                  VARCHAR(30)  NOT NULL PRIMARY KEY,
    application_id      VARCHAR(20)  NOT NULL,
    type                VARCHAR(20)  NOT NULL,
    label               VARCHAR(60)  NOT NULL,
    filename            VARCHAR(255) NULL,
    uploaded_at         DATETIME(6)  NULL,
    verification_status VARCHAR(20)  NOT NULL,
    check_note          VARCHAR(200) NULL,
    position            INT          NOT NULL,
    CONSTRAINT fk_document_application FOREIGN KEY (application_id) REFERENCES loan_applications (id)
);

CREATE TABLE IF NOT EXISTS disbursement_steps (
    id             BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(20) NOT NULL,
    position       INT         NOT NULL,
    label          VARCHAR(60) NOT NULL,
    status         VARCHAR(10) NOT NULL,
    completed_on   DATE        NULL,
    UNIQUE KEY uq_step (application_id, position),
    CONSTRAINT fk_step_application FOREIGN KEY (application_id) REFERENCES loan_applications (id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    VARCHAR(20)  NOT NULL,
    title      VARCHAR(100) NOT NULL,
    message    VARCHAR(700) NOT NULL,
    type       VARCHAR(10)  NOT NULL,
    is_read    BOOLEAN      NOT NULL,
    created_at DATETIME(6)  NOT NULL,
    INDEX idx_notification_user (user_id, created_at),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Uploaded files that passed their checks, encrypted. Kept apart from documents so reading a list never loads a file.
CREATE TABLE IF NOT EXISTS document_files (
    document_id  VARCHAR(30) NOT NULL PRIMARY KEY,
    content_type VARCHAR(40) NOT NULL,
    content      LONGBLOB    NOT NULL,
    CONSTRAINT fk_file_document FOREIGN KEY (document_id) REFERENCES documents (id)
);
