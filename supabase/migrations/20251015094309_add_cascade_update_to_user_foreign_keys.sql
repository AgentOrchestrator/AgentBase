-- Add CASCADE ON UPDATE to all foreign keys referencing auth.users(id)
-- This is important for account linking scenarios where users might link accounts
-- with different emails using Supabase auth admin API

-- When a user's ID changes (during account linking), all related records should update automatically
-- DELETE CASCADE is already in place, this migration adds UPDATE CASCADE

-- 1. Update chat_histories.account_id foreign key
ALTER TABLE public.chat_histories
  DROP CONSTRAINT IF EXISTS chat_histories_account_id_fkey,
  ADD CONSTRAINT chat_histories_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 2. Update daemon_auth_sessions.user_id foreign key
ALTER TABLE public.daemon_auth_sessions
  DROP CONSTRAINT IF EXISTS daemon_auth_sessions_user_id_fkey,
  ADD CONSTRAINT daemon_auth_sessions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 3. Update projects.user_id foreign key
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey,
  ADD CONSTRAINT projects_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 4. Update project_shares.shared_by_user_id foreign key
ALTER TABLE public.project_shares
  DROP CONSTRAINT IF EXISTS project_shares_shared_by_user_id_fkey,
  ADD CONSTRAINT project_shares_shared_by_user_id_fkey
    FOREIGN KEY (shared_by_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 5. Update project_shares.shared_with_user_id foreign key
ALTER TABLE public.project_shares
  DROP CONSTRAINT IF EXISTS project_shares_shared_with_user_id_fkey,
  ADD CONSTRAINT project_shares_shared_with_user_id_fkey
    FOREIGN KEY (shared_with_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 6. Update project_organization_shares.shared_by_user_id foreign key
ALTER TABLE public.project_organization_shares
  DROP CONSTRAINT IF EXISTS project_organization_shares_shared_by_user_id_fkey,
  ADD CONSTRAINT project_organization_shares_shared_by_user_id_fkey
    FOREIGN KEY (shared_by_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 7. Update active_sessions.user_id foreign key
ALTER TABLE public.active_sessions
  DROP CONSTRAINT IF EXISTS active_sessions_user_id_fkey,
  ADD CONSTRAINT active_sessions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Rollback instructions:
-- To rollback, recreate the constraints with ON UPDATE NO ACTION:
--
-- ALTER TABLE public.chat_histories
--   DROP CONSTRAINT IF EXISTS chat_histories_account_id_fkey,
--   ADD CONSTRAINT chat_histories_account_id_fkey
--     FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.daemon_auth_sessions
--   DROP CONSTRAINT IF EXISTS daemon_auth_sessions_user_id_fkey,
--   ADD CONSTRAINT daemon_auth_sessions_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.projects
--   DROP CONSTRAINT IF EXISTS projects_user_id_fkey,
--   ADD CONSTRAINT projects_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.project_shares
--   DROP CONSTRAINT IF EXISTS project_shares_shared_by_user_id_fkey,
--   ADD CONSTRAINT project_shares_shared_by_user_id_fkey
--     FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.project_shares
--   DROP CONSTRAINT IF EXISTS project_shares_shared_with_user_id_fkey,
--   ADD CONSTRAINT project_shares_shared_with_user_id_fkey
--     FOREIGN KEY (shared_with_user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.project_organization_shares
--   DROP CONSTRAINT IF EXISTS project_organization_shares_shared_by_user_id_fkey,
--   ADD CONSTRAINT project_organization_shares_shared_by_user_id_fkey
--     FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.active_sessions
--   DROP CONSTRAINT IF EXISTS active_sessions_user_id_fkey,
--   ADD CONSTRAINT active_sessions_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
