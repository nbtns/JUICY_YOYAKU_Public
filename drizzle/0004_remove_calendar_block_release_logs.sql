DELETE FROM audit_logs
WHERE action = 'calendar_block_deleted'
  AND entity_type = 'calendar_block';
