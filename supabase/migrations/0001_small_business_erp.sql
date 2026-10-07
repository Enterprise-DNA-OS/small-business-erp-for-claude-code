-- Small Business ERP for Claude Code: business partners, quotes, sales and purchase orders with
-- approvals, warehouses, bills of materials, production orders, batches with expiry, and the
-- one-step-back, one-step-forward trace a recall needs. Runs on Postgres and PGlite.
-- Order amounts exclude GST. Invoice totals are ledger snapshots including GST.
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;

CREATE TABLE settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL UNIQUE, country text NOT NULL CHECK(country IN ('NZ','AU')), currency text NOT NULL CHECK(currency IN ('NZD','AUD')),
 tax_number text NOT NULL DEFAULT '', retention_years integer NOT NULL CHECK(retention_years>=0),
 min_margin_pct numeric(5,2) NOT NULL DEFAULT 25 CHECK(min_margin_pct>=0 AND min_margin_pct<100),
 food_business boolean NOT NULL DEFAULT false, recall_plan_ref text NOT NULL DEFAULT '', last_mock_recall date,
 last_backup date, backup_ref text);
CREATE TABLE warehouses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, name text NOT NULL);
-- One table for customers and suppliers, as SAP Business One keeps business partners.
CREATE TABLE partners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('customer','supplier')), name text NOT NULL,
 email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', tax_id text NOT NULL DEFAULT '',
 credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK(credit_limit>=0), terms_days integer NOT NULL DEFAULT 20 CHECK(terms_days>=0),
 lead_days integer NOT NULL DEFAULT 7 CHECK(lead_days>=0), ppsr_ref text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 source_data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, name text NOT NULL, uom text NOT NULL DEFAULT 'EA', kind text NOT NULL DEFAULT 'purchased' CHECK(kind IN ('purchased','made')),
 batch_managed boolean NOT NULL DEFAULT false, shelf_life_days integer CHECK(shelf_life_days IS NULL OR shelf_life_days>0),
 unit_cost numeric(14,4) NOT NULL DEFAULT 0 CHECK(unit_cost>=0), unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK(unit_price>=0),
 reorder_point numeric(14,3) NOT NULL DEFAULT 0 CHECK(reorder_point>=0), order_multiple numeric(14,3) NOT NULL DEFAULT 1 CHECK(order_multiple>0),
 supplier_id uuid REFERENCES partners, make_days integer NOT NULL DEFAULT 2 CHECK(make_days>=0), last_counted_on date, source_data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE bom_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 parent_id uuid NOT NULL REFERENCES items, component_id uuid NOT NULL REFERENCES items, quantity numeric(14,4) NOT NULL CHECK(quantity>0),
 UNIQUE(parent_id,component_id), CHECK(parent_id<>component_id));
-- Quotes, sales orders and purchase orders. A sales order below the margin floor or past the
-- customer's credit limit waits for approval before it is released.
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('quote','sales','purchase')), partner_id uuid NOT NULL REFERENCES partners,
 warehouse_id uuid NOT NULL REFERENCES warehouses, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','completed','cancelled','won','lost')),
 approval text NOT NULL DEFAULT 'not_needed' CHECK(approval IN ('not_needed','pending','approved','rejected')), approval_note text NOT NULL DEFAULT '',
 due_on date NOT NULL, valid_until date, reference text NOT NULL DEFAULT '', from_quote_id uuid REFERENCES orders, source_data jsonb NOT NULL DEFAULT '{}',
 CHECK((kind='quote' AND status IN ('draft','open','won','lost')) OR (kind<>'quote' AND status IN ('draft','open','completed','cancelled'))));
CREATE TABLE order_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 order_id uuid NOT NULL REFERENCES orders, line_no integer NOT NULL CHECK(line_no>0), item_id uuid NOT NULL REFERENCES items,
 quantity numeric(14,3) NOT NULL CHECK(quantity>0), completed numeric(14,3) NOT NULL DEFAULT 0 CHECK(completed>=0 AND completed<=quantity),
 unit_price numeric(14,4) NOT NULL CHECK(unit_price>=0), unit_cost numeric(14,4) NOT NULL CHECK(unit_cost>=0), UNIQUE(order_id,line_no));
CREATE TABLE production_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, item_id uuid NOT NULL REFERENCES items, warehouse_id uuid NOT NULL REFERENCES warehouses,
 planned_qty numeric(14,3) NOT NULL CHECK(planned_qty>0), completed_qty numeric(14,3) NOT NULL DEFAULT 0 CHECK(completed_qty>=0 AND completed_qty<=planned_qty),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','released','closed','cancelled')), due_on date NOT NULL,
 for_order_id uuid REFERENCES orders, source_data jsonb NOT NULL DEFAULT '{}');
-- A batch is one lot of one item: a supplier lot received, or a run made here.
CREATE TABLE batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 item_id uuid NOT NULL REFERENCES items, code text NOT NULL, made_on date NOT NULL, expires_on date, supplier_id uuid REFERENCES partners,
 supplier_lot text NOT NULL DEFAULT '', production_order_id uuid REFERENCES production_orders, on_hold boolean NOT NULL DEFAULT false, hold_reason text NOT NULL DEFAULT '',
 UNIQUE(item_id,code), CHECK(expires_on IS NULL OR expires_on>=made_on));
CREATE TABLE stock_moves (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 item_id uuid NOT NULL REFERENCES items, warehouse_id uuid NOT NULL REFERENCES warehouses, batch_id uuid REFERENCES batches,
 line_id uuid REFERENCES order_lines, production_order_id uuid REFERENCES production_orders,
 kind text NOT NULL CHECK(kind IN ('opening','receipt','delivery','issue','output','transfer','adjust','count')),
 quantity numeric(14,3) NOT NULL CHECK(quantity<>0), reason text NOT NULL CHECK(length(trim(reason))>0), event_key text NOT NULL UNIQUE);
CREATE TABLE invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('receivable','payable')), partner_id uuid NOT NULL REFERENCES partners,
 order_id uuid REFERENCES orders, issued_on date NOT NULL, due_on date NOT NULL, total numeric(14,2) NOT NULL CHECK(total>0),
 paid numeric(14,2) NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=total), ledger_ref text NOT NULL CHECK(length(trim(ledger_ref))>0));
CREATE TABLE records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL, reference text NOT NULL, prepared_on date NOT NULL, completed_on date NOT NULL, period_end date NOT NULL, retain_until date NOT NULL,
 source_ref text NOT NULL DEFAULT '');
CREATE TABLE activity (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 record text NOT NULL, note text NOT NULL CHECK(length(trim(note))>0));
CREATE TABLE audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 action text NOT NULL, record_id text, detail jsonb NOT NULL DEFAULT '{}');
CREATE TABLE import_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL UNIQUE, entity text NOT NULL, digest text NOT NULL, row_count integer NOT NULL, source_file text NOT NULL);

CREATE TRIGGER touch BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON bom_lines FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON order_lines FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON stock_moves FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON activity FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON audit FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON import_batches FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX order_lines_item ON order_lines(item_id);
CREATE INDEX stock_moves_item_wh ON stock_moves(item_id,warehouse_id);
CREATE INDEX stock_moves_batch ON stock_moves(batch_id);
CREATE INDEX orders_due ON orders(kind,status,due_on);
CREATE INDEX production_due ON production_orders(status,due_on);

-- What each released production order still needs of each component.
CREATE VIEW v_component_needs AS
 SELECT p.id AS production_order_id,p.code AS production_order,p.warehouse_id,p.status,p.due_on,b.component_id AS item_id,
 ((p.planned_qty-p.completed_qty)*b.quantity)::numeric(14,3) AS remaining
 FROM production_orders p JOIN bom_lines b ON b.parent_id=p.item_id WHERE p.status IN ('planned','released');

-- Stock per item and warehouse. Committed: open sales plus released production still to consume.
-- Incoming: open purchases plus released production still to finish.
CREATE VIEW v_stock AS
 SELECT i.id AS item_id,w.id AS warehouse_id,i.code,i.name,w.code AS warehouse,i.uom,i.kind,i.reorder_point,
 COALESCE((SELECT sum(quantity) FROM stock_moves m WHERE m.item_id=i.id AND m.warehouse_id=w.id),0)::numeric(14,3) AS on_hand,
 COALESCE((SELECT sum(quantity) FROM stock_moves m JOIN batches b ON b.id=m.batch_id WHERE m.item_id=i.id AND m.warehouse_id=w.id AND (b.on_hold OR b.expires_on<current_date)),0)::numeric(14,3) AS blocked,
 (COALESCE((SELECT sum(ol.quantity-ol.completed) FROM order_lines ol JOIN orders o ON o.id=ol.order_id WHERE ol.item_id=i.id AND o.warehouse_id=w.id AND o.kind='sales' AND o.status='open'),0)
 +COALESCE((SELECT sum(remaining) FROM v_component_needs n WHERE n.item_id=i.id AND n.warehouse_id=w.id AND n.status='released'),0))::numeric(14,3) AS committed,
 (COALESCE((SELECT sum(ol.quantity-ol.completed) FROM order_lines ol JOIN orders o ON o.id=ol.order_id WHERE ol.item_id=i.id AND o.warehouse_id=w.id AND o.kind='purchase' AND o.status='open'),0)
 +COALESCE((SELECT sum(planned_qty-completed_qty) FROM production_orders p WHERE p.item_id=i.id AND p.warehouse_id=w.id AND p.status='released'),0))::numeric(14,3) AS incoming
 FROM items i CROSS JOIN warehouses w;

-- Stock per batch and warehouse, with days to expiry.
CREATE VIEW v_batches AS
 SELECT b.id AS batch_id,b.code AS batch,i.id AS item_id,i.code AS item,i.name,w.id AS warehouse_id,w.code AS warehouse,b.made_on,b.expires_on,
 (b.expires_on-current_date) AS days_left,b.on_hold,b.hold_reason,s.code AS supplier,b.supplier_lot,p.code AS production_order,
 sum(m.quantity)::numeric(14,3) AS on_hand
 FROM batches b JOIN items i ON i.id=b.item_id JOIN stock_moves m ON m.batch_id=b.id JOIN warehouses w ON w.id=m.warehouse_id
 LEFT JOIN partners s ON s.id=b.supplier_id LEFT JOIN production_orders p ON p.id=b.production_order_id
 GROUP BY b.id,i.id,w.id,s.code,p.code;

CREATE VIEW v_orders AS
 SELECT o.*,pt.code AS partner_code,pt.name AS partner,w.code AS warehouse,
 COALESCE((SELECT sum(ol.quantity*ol.unit_price) FROM order_lines ol WHERE ol.order_id=o.id),0)::numeric(14,2) AS total,
 COALESCE((SELECT sum(ol.quantity*ol.unit_cost) FROM order_lines ol WHERE ol.order_id=o.id),0)::numeric(14,2) AS total_cost,
 COALESCE((SELECT sum((ol.quantity-ol.completed)*ol.unit_price) FROM order_lines ol WHERE ol.order_id=o.id),0)::numeric(14,2) AS remaining_value,
 COALESCE((SELECT sum(ol.completed*ol.unit_price) FROM order_lines ol WHERE ol.order_id=o.id),0)::numeric(14,2) AS completed_value,
 COALESCE((SELECT sum(ol.completed*(ol.unit_price-ol.unit_cost)) FROM order_lines ol WHERE ol.order_id=o.id),0)::numeric(14,2) AS completed_margin,
 (SELECT CASE WHEN sum(ol.quantity*ol.unit_price)>0 THEN round(sum(ol.quantity*(ol.unit_price-ol.unit_cost))*100/sum(ol.quantity*ol.unit_price),1) END FROM order_lines ol WHERE ol.order_id=o.id)::numeric(6,1) AS margin_pct,
 GREATEST(o.updated_at,COALESCE((SELECT max(created_at) FROM activity a WHERE a.record=o.code),o.updated_at)) AS last_activity
 FROM orders o JOIN partners pt ON pt.id=o.partner_id JOIN warehouses w ON w.id=o.warehouse_id;

-- Customer exposure: ledger balance plus open and waiting orders, against the credit limit.
CREATE VIEW v_exposure AS
 SELECT c.id,c.code,c.name,c.credit_limit,
 COALESCE((SELECT sum(total-paid) FROM invoices i WHERE i.partner_id=c.id),0)::numeric(14,2) AS outstanding,
 COALESCE((SELECT sum(remaining_value) FROM v_orders o WHERE o.partner_id=c.id AND o.kind='sales' AND o.status IN ('open','draft')),0)::numeric(14,2) AS open_orders,
 COALESCE((SELECT max(current_date-due_on) FROM invoices i WHERE i.partner_id=c.id AND paid<total AND due_on<current_date),0) AS oldest_overdue_days
 FROM partners c WHERE c.kind='customer';
