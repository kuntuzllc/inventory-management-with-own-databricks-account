# Databricks Schema Design

InventorySelf stores operational inventory data in the logged-in user's own Databricks workspace,
catalog, and schema.

## Design principles

- Every operational table includes `user_id`
- Every application query filters by authenticated `user_id`
- The app derives the catalog and schema from the user's workspace nickname
- The server creates the derived catalog and schema automatically during initialization
- Optional `table_prefix` values are prepended per user
- Delta tables are used for inventory, sales, imports, and activity logs

## Derived namespace model

Each Databricks connection stores a friendly workspace nickname. The backend converts that nickname
into safe Databricks identifiers and generates:

- a derived catalog name
- a derived schema name
- a stable connection key used to recognize the same Databricks setup after signout

This keeps the onboarding UI simple while still guaranteeing deterministic catalog and schema names
for each workspace.

## Core tables

### inventory_items

- `id`
- `user_id`
- `item_name`
- `sku`
- `category`
- `brand`
- `supplier`
- `purchase_date`
- `purchase_price`
- `unit_cost`
- `unit_selling_price`
- `quantity_in_stock`
- `total_inventory_value`
- `status`
- `item_condition`
- `notes`
- `serial_or_batch_number`
- `image_url`
- `created_at`
- `updated_at`
- `last_sold_at`

### inventory_sales

- `id`
- `user_id`
- `inventory_item_id`
- `quantity_sold`
- `sold_at`
- `unit_selling_price`
- `total_revenue`
- `total_cost`
- `profit`
- `notes`
- `created_at`

### inventory_imports

- `id`
- `user_id`
- `file_name`
- `file_type`
- `total_rows`
- `success_count`
- `failure_count`
- `mapping_json`
- `summary_json`
- `created_at`

### inventory_activity_log

- `id`
- `user_id`
- `inventory_item_id`
- `activity_type`
- `description`
- `metadata_json`
- `created_at`

## Isolation model

Even if multiple app users point at the same Databricks workspace, InventorySelf still enforces
user-level isolation by:

1. requiring authentication on every protected endpoint
2. including `user_id` in every table
3. filtering every repository query by authenticated `user_id`

This protects against cross-user access across shared infrastructure.
