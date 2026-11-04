package com.creditscore.backend.application;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<LoanApplication, String> {

    List<LoanApplication> findByBeneficiaryIdOrderBySubmittedAtDesc(String beneficiaryId);

    @Query("select distinct a from LoanApplication a join a.lenderDecisions d where d.lenderId = :lenderId order by a.submittedAt desc")
    List<LoanApplication> findSharedWith(@Param("lenderId") String lenderId);

    /** Every change locks the application first, so two people can't both accept or act at once. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LoanApplication a where a.id = :id")
    Optional<LoanApplication> findForUpdate(@Param("id") String id);

    @Query("select distinct o.application.id from LoanOffer o where o.status = :pending and o.expiresAt <= :now")
    List<String> findIdsWithExpiredOffers(@Param("pending") Enums.OfferStatus pending, @Param("now") Instant now);

    @Query("select count(o) > 0 from LoanOffer o where o.id = :offerId")
    boolean offerIdExists(@Param("offerId") String offerId);
}
