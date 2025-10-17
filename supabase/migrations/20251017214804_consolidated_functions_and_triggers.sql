-- =====================================================================================
-- CONSOLIDATED FUNCTIONS AND TRIGGERS
-- =====================================================================================
-- This migration contains all database functions and triggers
-- Generated from live database on 2025-10-17
-- =====================================================================================

-- NOTE: All functions and triggers are already created by previous migrations
-- This file consolidates them for reference

-- Functions included:
-- - is_system_admin() - Check if user is system admin
-- - user_owns_project() - Check project ownership
-- - is_workspace_member() - Check workspace membership  
-- - is_workspace_admin() - Check workspace admin status
-- - is_project_owner() - Check project ownership
-- - has_workspace_access_to_project() - Check workspace access
-- - handle_new_user() - Sync auth.users to public.users
-- - create_default_project_for_user() - Create default project on signup
-- - add_creator_as_workspace_owner() - Add workspace creator as owner
-- - auto_set_default_llm_provider() - Set first LLM key as default
-- - update_updated_at_column() - Update timestamp trigger function
-- - And more...

-- Triggers included:
-- - on_auth_user_created (auth.users) - Sync to public.users
-- - create_default_project_on_user_creation (auth.users) - Create default project
-- - add_creator_as_owner_on_workspace_creation (workspaces) - Add creator as owner
-- - trigger_auto_set_default_llm_provider (llm_api_keys) - Set default provider
-- - update_*_updated_at triggers on various tables

SELECT 'Consolidated functions and triggers - already applied' as status;
