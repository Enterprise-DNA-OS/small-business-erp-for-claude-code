// Entities, read reports, name matching, batch picking, the recall trace and the record checks.
// Every report is plain SQL over the views in supabase/migrations, so a new question is one query.
export const entities={
 warehouse:{table:'warehouses',fields:['code','name']},
 customer:{table:'partners',kind:'customer',fields:['code','name','email','phone','address','tax_id','credit_limit','terms_days','ppsr_ref']},
 supplier:{table:'partners',kind:'supplier',fields:['code','name','email','phone','address','tax_id','terms_days','lead_days']},
 item:{table:'items',fields:['code','name','uom','kind','batch_managed','shelf_life_days','unit_cost','unit_price','reorder_point','order_multiple','supplier_id','make_days'],refs:{supplier_id:'supplier'}},
 order:{table:'orders',fields:['code','kind','partner_id','warehouse_id','due_on','valid_until','reference'],refs:{warehouse_id:'warehouse'}},
 production:{table:'production_orders',fields:['code']},
 invoice:{table:'invoices',fields:['code','kind','partner_id','order_id','issued_on','due_on','total','paid','ledger_ref'],refs:{order_id:'order'}},
 record:{table:'records',fields:['name','reference','prepared_on','completed_on','period_end','retain_until','source_ref']}
};
export const numeric=['credit_limit','terms_days','lead_days','unit_cost','unit_price','reorder_point','order_multiple','make_days','shelf_life_days','total','paid','min_margin_pct'];
export const integers=['terms_days','lead_days','make_days','shelf_life_days'];
const quiet="interval '7 days'";
const avail='(s.on_hand-s.blocked)';
export const reports={
 settings:'select name,country,currency,tax_number,retention_years,min_margin_pct,food_business,recall_plan_ref,last_mock_recall,last_backup,backup_ref from settings',
 warehouses:'select w.code,w.name,(select count(distinct item_id) from stock_moves m where m.warehouse_id=w.id)::int as items_held from warehouses w order by code',
 customers:"select id,code,name,email,phone,address,tax_id,credit_limit,terms_days,ppsr_ref from partners where kind='customer' and active order by code",
 suppliers:"select id,code,name,email,phone,lead_days,terms_days from partners where kind='supplier' and active order by code",
 items:'select i.id,i.code,i.name,i.uom,i.kind,i.batch_managed,i.shelf_life_days,i.unit_cost,i.unit_price,i.reorder_point,i.order_multiple,s.name as supplier,i.last_counted_on from items i left join partners s on s.id=i.supplier_id order by i.code',
 bom:'select p.code as product,p.name,c.code as component,c.name as component_name,b.quantity,c.uom,(b.quantity*c.unit_cost)::numeric(14,4) as cost_per_unit from bom_lines b join items p on p.id=b.parent_id join items c on c.id=b.component_id order by p.code,c.code',
 quotes:"select code,partner,status,due_on,valid_until,total,margin_pct,last_activity::date as last_activity from v_orders where kind='quote' order by status,valid_until,code",
 'sales-orders':"select code,partner,warehouse,status,approval,due_on,reference,total,remaining_value,margin_pct from v_orders where kind='sales' order by due_on,code",
 'purchase-orders':"select code,partner as supplier,warehouse,status,due_on,reference,total,remaining_value from v_orders where kind='purchase' order by due_on,code",
 'production-orders':"select p.code,i.code as item,i.name,w.code as warehouse,p.status,p.due_on,p.planned_qty,p.completed_qty,(p.planned_qty-p.completed_qty)::numeric(14,3) as remaining,o.code as for_order from production_orders p join items i on i.id=p.item_id join warehouses w on w.id=p.warehouse_id left join orders o on o.id=p.for_order_id order by case p.status when 'released' then 1 when 'planned' then 2 else 3 end,p.due_on,p.code",
 stock:'select code,name,warehouse,uom,on_hand,blocked,committed,(on_hand-blocked-committed)::numeric(14,3) as available,incoming from v_stock where on_hand<>0 or committed<>0 or incoming<>0 order by code,warehouse',
 batches:'select batch,item,warehouse,made_on,expires_on,days_left,on_hand,on_hold,supplier,supplier_lot,production_order from v_batches where on_hand<>0 order by item,expires_on nulls last,batch',
 expiring:"select batch,item,warehouse,expires_on,days_left,on_hand,case when days_left<0 then 'expired: hold and dispose' else 'sell or use first' end as action from v_batches where on_hand>0 and expires_on<=current_date+30 order by expires_on,batch",
 mrp:`with s as (select item_id,sum(on_hand-blocked) as available from v_stock group by item_id),
 po as (select ol.item_id,sum(ol.quantity-ol.completed) as q from order_lines ol join orders o on o.id=ol.order_id where o.kind='purchase' and o.status='open' group by ol.item_id),
 mo as (select item_id,sum(planned_qty-completed_qty) as q from production_orders where status in ('planned','released') group by item_id),
 so as (select ol.item_id,sum(ol.quantity-ol.completed) as q,min(o.due_on) as d from order_lines ol join orders o on o.id=ol.order_id where o.kind='sales' and o.status='open' group by ol.item_id),
 cn as (select item_id,sum(remaining) as q,min(due_on) as d from v_component_needs group by item_id),
 p as (select i.*,s.available,coalesce(po.q,0)+coalesce(mo.q,0) as incoming,coalesce(so.q,0)+coalesce(cn.q,0) as demand,coalesce(least(so.d,cn.d),so.d,cn.d,current_date) as need_by,
  case when i.kind='made' then i.make_days else coalesce(sp.lead_days,0) end as lead,sp.name as supplier
  from items i join s on s.item_id=i.id left join po on po.item_id=i.id left join mo on mo.item_id=i.id left join so on so.item_id=i.id left join cn on cn.item_id=i.id left join partners sp on sp.id=i.supplier_id)
 select code,name,case when kind='made' then 'make' else 'buy' end as action,available::numeric(14,3),incoming::numeric(14,3),demand::numeric(14,3),(available+incoming-demand)::numeric(14,3) as projected,reorder_point,
 (ceil((reorder_point-(available+incoming-demand))/order_multiple)*order_multiple)::numeric(14,3) as suggested,coalesce(supplier,'(made here)') as source,need_by,(need_by-lead) as order_by,
 case when need_by-lead<current_date then 'late' when need_by-lead=current_date then 'today' else 'on time' end as timing
 from p where available+incoming-demand<reorder_point order by need_by-lead,code`,
 'can-make':`select n.production_order,n.status,n.due_on,i.code as component,i.uom,n.remaining as needed,coalesce(${avail},0)::numeric(14,3) as available,greatest(n.remaining-coalesce(${avail},0),0)::numeric(14,3) as short from v_component_needs n join items i on i.id=n.item_id left join v_stock s on s.item_id=n.item_id and s.warehouse_id=n.warehouse_id order by n.due_on,n.production_order,i.code`,
 'ship-plan':`select o.code,o.partner,o.due_on,o.warehouse,i.code as item,l.line_no,(l.quantity-l.completed)::numeric(14,3) as remaining,${avail}::numeric(14,3) as available,greatest(l.quantity-l.completed-${avail},0)::numeric(14,3) as short,case when o.due_on<current_date then 'late' else 'due' end as timing from v_orders o join order_lines l on l.order_id=o.id join items i on i.id=l.item_id join v_stock s on s.item_id=l.item_id and s.warehouse_id=o.warehouse_id where o.kind='sales' and o.status='open' and l.completed<l.quantity order by o.due_on,o.code,l.line_no`,
 'supplier-chase':"select code,partner as supplier,warehouse,due_on,remaining_value,greatest(current_date-due_on,0) as days_late from v_orders where kind='purchase' and status='open' and due_on<=current_date+7 order by due_on,code",
 'quotes-follow-up':"select code,partner,valid_until,total,(current_date-last_activity::date) as days_quiet,case when valid_until<current_date then 'expired' when valid_until<=current_date+7 then 'expires this week' else 'quiet' end as why from v_orders where kind='quote' and status='open' and (last_activity<now()-interval '5 days' or valid_until<=current_date+7) order by valid_until,code",
 approvals:"select code,partner,total,margin_pct,approval_note,due_on from v_orders where approval='pending' order by due_on,code",
 'credit-check':'select code,name,credit_limit,outstanding,open_orders,(outstanding+open_orders-credit_limit)::numeric(14,2) as over_by,oldest_overdue_days from v_exposure where outstanding+open_orders>credit_limit order by over_by desc',
 receivables:"select i.code,c.name as customer,i.issued_on,i.due_on,i.total,i.paid,(i.total-i.paid) as outstanding,case when i.due_on>=current_date then 'current' when current_date-i.due_on<=30 then '1-30' when current_date-i.due_on<=60 then '31-60' else '60+' end as age,i.ledger_ref from invoices i join partners c on c.id=i.partner_id where i.kind='receivable' and i.paid<i.total order by i.due_on,i.code",
 payables:"select i.code,s.name as supplier,i.issued_on,i.due_on,i.total,i.paid,(i.total-i.paid) as outstanding,greatest(current_date-i.due_on,0) as days_overdue,i.ledger_ref from invoices i join partners s on s.id=i.partner_id where i.kind='payable' and i.paid<i.total order by i.due_on,i.code",
 margins:"select partner as customer,count(*)::int as orders,sum(completed_value)::numeric(14,2) as shipped_value,sum(completed_margin)::numeric(14,2) as shipped_margin,round(sum(completed_margin)*100/nullif(sum(completed_value),0),1) as margin_pct,sum(remaining_value)::numeric(14,2) as open_value from v_orders where kind='sales' and status<>'cancelled' group by partner order by shipped_margin desc,partner",
 'count-due':"select i.code,i.name,sum(s.on_hand)::numeric(14,3) as on_hand,i.last_counted_on,coalesce((current_date-i.last_counted_on)::text,'never') as days_since from items i join v_stock s on s.item_id=i.id group by i.id having sum(s.on_hand)>0 and (i.last_counted_on is null or i.last_counted_on<current_date-90) order by i.last_counted_on nulls first,i.code",
 attention:`select 'order' as record,code,concat_ws('; ',case when due_on<current_date then 'overdue' end,case when approval='pending' then 'waiting for approval: '||approval_note end,case when last_activity<now()-${quiet} then 'quiet over 7 days' end) as reason from v_orders where kind in ('sales','purchase') and status in ('open','draft') and (due_on<current_date or approval='pending' or last_activity<now()-${quiet})
 union all select 'quote',code,case when valid_until<current_date then 'expired, still open' when valid_until<=current_date+7 then 'expires '||valid_until||', no reply' else 'quiet over 5 days' end from v_orders where kind='quote' and status='open' and (last_activity<now()-interval '5 days' or valid_until<=current_date+7)
 union all select 'production',p.code,concat_ws('; ',case when p.due_on<current_date then 'past due' end,case when exists(select 1 from v_component_needs n join v_stock s on s.item_id=n.item_id and s.warehouse_id=n.warehouse_id where n.production_order_id=p.id and n.remaining>s.on_hand-s.blocked) then 'short of components' end) from production_orders p where p.status in ('planned','released') and (p.due_on<current_date or exists(select 1 from v_component_needs n join v_stock s on s.item_id=n.item_id and s.warehouse_id=n.warehouse_id where n.production_order_id=p.id and n.remaining>s.on_hand-s.blocked))
 union all select 'batch',batch||' '||item||' '||warehouse,concat_ws('; ',case when on_hold then 'on hold: '||hold_reason end,case when days_left<0 then 'expired with stock' when days_left<=30 then 'expires in '||days_left||' days' end) from v_batches where on_hand>0 and (on_hold or days_left<=30)
 union all select 'invoice',code,'overdue '||(current_date-due_on)||' days' from invoices where kind='receivable' and paid<total and due_on<current_date
 order by record,code`,
 records:'select id,name,reference,prepared_on,completed_on,period_end,retain_until,source_ref from records order by name',
 movements:'select i.code as item,w.code as warehouse,b.code as batch,m.kind,m.quantity,m.reason,m.event_key,m.created_at from stock_moves m join items i on i.id=m.item_id join warehouses w on w.id=m.warehouse_id left join batches b on b.id=m.batch_id order by m.created_at,m.event_key',
 activity:'select record,note,created_at from activity order by created_at',
 audit:'select action,record_id,detail,created_at from audit order by created_at,id'
};
export const snapshots=['settings','warehouses','partners','items','bom_lines','orders','order_lines','production_orders','batches','stock_moves','invoices','records','activity','audit','import_batches'];
function ambiguous(entity,value,rows,label){return Error(`Ambiguous ${entity}: ${value}. Candidates:\n${rows.map(r=>`${r.id}  ${r.code?r.code+'  ':''}${r[label]??''}`).join('\n')}`);}
export async function resolve(db,entity,value){
 const cfg=entities[entity];if(!cfg)throw Error(`Unknown entity ${entity}`);if(!value)throw Error(`A ${entity} name, code or ID is required`);
 const kind=cfg.kind?` and kind='${cfg.kind}'`:'',hasCode=cfg.fields.includes('code'),label=cfg.fields.includes('name')?'name':'code';
 const exact=await db.query(`select * from ${cfg.table} where (id::text=$1 ${hasCode?'or lower(code)=lower($1)':''})${kind}`,[value]);
 if(exact.length===1)return exact[0];
 const rows=await db.query(`select * from ${cfg.table} where (starts_with(id::text,$1) or position(lower($1) in lower(${label}))>0 ${hasCode&&label!=='code'?'or starts_with(lower(code),lower($1))':''})${kind} order by ${label}`,[value]);
 if(rows.length===1)return rows[0];if(!rows.length)throw Error(`No match for ${entity}: ${value}`);throw ambiguous(entity,value,rows,label);
}
// Batch codes are unique per item, so name the item when two items share a batch code.
export async function resolveBatch(db,code,item){
 if(!code)throw Error('A batch code is required');
 const rows=await db.query(`select b.*,i.code as item_code from batches b join items i on i.id=b.item_id where (lower(b.code)=lower($1) or b.id::text=$1) ${item?'and b.item_id=$2':''}`,item?[code,item]:[code]);
 if(rows.length===1)return rows[0];if(!rows.length)throw Error(`No match for batch: ${code}`);
 throw Error(`Ambiguous batch: ${code}. Name the item with --item. Candidates:\n${rows.map(r=>`${r.id}  ${r.code}  ${r.item_code}`).join('\n')}`);
}
export async function audit(db,action,id,detail){await db.query('insert into audit(action,record_id,detail) values($1,$2,$3)',[action,id,JSON.stringify(detail)]);}
export async function transaction(db,fn){await db.exec('BEGIN');try{const r=await fn();await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
export function number(v,{positive=false,integer=false}={}){if(v==null||v===''||!Number.isFinite(Number(v))||Number(v)<0||(positive&&Number(v)<=0)||(integer&&!Number.isInteger(Number(v))))throw Error(`Invalid ${positive?'positive ':''}number: ${v}`);return Number(v);}
export function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`Invalid ISO date: ${v}`);return v;}
export const isDateField=k=>/_on$|_due$|period_end|retain_until|last_backup|valid_until|last_mock_recall/.test(k);
const round3=n=>Math.round(n*1000)/1000;

// Which batches a quantity comes out of: first expiry first out, skipping held and expired batches.
// Returns [{batch_id, quantity}] or throws when the warehouse cannot cover it.
export async function pick(db,item,warehouse,qty,batch){
 if(!item.batch_managed){
  const q=Number((await db.query('select coalesce(sum(quantity),0) as q from stock_moves where item_id=$1 and warehouse_id=$2',[item.id,warehouse]))[0].q);
  if(round3(q-qty)<0)throw Error(`Insufficient stock of ${item.code}: ${q} on hand, ${qty} needed`);return [{batch_id:null,quantity:qty}];
 }
 const rows=await db.query(`select batch_id,batch,on_hand,on_hold,expires_on from v_batches where item_id=$1 and warehouse_id=$2 and on_hand>0 ${batch?'and batch_id=$3':''} order by expires_on nulls last,made_on,batch`,batch?[item.id,warehouse,batch]:[item.id,warehouse]);
 const today=new Date().toISOString().slice(0,10);
 if(batch&&rows[0]?.on_hold)throw Error(`Batch ${rows[0].batch} is on hold`);
 if(batch&&rows[0]?.expires_on&&String(rows[0].expires_on)<today)throw Error(`Batch ${rows[0].batch} expired on ${rows[0].expires_on}`);
 const out=[];let left=qty;
 for(const r of rows){if(left<=0)break;if(r.on_hold||(r.expires_on&&String(r.expires_on)<today))continue;const take=Math.min(left,Number(r.on_hand));out.push({batch_id:r.batch_id,batch:r.batch,quantity:round3(take)});left=round3(left-take);}
 if(left>0)throw Error(`Insufficient usable stock of ${item.code}${batch?' in that batch':''}: short ${left} (held and expired batches are skipped)`);
 return out;
}

// One step back and every step forward from a batch: what it was made from, what it went into,
// which customers received it and what is still on the shelf. Food recalls start here.
export async function trace(db,batchId){
 const head=(await db.query('select b.code as batch,i.code as item,i.name,b.made_on,b.expires_on,s.name as supplier,b.supplier_lot,p.code as production_order from batches b join items i on i.id=b.item_id left join partners s on s.id=b.supplier_id left join production_orders p on p.id=b.production_order_id where b.id=$1',[batchId]))[0];
 const made_from=await db.query("select b.code as batch,i.code as item,-sum(m.quantity)::numeric(14,3) as quantity_used,s.name as supplier,b.supplier_lot from stock_moves m join batches b on b.id=m.batch_id join items i on i.id=b.item_id left join partners s on s.id=b.supplier_id where m.kind='issue' and m.production_order_id=(select production_order_id from batches where id=$1) group by b.id,i.code,s.name order by i.code",[batchId]);
 const used_in=[],shipped_to=[],still_held=[],seen=new Set();let queue=[batchId];
 while(queue.length){
  const id=queue.shift();if(seen.has(id))continue;seen.add(id);
  for(const r of await db.query("select pr.code as production_order,ob.id as output_id,ob.code as output_batch,oi.code as output_item,-sum(m.quantity)::numeric(14,3) as quantity_used from stock_moves m join production_orders pr on pr.id=m.production_order_id join batches ob on ob.production_order_id=pr.id join items oi on oi.id=ob.item_id join batches b on b.id=m.batch_id where m.kind='issue' and m.batch_id=$1 group by pr.code,ob.id,ob.code,oi.code order by pr.code",[id])){used_in.push({production_order:r.production_order,output_batch:r.output_batch,output_item:r.output_item,quantity_used:r.quantity_used});queue.push(r.output_id);}
  shipped_to.push(...await db.query("select c.code as customer_code,c.name as customer,c.email,c.phone,o.code as sales_order,i.code as item,b.code as batch,-sum(m.quantity)::numeric(14,3) as quantity,min(m.created_at)::date as shipped_on from stock_moves m join batches b on b.id=m.batch_id join items i on i.id=b.item_id join order_lines l on l.id=m.line_id join orders o on o.id=l.order_id join partners c on c.id=o.partner_id where m.kind='delivery' and m.batch_id=$1 group by c.id,o.code,i.code,b.code order by c.code,o.code",[id]));
  still_held.push(...await db.query('select batch,item,warehouse,on_hand,on_hold from v_batches where batch_id=$1 and on_hand<>0 order by warehouse',[id]));
 }
 return {batch:head,made_from,used_in,shipped_to,still_held};
}

// Source-backed record checks. docs/compliance.md explains each rule and its limits.
const SRC={
 nzRecords:'https://www.ird.govt.nz/managing-my-tax/record-keeping',
 auRecords:'https://business.gov.au/finance/payments-and-invoicing/record-keeping',
 nzGst:'https://www.ird.govt.nz/gst/tax-invoices-for-gst/how-tax-invoices-for-gst-work',
 auGst:'https://business.gov.au/finance/payments-and-invoicing/invoicing',
 nzPpsr:'https://ppsr.companiesoffice.govt.nz/',
 auPpsr:'https://www.ppsr.gov.au/',
 nzRecall:'https://www.mpi.govt.nz/food-business/food-recalls/',
 auRecall:'https://www.foodstandards.gov.au/business/food-recalls',
 house:'docs/compliance.md#house-rules'
};
export async function compliance(db){
 const s=(await db.query('select * from settings'))[0];const out=[];
 if(!s)return [{rule:'SETUP',record:'business',finding:'Configure country, currency, tax number and record retention before using real data',source:'docs/compliance.md'}];
 const nz=s.country==='NZ',years=nz?7:5,recSrc=nz?SRC.nzRecords:SRC.auRecords;
 if(s.retention_years<years)out.push({rule:'RETENTION_POLICY',record:s.name,finding:`Retention policy is ${s.retention_years} years; the minimum is ${years}`,source:recSrc});
 const keep=Math.max(years,s.retention_years),from=nz?'greatest(prepared_on,completed_on,period_end)':'greatest(prepared_on,completed_on)';
 for(const r of await db.query(`select name,source_ref,retain_until,(${from}+make_interval(years => $1))::date::text as minimum from records where source_ref='' or retain_until<(${from}+make_interval(years => $1))::date order by name`,[keep])){
  if(!r.source_ref)out.push({rule:'SOURCE_EVIDENCE',record:r.name,finding:'No archive reference for the source document',source:recSrc});
  if(String(r.retain_until)<r.minimum)out.push({rule:'RETAIN_UNTIL',record:r.name,finding:`Keep until at least ${r.minimum}`,source:recSrc});
 }
 if(!s.tax_number.trim())out.push({rule:'SELLER_TAX_NUMBER',record:s.name,finding:nz?'No GST number recorded; supplies over $200 must show it':'No ABN recorded; every tax invoice must show it',source:nz?SRC.nzGst:SRC.auGst});
 const buyer=nz?"c.email='' and c.phone='' and c.address='' and c.tax_id=''":"c.tax_id='' and c.address=''";
 for(const r of await db.query(`select i.code,c.name from invoices i join partners c on c.id=i.partner_id where i.kind='receivable' and i.total>1000 and ${buyer} order by i.code`))
  out.push({rule:'BUYER_DETAILS',record:r.code,finding:nz?`${r.name} has no identifier (address, phone, email or NZBN) for a supply over $1,000`:`${r.name} has no ABN or address recorded for a sale over $1,000`,source:nz?SRC.nzGst:SRC.auGst});
 for(const r of await db.query("select code,name from partners where kind='customer' and active and credit_limit>0 and terms_days>0 and ppsr_ref='' order by code"))
  out.push({rule:'PPSR_REGISTRATION',record:r.code,finding:`${r.name} buys on credit with no PPSR registration recorded; if your terms keep title until paid, register it to protect your claim to the goods`,source:nz?SRC.nzPpsr:SRC.auPpsr});
 if(s.food_business){
  if(!s.recall_plan_ref.trim())out.push({rule:'RECALL_PLAN',record:s.name,finding:nz?'No written recall procedure recorded; food businesses on a food control plan or national programme need one and must tell MPI within 24 hours of deciding to recall':'No written recall plan recorded; food manufacturers, wholesalers and importers must have one (Standard 3.2.2 clause 12)',source:nz?SRC.nzRecall:SRC.auRecall});
  if(!s.last_mock_recall||String(s.last_mock_recall)<new Date(Date.now()-365*86400000).toISOString().slice(0,10))out.push({rule:'MOCK_RECALL',record:s.name,finding:`No practice recall in the last 12 months${s.last_mock_recall?` (last ${s.last_mock_recall})`:''}; run trace on a recent batch and record it with mock-recall`,source:nz?SRC.nzRecall:SRC.auRecall});
  for(const r of await db.query("select b.code,i.code as item from batches b join items i on i.id=b.item_id where b.supplier_id is not null and b.supplier_lot='' order by i.code,b.code"))
   out.push({rule:'SUPPLIER_LOT',record:`${r.item} ${r.code}`,finding:"Received batch has no supplier lot number, so a supplier's recall cannot be matched to it",source:nz?SRC.nzRecall:SRC.auRecall});
 }
 for(const r of await db.query("select batch,item,warehouse,on_hand from v_batches where on_hand>0 and expires_on<current_date and not on_hold order by batch"))out.push({rule:'EXPIRED_STOCK',record:`${r.item} ${r.batch} ${r.warehouse}`,finding:`${r.on_hand} expired and not on hold (house rule)`,source:SRC.house});
 if(!s.last_backup||!s.backup_ref||String(s.last_backup)<new Date(Date.now()-7*86400000).toISOString().slice(0,10))out.push({rule:'BACKUP_REVIEW',record:s.name,finding:'No referenced backup in the last seven days (house rule)',source:SRC.house});
 for(const r of await db.query("select code from orders where status='open' and not exists(select 1 from order_lines where order_id=orders.id)"))out.push({rule:'EMPTY_ORDER',record:r.code,finding:'Released order has no lines (house rule)',source:SRC.house});
 return out;
}
