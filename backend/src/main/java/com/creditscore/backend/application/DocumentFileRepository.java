package com.creditscore.backend.application;

import java.util.Collection;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentFileRepository extends JpaRepository<DocumentFile, String> {

    /** Only the ids, so showing a list never reads a file's contents. */
    @Query("select f.documentId from DocumentFile f where f.documentId in :ids")
    Set<String> findStoredIds(@Param("ids") Collection<String> ids);
}
