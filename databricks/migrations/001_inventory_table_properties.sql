ALTER TABLE {{INVENTORY_ITEMS_TABLE}}
SET TBLPROPERTIES (
  'delta.autoOptimize.optimizeWrite' = 'true',
  'delta.autoOptimize.autoCompact' = 'true'
)
