-- Rimu Foods Demo: a fictional Hamilton maker of sauces that sells to grocery wholesalers,
-- foodservice and cafes, with a factory warehouse and stock at an Auckland third-party store.
-- Dates are relative to the first seed. Idempotent: running it again keeps existing records.
-- Never seed a real database.
INSERT INTO settings(name,country,currency,tax_number,retention_years,min_margin_pct,food_business,recall_plan_ref,last_mock_recall,last_backup,backup_ref)
 VALUES('Rimu Foods Demo','NZ','NZD','',5,25,true,'',current_date-400,current_date-15,'backup-demo-old') ON CONFLICT DO NOTHING;
INSERT INTO warehouses(code,name) VALUES('HAM','Hamilton factory'),('AKL','Auckland third-party store') ON CONFLICT DO NOTHING;
INSERT INTO partners(code,kind,name,email,phone,address,tax_id,credit_limit,terms_days,lead_days,ppsr_ref) VALUES
('C100','customer','Waikato Wholesale Grocers','accounts@waikatowholesale.example','07 555 0100','40 Example Road, Te Rapa, Hamilton','111-222-333',40000,20,0,'Financing statement FS-DEMO-0001'),
('C200','customer','Raglan Cafe Collective','','','','',3000,20,0,''),
('C300','customer','Northern Foodservice','orders@northernfs.example','09 555 0300','8 Example Lane, Penrose, Auckland','444-555-666',15000,20,0,'Financing statement FS-DEMO-0003'),
('C400','customer','Te Awamutu Butchery','shop@tabutchery.example','07 555 0400','','',0,0,0,''),
('S100','supplier','Pacific Tomato Products','sales@pacifictomato.example','','','',0,30,21,''),
('S200','supplier','Glassworks Packaging','orders@glassworks.example','','','',0,30,28,''),
('S300','supplier','Kiwi Pack Labels','print@kiwipack.example','','','',0,20,10,''),
('S400','supplier','Sweet Cane Sugar','trade@sweetcane.example','','','',0,20,7,'') ON CONFLICT DO NOTHING;
INSERT INTO items(code,name,uom,kind,batch_managed,shelf_life_days,unit_cost,unit_price,reorder_point,order_multiple,supplier_id,make_days,last_counted_on) VALUES
('TOM-PASTE','Tomato paste, 28 brix','KG','purchased',true,365,4.20,0,200,25,(SELECT id FROM partners WHERE code='S100'),0,current_date-20),
('VINEGAR','Malt vinegar','L','purchased',true,730,1.10,0,100,20,(SELECT id FROM partners WHERE code='S100'),0,current_date-20),
('SUGAR','Raw sugar','KG','purchased',true,540,1.60,0,100,25,(SELECT id FROM partners WHERE code='S400'),0,current_date-130),
('BOT-300','Glass bottle 300ml','EA','purchased',false,NULL,0.55,0,2000,1000,(SELECT id FROM partners WHERE code='S200'),0,current_date-45),
('CAP-38','Cap 38mm','EA','purchased',false,NULL,0.06,0,2000,5000,(SELECT id FROM partners WHERE code='S200'),0,current_date-45),
('LBL-TS','Label, tomato sauce','EA','purchased',false,NULL,0.08,0,1500,2500,(SELECT id FROM partners WHERE code='S300'),0,NULL),
('LBL-BBQ','Label, smoky barbecue sauce','EA','purchased',false,NULL,0.08,0,1500,2500,(SELECT id FROM partners WHERE code='S300'),0,NULL),
('TS-300','Tomato sauce 300ml','EA','made',true,270,2.10,4.20,600,100,NULL,2,current_date-10),
('BBQ-300','Smoky barbecue sauce 300ml','EA','made',true,270,2.30,4.60,400,100,NULL,2,current_date-10) ON CONFLICT DO NOTHING;
INSERT INTO bom_lines(parent_id,component_id,quantity)
 SELECT p.id,c.id,v.q FROM (VALUES('TS-300','TOM-PASTE',0.12),('TS-300','VINEGAR',0.04),('TS-300','SUGAR',0.03),('TS-300','BOT-300',1),('TS-300','CAP-38',1),('TS-300','LBL-TS',1),
 ('BBQ-300','TOM-PASTE',0.08),('BBQ-300','VINEGAR',0.05),('BBQ-300','SUGAR',0.06),('BBQ-300','BOT-300',1),('BBQ-300','CAP-38',1),('BBQ-300','LBL-BBQ',1)) v(pc,cc,q)
 JOIN items p ON p.code=v.pc JOIN items c ON c.code=v.cc ON CONFLICT DO NOTHING;

-- Orders. SO-1001 is late and short; SO-1003 and SO-1004 wait for approval; QT-3001 has gone quiet.
INSERT INTO orders(code,kind,partner_id,warehouse_id,status,approval,approval_note,due_on,valid_until,reference,created_at,updated_at) VALUES
('SO-0990','sales',(SELECT id FROM partners WHERE code='C100'),(SELECT id FROM warehouses WHERE code='HAM'),'completed','not_needed','',current_date-21,NULL,'WWG-7781',now()-interval '30 days',now()-interval '21 days'),
('SO-0991','sales',(SELECT id FROM partners WHERE code='C200'),(SELECT id FROM warehouses WHERE code='HAM'),'completed','not_needed','',current_date-20,NULL,'',now()-interval '28 days',now()-interval '20 days'),
('SO-1001','sales',(SELECT id FROM partners WHERE code='C100'),(SELECT id FROM warehouses WHERE code='HAM'),'open','not_needed','',current_date-2,NULL,'WWG-7902',now()-interval '16 days',now()-interval '9 days'),
('SO-1002','sales',(SELECT id FROM partners WHERE code='C300'),(SELECT id FROM warehouses WHERE code='AKL'),'open','not_needed','',current_date+4,NULL,'NFS-PO-2231',now()-interval '3 days',now()-interval '3 days'),
('SO-1003','sales',(SELECT id FROM partners WHERE code='C300'),(SELECT id FROM warehouses WHERE code='HAM'),'draft','pending','over credit limit by 1220.00',current_date+12,NULL,'NFS-PO-2240',now()-interval '1 day',now()-interval '1 day'),
('SO-1004','sales',(SELECT id FROM partners WHERE code='C200'),(SELECT id FROM warehouses WHERE code='HAM'),'draft','pending','margin 19.2% below 25%',current_date+6,NULL,'Summer promo',now()-interval '2 days',now()-interval '2 days'),
('QT-3001','quote',(SELECT id FROM partners WHERE code='C400'),(SELECT id FROM warehouses WHERE code='HAM'),'open','not_needed','',current_date+14,current_date+3,'',now()-interval '12 days',now()-interval '12 days'),
('QT-3002','quote',(SELECT id FROM partners WHERE code='C300'),(SELECT id FROM warehouses WHERE code='AKL'),'open','not_needed','',current_date+30,current_date+28,'Winter range',now()-interval '2 days',now()-interval '2 days'),
('PO-1990','purchase',(SELECT id FROM partners WHERE code='S100'),(SELECT id FROM warehouses WHERE code='HAM'),'completed','not_needed','',current_date-30,NULL,'',now()-interval '50 days',now()-interval '30 days'),
('PO-2001','purchase',(SELECT id FROM partners WHERE code='S200'),(SELECT id FROM warehouses WHERE code='HAM'),'open','not_needed','',current_date-5,NULL,'GW-55120',now()-interval '33 days',now()-interval '12 days'),
('PO-2002','purchase',(SELECT id FROM partners WHERE code='S300'),(SELECT id FROM warehouses WHERE code='HAM'),'open','not_needed','',current_date+6,NULL,'',now()-interval '4 days',now()-interval '4 days') ON CONFLICT DO NOTHING;
INSERT INTO order_lines(order_id,line_no,item_id,quantity,completed,unit_price,unit_cost)
 SELECT o.id,v.n,i.id,v.q,v.done,v.price,v.cost FROM (VALUES
 ('SO-0990',1,'TS-300',600,600,4.20,2.10),('SO-0991',1,'TS-300',250,250,4.20,2.10),
 ('SO-1001',1,'TS-300',400,0,4.20,2.10),('SO-1001',2,'BBQ-300',100,0,4.60,2.30),
 ('SO-1002',1,'BBQ-300',300,0,4.60,2.30),('SO-1003',1,'TS-300',1200,0,4.20,2.10),('SO-1004',1,'TS-300',120,0,2.60,2.10),
 ('QT-3001',1,'TS-300',48,0,4.40,2.10),('QT-3001',2,'BBQ-300',48,0,4.80,2.30),('QT-3002',1,'BBQ-300',500,0,4.40,2.30),
 ('PO-1990',1,'TOM-PASTE',250,250,4.20,4.20),('PO-2001',1,'BOT-300',6000,0,0.55,0.55),('PO-2002',1,'LBL-TS',5000,0,0.08,0.08)) v(oc,n,ic,q,done,price,cost)
 JOIN orders o ON o.code=v.oc JOIN items i ON i.code=v.ic ON CONFLICT DO NOTHING;

-- Production. MO-480 made batch TS-0915 from paste lot PT-2405; MO-501 is short of bottles.
INSERT INTO production_orders(code,item_id,warehouse_id,planned_qty,completed_qty,status,due_on,for_order_id) VALUES
('MO-480',(SELECT id FROM items WHERE code='TS-300'),(SELECT id FROM warehouses WHERE code='HAM'),1000,1000,'closed',current_date-22,NULL),
('MO-501',(SELECT id FROM items WHERE code='TS-300'),(SELECT id FROM warehouses WHERE code='HAM'),1000,0,'released',current_date+3,(SELECT id FROM orders WHERE code='SO-1001')),
('MO-502',(SELECT id FROM items WHERE code='BBQ-300'),(SELECT id FROM warehouses WHERE code='HAM'),600,0,'planned',current_date+10,NULL) ON CONFLICT DO NOTHING;

INSERT INTO batches(item_id,code,made_on,expires_on,supplier_id,supplier_lot,production_order_id,on_hold,hold_reason)
 SELECT i.id,v.bc,current_date+v.made,current_date+v.exp,(SELECT id FROM partners WHERE code=v.sc),v.lot,(SELECT id FROM production_orders WHERE code=v.mo),v.hold,v.why FROM (VALUES
 ('TOM-PASTE','PT-2405',-353,12,'S100','PTP-88123',NULL,false,''),('TOM-PASTE','PT-2409',-30,335,'S100','PTP-90417',NULL,false,''),
 ('VINEGAR','VN-0711',-90,640,'S100','PTV-1107',NULL,false,''),('SUGAR','SG-0820',-48,492,'S400','',NULL,false,''),
 ('TS-300','TS-0915',-22,248,NULL,'','MO-480',false,''),('BBQ-300','BB-0630',-99,171,NULL,'',NULL,true,'Cap seal complaint, QA check'),
 ('BBQ-300','BB-0702',-97,173,NULL,'',NULL,false,'')) v(ic,bc,made,exp,sc,lot,mo,hold,why)
 JOIN items i ON i.code=v.ic ON CONFLICT DO NOTHING;

INSERT INTO stock_moves(item_id,warehouse_id,batch_id,line_id,production_order_id,kind,quantity,reason,event_key,created_at,updated_at)
 SELECT i.id,w.id,(SELECT b.id FROM batches b WHERE b.item_id=i.id AND b.code=v.bc),
 (SELECT l.id FROM order_lines l JOIN orders o ON o.id=l.order_id WHERE o.code=v.oc AND l.line_no=1),(SELECT id FROM production_orders WHERE code=v.mo),
 v.kind,v.q,v.why,v.ev,now()-make_interval(days => v.ago),now()-make_interval(days => v.ago) FROM (VALUES
 ('TOM-PASTE','HAM','PT-2405',NULL,NULL,'opening',160,'Opening count','seed-pt2405',60),
 ('TOM-PASTE','HAM','PT-2409','PO-1990',NULL,'receipt',250,'receive PO-1990','seed-po1990',30),
 ('VINEGAR','HAM','VN-0711',NULL,NULL,'opening',640,'Opening count','seed-vn0711',60),
 ('SUGAR','HAM','SG-0820',NULL,NULL,'opening',60,'Opening count','seed-sg0820',48),
 ('BOT-300','HAM',NULL,NULL,NULL,'opening',1900,'Opening count','seed-bot',60),
 ('CAP-38','HAM',NULL,NULL,NULL,'opening',6000,'Opening count','seed-cap',60),
 ('LBL-TS','HAM',NULL,NULL,NULL,'opening',4000,'Opening count','seed-lbl-ts',60),
 ('LBL-BBQ','HAM',NULL,NULL,NULL,'opening',1200,'Opening count','seed-lbl-bbq',60),
 ('TOM-PASTE','HAM','PT-2405',NULL,'MO-480','issue',-120,'issue to MO-480','seed-mo480-tom',22),
 ('VINEGAR','HAM','VN-0711',NULL,'MO-480','issue',-40,'issue to MO-480','seed-mo480-vin',22),
 ('SUGAR','HAM','SG-0820',NULL,'MO-480','issue',-30,'issue to MO-480','seed-mo480-sug',22),
 ('BOT-300','HAM',NULL,NULL,'MO-480','issue',-1000,'issue to MO-480','seed-mo480-bot',22),
 ('CAP-38','HAM',NULL,NULL,'MO-480','issue',-1000,'issue to MO-480','seed-mo480-cap',22),
 ('LBL-TS','HAM',NULL,NULL,'MO-480','issue',-1000,'issue to MO-480','seed-mo480-lbl',22),
 ('TS-300','HAM','TS-0915',NULL,'MO-480','output',1000,'made on MO-480','seed-mo480-out',22),
 ('TS-300','HAM','TS-0915','SO-0990',NULL,'delivery',-600,'ship SO-0990','seed-so0990',21),
 ('TS-300','HAM','TS-0915','SO-0991',NULL,'delivery',-250,'ship SO-0991','seed-so0991',20),
 ('BBQ-300','HAM','BB-0630',NULL,NULL,'opening',60,'Opening count','seed-bb0630',60),
 ('BBQ-300','AKL','BB-0702',NULL,NULL,'opening',380,'Opening count','seed-bb0702',60)) v(ic,wc,bc,oc,mo,kind,q,why,ev,ago)
 JOIN items i ON i.code=v.ic JOIN warehouses w ON w.code=v.wc ON CONFLICT DO NOTHING;

INSERT INTO invoices(code,kind,partner_id,order_id,issued_on,due_on,total,paid,ledger_ref) VALUES
('INV-2001','receivable',(SELECT id FROM partners WHERE code='C100'),(SELECT id FROM orders WHERE code='SO-0990'),current_date-21,current_date-1,2898.00,0,'Ledger INV-2001'),
('INV-2002','receivable',(SELECT id FROM partners WHERE code='C200'),(SELECT id FROM orders WHERE code='SO-0991'),current_date-20,current_date-6,1207.50,0,'Ledger INV-2002'),
('INV-2003','receivable',(SELECT id FROM partners WHERE code='C300'),NULL,current_date-15,current_date+5,9800.00,0,'Ledger INV-2003'),
('BILL-3001','payable',(SELECT id FROM partners WHERE code='S100'),(SELECT id FROM orders WHERE code='PO-1990'),current_date-28,current_date+2,1207.50,0,'Ledger BILL-3001') ON CONFLICT DO NOTHING;
INSERT INTO records(id,name,reference,prepared_on,completed_on,period_end,retain_until,source_ref) VALUES
('b0000000-0000-0000-0000-000000000001','Batch TS-0915 production record','MO-480',current_date-22,current_date-22,current_date-22,current_date+365,'') ON CONFLICT DO NOTHING;
INSERT INTO activity(record,note,created_at,updated_at) SELECT 'SO-1001','Customer asked for the sauce by Friday; told them Monday at the latest',now()-interval '9 days',now()-interval '9 days'
 WHERE NOT EXISTS(SELECT 1 FROM activity WHERE record='SO-1001');
