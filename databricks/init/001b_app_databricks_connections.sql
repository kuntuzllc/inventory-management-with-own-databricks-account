CREATE TABLE IF NOT EXISTS {{APP_DATABRICKS_CONNECTIONS_TABLE}} (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  connection_key STRING NOT NULL,
  workspace_name STRING,
  host_encrypted STRING NOT NULL,
  http_path_encrypted STRING NOT NULL,
  token_encrypted STRING NOT NULL,
  catalog STRING NOT NULL,
  schema STRING NOT NULL,
  table_prefix STRING,
  connection_status STRING NOT NULL,
  last_tested_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
) USING DELTA
