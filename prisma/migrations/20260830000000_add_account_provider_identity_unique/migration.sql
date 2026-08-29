-- Account identity must be unique per provider. The explicit duplicate check
-- keeps the migration from silently selecting or deleting an existing row.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Account"
    GROUP BY "providerId", "accountId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add Account provider/account uniqueness: duplicate providerId/accountId rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "Account_providerId_accountId_key"
ON "Account"("providerId", "accountId");
