CREATE TABLE IF NOT EXISTS {{INVENTORY_SALES_TABLE}} (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  inventory_item_id STRING NOT NULL,
  quantity_sold BIGINT NOT NULL,
  sold_at TIMESTAMP NOT NULL,
  unit_selling_price DECIMAL(18, 2) NOT NULL,
  total_revenue DECIMAL(18, 2) NOT NULL,
  total_cost DECIMAL(18, 2) NOT NULL,
  profit DECIMAL(18, 2) NOT NULL,
  notes STRING,
  created_at TIMESTAMP NOT NULL
) USING DELTA
