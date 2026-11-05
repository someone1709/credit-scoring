package com.creditscore.backend.application;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** An uploaded file that passed its checks. Content is always encrypted, see DocumentCipher. */
@Entity
@Table(name = "document_files")
@Getter
@Setter
public class DocumentFile {

    @Id
    @Column(name = "document_id")
    private String documentId;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] content;
}
