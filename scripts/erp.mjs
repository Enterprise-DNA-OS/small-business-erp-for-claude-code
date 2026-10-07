#!/usr/bin/env node
// One CLI for the whole ERP. Human tables by default, --json for machines.
// Reads take no arguments; writes go through one transaction each and land in the audit table.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table} from './lib/format.mjs';
import {entities,reports,snapshots,resolve,resolveBatch,transaction,audit,number,date,isDateField,numeric,integers,compliance,pick,trace} from './lib/domain.mjs';
import {importSapB1} from './lib/import.mjs';
export const actions=['setup','add','set','line','set-bom','release','approve','reject','win-quote','lose-quote','cancel-order','receive','ship','plan-production','release-production','complete-production','close-production','transfer','adjust-stock','count','hold-batch','release-batch','mock-recall','invoice-balance','log','draft-quote','draft-order','draft-chase','draft-statement','draft-recall','import','export'];
export const composites=['help','compliance','weekly-review','month-end','order','item','trace'];
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
const round3=n=>Math.round(n*1000)/1000;
function parse(args){const pos=[],flags={};for(const a of args){if(!a.startsWith('--')){pos.push(a);continue;}const eq=a.indexOf('=');const key=(eq<0?a.slice(2):a.slice(2,eq)).replaceAll('-','_');if(key in flags)throw Error(`Duplicate flag ${key}`);flags[key]=eq<0?true:a.slice(eq+1);}delete flags.json;return {pos,flags};}
function allow(f,keys){for(const k of Object.keys(f))if(!keys.includes(k))throw Error(`Unknown option --${k.replaceAll('_','-')}`);}
function required(v,label){if(typeof v!=='string'||!v.trim())throw Error(`${label} is required`);return v.trim();}
async function configured(db){if((await db.query('select id from settings')).length!==1)throw Error('Run setup once before adding real records');}
const bools=['batch_managed','food_business'];
function check(key,value){if(typeof value!=='string')throw Error(`--${key.replaceAll('_','-')} needs a value`);if(isDateField(key))date(value);if(numeric.includes(key))number(value,{integer:integers.includes(key)});if(bools.includes(key)&&!['true','false'].includes(value))throw Error(`${key} must be true or false`);if(key==='kind'&&!['purchased','made','quote','sales','purchase','receivable','payable'].includes(value))throw Error(`Unknown kind ${value}`);}
export async function addRecord(db,entity,fields){
 const cfg=entities[entity];if(!cfg||entity==='production')throw Error(`Unknown entity ${entity}. Production orders come from plan-production.`);allow(fields,cfg.fields);
 const vals={...fields};
 for(const [k,v] of Object.entries(vals)){check(k,v);if(cfg.refs?.[k])vals[k]=(await resolve(db,cfg.refs[k],v)).id;}
 if(cfg.fields.includes('code')&&!String(vals.code||'').trim())throw Error('code is required');
 if(cfg.fields.includes('name')&&!String(vals.name||'').trim())throw Error('name is required');
 if(entity==='order'){
  if(!['quote','sales','purchase'].includes(vals.kind))throw Error('Order kind must be quote, sales or purchase');
  vals.partner_id=(await resolve(db,vals.kind==='purchase'?'supplier':'customer',required(vals.partner_id,'--partner-id'))).id;
  if(vals.kind!=='quote'&&vals.valid_until)throw Error('Only a quote has --valid-until');
 }
 if(entity==='invoice'){if(!['receivable','payable'].includes(vals.kind))throw Error('Invoice kind must be receivable or payable');vals.partner_id=(await resolve(db,vals.kind==='payable'?'supplier':'customer',required(vals.partner_id,'--partner-id'))).id;}
 if(entity==='item'&&vals.kind&&!['purchased','made'].includes(vals.kind))throw Error('Item kind must be purchased or made');
 if(cfg.kind)vals.kind=cfg.kind;
 const keys=Object.keys(vals);
 const row=(await db.query(`insert into ${cfg.table}(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(vals)))[0];
 await audit(db,`add ${entity}`,row.id,vals);return row;
}
async function locked(db,entity,ref){const r=await resolve(db,entity,ref);return (await db.query(`select * from ${entities[entity].table} where id=$1 for update`,[r.id]))[0];}
async function move(db,{item,warehouse,batch=null,line=null,production=null,kind,quantity,reason,event}){await db.query('insert into stock_moves(item_id,warehouse_id,batch_id,line_id,production_order_id,kind,quantity,reason,event_key) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[item,warehouse,batch,line,production,kind,quantity,reason,event]);}
// Take a quantity out by first expiry first out (or from the named batch), one movement per batch.
async function takeOut(db,item,warehouse,qty,{batch,line,production,kind,reason,event}){
 const picks=await pick(db,item,warehouse,qty,batch);
 for(const [n,p] of picks.entries())await move(db,{item:item.id,warehouse,batch:p.batch_id,line,production,kind,quantity:-p.quantity,reason,event:picks.length>1?`${event}:${n+1}`:event});
 return picks;
}
async function newBatch(db,item,{code,made,expires,supplier=null,lot='',production=null}){
 const exp=expires?date(expires):item.shelf_life_days?addDays(made,item.shelf_life_days):null;
 const old=(await db.query('select * from batches where item_id=$1 and lower(code)=lower($2)',[item.id,code]))[0];
 if(old){if(old.supplier_id!==supplier||old.production_order_id!==production)throw Error(`Batch ${code} of ${item.code} already exists from another source`);return old;}
 return (await db.query('insert into batches(item_id,code,made_on,expires_on,supplier_id,supplier_lot,production_order_id) values($1,$2,$3,$4,$5,$6,$7) returning *',[item.id,code,made,exp,supplier,lot,production]))[0];
}
function writeDraft(name,body){const folder=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,`${name}-${Date.now()}.md`);fs.writeFileSync(file,body,{flag:'wx'});return [{file}];}
const md=(rows,cols)=>rows.length?`| ${cols.join(' | ')} |\n|${cols.map(()=>'---').join('|')}|\n${rows.map(r=>`| ${cols.map(c=>r[c]??'').join(' | ')} |`).join('\n')}`:'(none)';
async function salesChecks(db,o){
 const s=(await db.query('select min_margin_pct from settings'))[0],v=(await db.query('select margin_pct,total from v_orders where id=$1',[o.id]))[0],x=(await db.query('select * from v_exposure where id=$1',[o.partner_id]))[0];
 const out=[];if(v.margin_pct!==null&&Number(v.margin_pct)<Number(s.min_margin_pct))out.push(`margin ${v.margin_pct}% below ${Number(s.min_margin_pct)}%`);
 const over=Number(x.outstanding)+Number(x.open_orders)-Number(x.credit_limit);if(over>0.005)out.push(`over credit limit by ${over.toFixed(2)}`);return out;
}
export async function run(db,args){
 const {pos,flags:f}=parse(args),[cmd='help',...p]=pos;
 if(cmd in reports){allow(f,[]);return db.query(reports[cmd]);}
 if(cmd==='help'){allow(f,[]);return [{reads:Object.keys(reports).join(', '),reviews:composites.join(', '),writes:actions.join(', '),guide:'docs/cli.md'}];}
 if(cmd==='compliance'){allow(f,[]);return compliance(db);}
 if(cmd==='weekly-review'){allow(f,[]);return {attention:await db.query(reports.attention),ship_plan:await db.query(reports['ship-plan']),mrp:await db.query(reports.mrp)};}
 if(cmd==='month-end'){allow(f,[]);return {receivables:(await db.query(reports.receivables)).filter(r=>r.age!=='current'),credit_check:await db.query(reports['credit-check']),approvals:await db.query(reports.approvals),expiring:await db.query(reports.expiring),count_due:await db.query(reports['count-due']),supplier_chase:await db.query(reports['supplier-chase'])};}
 if(cmd==='order'){allow(f,[]);const o=await resolve(db,'order',p[0]);return {order:(await db.query('select code,kind,partner,warehouse,status,approval,approval_note,due_on,valid_until,reference,total,remaining_value,margin_pct from v_orders where id=$1',[o.id]))[0],lines:await db.query('select l.line_no,i.code as item,i.name,l.quantity,l.completed,l.unit_price,l.unit_cost from order_lines l join items i on i.id=l.item_id where order_id=$1 order by line_no',[o.id]),batches:await db.query("select b.code as batch,i.code as item,-sum(m.quantity)::numeric(14,3) as quantity from stock_moves m join order_lines l on l.id=m.line_id join batches b on b.id=m.batch_id join items i on i.id=b.item_id where l.order_id=$1 and m.kind='delivery' group by b.code,i.code order by i.code,b.code",[o.id]),activity:await db.query('select note,created_at from activity where record=$1 order by created_at',[o.code])};}
 if(cmd==='item'){allow(f,[]);const i=await resolve(db,'item',p[0]);return {item:(await db.query('select code,name,uom,kind,batch_managed,shelf_life_days,unit_cost,unit_price,reorder_point,order_multiple,last_counted_on from items where id=$1',[i.id]))[0],stock:await db.query('select warehouse,on_hand,blocked,committed,incoming from v_stock where item_id=$1 order by warehouse',[i.id]),batches:await db.query('select batch,warehouse,expires_on,on_hand,on_hold from v_batches where item_id=$1 and on_hand<>0 order by expires_on',[i.id]),made_from:await db.query('select c.code,c.name,b.quantity,c.uom from bom_lines b join items c on c.id=b.component_id where b.parent_id=$1 order by c.code',[i.id]),used_in:await db.query('select p.code,p.name,b.quantity from bom_lines b join items p on p.id=b.parent_id where b.component_id=$1 order by p.code',[i.id])};}
 if(cmd==='trace'){allow(f,['item']);const b=await resolveBatch(db,p[0],f.item?(await resolve(db,'item',f.item)).id:null);return trace(db,b.id);}
 if(cmd==='export'){allow(f,[]);const file=path.resolve(required(p[0],'Output file'));const records={};await transaction(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');for(const t of snapshots)records[t]=await db.query(`select * from ${t} order by id`);});fs.writeFileSync(file,JSON.stringify({version:1,exported_at:new Date().toISOString(),records},null,2)+'\n',{flag:'wx'});return [{file,tables:snapshots.length}];}
 if(cmd==='import'){if(p[0]!=='sap-business-one')throw Error('Supported import: sap-business-one');allow(f,['apply','warehouse','date_order']);if(f.apply!==undefined&&f.apply!==true)throw Error('Use --apply without a value');await configured(db);return importSapB1(db,p[1],p[2],f);}
 if(['draft-quote','draft-order','draft-chase'].includes(cmd)){
  allow(f,[]);const o=await run(db,['order',p[0]]);const want={'draft-quote':'quote','draft-order':'sales','draft-chase':'purchase'}[cmd];if(o.order.kind!==want)throw Error(`${cmd} needs a ${want==='sales'?'sales order':want==='purchase'?'purchase order':'quote'}`);
  const text={'draft-quote':`Thanks for the chance to quote. Prices below hold until ${o.order.valid_until||'further notice'}. Reply to confirm and we will book it in for ${o.order.due_on}.`,'draft-order':'Please check the lines and delivery date below and reply to confirm.','draft-chase':'Please confirm the quantities still to come and the date they will arrive.'}[cmd];
  return writeDraft(`${cmd}-${o.order.code}`,`# DRAFT: ${o.order.code}\n\nTo ${o.order.partner}. Due ${o.order.due_on}.${o.order.reference?` Your reference ${o.order.reference}.`:''}\n\n${text}\n\n${md(o.lines,['item','name','quantity','completed','unit_price'])}\n\nNothing has been sent. Amounts exclude GST.\n`);
 }
 if(cmd==='draft-statement'){
  allow(f,[]);const c=await resolve(db,'customer',p[0]);const rows=(await db.query(reports.receivables)).filter(r=>r.customer===c.name);if(!rows.length)throw Error(`${c.name} has nothing outstanding`);
  const due=rows.reduce((s,r)=>s+Number(r.outstanding),0).toFixed(2);
  return writeDraft(`draft-statement-${c.code}`,`# DRAFT: statement for ${c.name}\n\nHello,\n\nOur records show ${due} outstanding across the invoices below. If any of these are already paid, send the remittance and we will match it.\n\n${md(rows,['code','issued_on','due_on','total','paid','outstanding','age'])}\n\nNothing has been sent. Balances are from the accounting ledger on the date shown in each reference.\n`);
 }
 if(cmd==='draft-recall'){
  allow(f,['item','reason']);const b=await resolveBatch(db,p[0],f.item?(await resolve(db,'item',f.item)).id:null);const t=await trace(db,b.id),reason=required(f.reason,'--reason');
  if(!t.shipped_to.length)throw Error(`Nothing from batch ${b.code} has reached a customer; hold the stock listed by trace`);
  const files=[];const by=new Map();for(const r of t.shipped_to){if(!by.has(r.customer_code))by.set(r.customer_code,[]);by.get(r.customer_code).push(r);}
  for(const [code,rows] of by)files.push(...writeDraft(`draft-recall-${b.code}-${code}`,`# DRAFT: product recall notice for ${rows[0].customer}\n\nWe are recalling the product below because ${reason}. Please stop selling it, set it aside and tell us how much you still hold. We will arrange collection and credit.\n\n${md(rows,['item','batch','sales_order','quantity','shipped_on'])}\n\nNothing has been sent. Before sending, follow your written recall plan and notify the regulator as it requires.\n`));
  return files;
 }
 if(!actions.includes(cmd))throw Error(`Unknown command: ${cmd}. Run help.`);
 return transaction(db,async()=>{
 if(cmd==='setup'){
  allow(f,['name','country','currency','tax_number','retention_years','min_margin_pct','food_business','recall_plan_ref','last_backup','backup_ref']);required(f.name,'name');
  const existing=(await db.query('select * from settings for update'))[0];
  const country=f.country??existing?.country,currency=f.currency??existing?.currency;
  if(!['NZ','AU'].includes(country))throw Error('country must be NZ or AU');if(!['NZD','AUD'].includes(currency))throw Error('currency must be NZD or AUD');
  if(existing&&(country!==existing.country||currency!==existing.currency))throw Error('Country and currency are fixed for this database; use a separate database');
  for(const k of ['min_margin_pct','food_business','last_backup'])if(f[k]!==undefined)check(k,f[k]);
  const years=number(f.retention_years??existing?.retention_years??(country==='NZ'?7:5),{integer:true});
  const vals={name:f.name,retention_years:years,tax_number:f.tax_number??existing?.tax_number??'',min_margin_pct:f.min_margin_pct??existing?.min_margin_pct??25,food_business:f.food_business??existing?.food_business??false,recall_plan_ref:f.recall_plan_ref??existing?.recall_plan_ref??'',last_backup:f.last_backup??existing?.last_backup??null,backup_ref:f.backup_ref??existing?.backup_ref??null};
  const keys=Object.keys(vals);
  const rows=existing?await db.query(`update settings set ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} where id=$${keys.length+1} returning *`,[...Object.values(vals),existing.id]):await db.query(`insert into settings(${keys.join(',')},country,currency) values(${keys.map((_,i)=>'$'+(i+1)).join(',')},$${keys.length+1},$${keys.length+2}) returning *`,[...Object.values(vals),country,currency]);
  await audit(db,cmd,rows[0].id,f);return rows;
 }
 await configured(db);
 if(cmd==='add')return [await addRecord(db,p[0],f)];
 if(cmd==='set'){
  const editable={warehouse:['name'],customer:['name','email','phone','address','tax_id','credit_limit','terms_days','ppsr_ref'],supplier:['name','email','phone','address','tax_id','terms_days','lead_days'],item:['name','unit_cost','unit_price','reorder_point','order_multiple','shelf_life_days','make_days'],order:['due_on','valid_until','reference'],invoice:['due_on','ledger_ref'],record:entities.record.fields};
  if(!editable[p[0]])throw Error(`Cannot set ${p[0]}`);allow(f,editable[p[0]]);if(!Object.keys(f).length)throw Error('Supply fields to change');
  const r=await locked(db,p[0],p[1]);if(['completed','cancelled','won','lost'].includes(r.status))throw Error('Record is closed');
  for(const [k,v] of Object.entries(f)){check(k,v);if(!['email','phone','address','tax_id','reference','ppsr_ref'].includes(k))required(v,k);}
  const keys=Object.keys(f);const rows=await db.query(`update ${entities[p[0]].table} set ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} where id=$${keys.length+1} returning *`,[...Object.values(f),r.id]);
  await audit(db,cmd,r.id,{entity:p[0],before:Object.fromEntries(keys.map(k=>[k,r[k]])),after:f});return rows;
 }
 if(cmd==='line'){
  allow(f,[]);const [ref,itemRef,qty,price,n]=p,o=await locked(db,'order',ref);if(o.status!=='draft')throw Error('Add lines only to draft orders and quotes');const i=await resolve(db,'item',itemRef);
  const row=(await db.query('insert into order_lines(order_id,line_no,item_id,quantity,unit_price,unit_cost) values($1,$2,$3,$4,$5,$6) returning *',[o.id,number(n,{positive:true,integer:true}),i.id,number(qty,{positive:true}),number(price),i.unit_cost]))[0];
  if(o.approval!=='not_needed')await db.query("update orders set approval='not_needed',approval_note='' where id=$1",[o.id]);
  await audit(db,cmd,o.id,row);return [row];
 }
 if(cmd==='set-bom'){
  allow(f,[]);const parent=await resolve(db,'item',p[0]),comp=await resolve(db,'item',p[1]);if(parent.kind!=='made')throw Error(`${parent.code} is a purchased item; set kind made first`);
  const rows=await db.query('insert into bom_lines(parent_id,component_id,quantity) values($1,$2,$3) on conflict(parent_id,component_id) do update set quantity=excluded.quantity returning *',[parent.id,comp.id,number(p[2],{positive:true})]);
  await audit(db,cmd,parent.id,{component:comp.code,quantity:p[2]});return rows;
 }
 if(cmd==='release'){
  allow(f,[]);const o=await locked(db,'order',p[0]);if(o.status!=='draft')throw Error('Release needs a draft order or quote');if(!(await db.query('select id from order_lines where order_id=$1',[o.id])).length)throw Error('Order has no lines');
  if(o.kind==='sales'&&o.approval!=='approved'){const why=await salesChecks(db,o);if(why.length){const rows=await db.query("update orders set approval='pending',approval_note=$1 where id=$2 returning code,status,approval,approval_note",[why.join('; '),o.id]);await audit(db,'approval requested',o.id,{why});return rows;}}
  const rows=await db.query("update orders set status='open' where id=$1 returning code,status,approval",[o.id]);await audit(db,cmd,o.id,{});return rows;
 }
 if(cmd==='approve'||cmd==='reject'){
  allow(f,cmd==='approve'?['by']:[]);const o=await locked(db,'order',p[0]);if(o.approval!=='pending')throw Error('Order is not waiting for approval');
  const note=cmd==='approve'?`${o.approval_note}; approved by ${required(f.by,'--by')}`:`${o.approval_note}; rejected: ${required(p[1],'Reason')}`;
  const rows=await db.query(`update orders set approval=$1,approval_note=$2${cmd==='approve'?",status='open'":''} where id=$3 returning code,status,approval,approval_note`,[cmd==='approve'?'approved':'rejected',note,o.id]);await audit(db,cmd,o.id,{note});return rows;
 }
 if(cmd==='win-quote'){
  allow(f,['code','due_on']);const q=await locked(db,'order',p[0]);if(q.kind!=='quote'||!['open','draft'].includes(q.status))throw Error('Only an open quote can be won');
  if(q.valid_until&&String(q.valid_until)<today())throw Error(`Quote expired on ${q.valid_until}; requote or extend --valid-until first`);
  const code=f.code||q.code.replace(/^(QT|Q)-/i,'SO-');const due=f.due_on?date(f.due_on):q.due_on;
  const so=(await db.query("insert into orders(code,kind,partner_id,warehouse_id,due_on,reference,from_quote_id) values($1,'sales',$2,$3,$4,$5,$6) returning *",[code,q.partner_id,q.warehouse_id,due,q.reference||q.code,q.id]))[0];
  await db.query('insert into order_lines(order_id,line_no,item_id,quantity,unit_price,unit_cost) select $1,line_no,item_id,quantity,unit_price,unit_cost from order_lines where order_id=$2',[so.id,q.id]);
  await db.query("update orders set status='won' where id=$1",[q.id]);await audit(db,cmd,q.id,{sales_order:code});
  return [{quote:q.code,status:'won',sales_order:code,next:'release the sales order'}];
 }
 if(cmd==='lose-quote'){
  allow(f,[]);const q=await locked(db,'order',p[0]);if(q.kind!=='quote'||!['open','draft'].includes(q.status))throw Error('Only an open quote can be lost');const why=required(p[1],'Reason');
  await db.query("update orders set status='lost' where id=$1",[q.id]);await db.query('insert into activity(record,note) values($1,$2)',[q.code,`Lost: ${why}`]);await audit(db,cmd,q.id,{why});return [{quote:q.code,status:'lost',reason:why}];
 }
 if(cmd==='cancel-order'){
  allow(f,[]);const o=await locked(db,'order',p[0]);if(o.kind==='quote')throw Error('Use lose-quote for a quote');if(!['draft','open'].includes(o.status))throw Error('Order is already closed');
  if((await db.query('select id from order_lines where order_id=$1 and completed>0',[o.id])).length)throw Error('Cannot cancel a partly received or shipped order');required(p[1],'Cancellation reason');
  const rows=await db.query("update orders set status='cancelled' where id=$1 returning code,status",[o.id]);await audit(db,cmd,o.id,{reason:p[1]});return rows;
 }
 if(cmd==='receive'||cmd==='ship'){
  allow(f,cmd==='receive'?['event','batch','expires_on','supplier_lot']:['event','batch']);const o=await locked(db,'order',p[0]);if(o.status!=='open')throw Error('Order is not open');if(o.kind!==(cmd==='receive'?'purchase':'sales'))throw Error('Wrong order kind');
  const l=(await db.query('select * from order_lines where order_id=$1 and line_no=$2 for update',[o.id,number(p[1],{positive:true,integer:true})]))[0];if(!l)throw Error('No such order line');
  const qty=number(p[2],{positive:true});if(qty>Number(l.quantity)-Number(l.completed))throw Error('Quantity exceeds the remaining order line');const event=required(f.event,'--event');
  const item=(await db.query('select * from items where id=$1 for update',[l.item_id]))[0];let detail;
  if(cmd==='receive'){
   let batch=null;if(item.batch_managed)batch=(await newBatch(db,item,{code:required(f.batch,`${item.code} is batch managed: --batch`),made:today(),expires:f.expires_on,supplier:o.partner_id,lot:f.supplier_lot||''})).id;else if(f.batch)throw Error(`${item.code} is not batch managed`);
   await move(db,{item:item.id,warehouse:o.warehouse_id,batch,line:l.id,kind:'receipt',quantity:qty,reason:`receive ${o.code}`,event});detail={batch:f.batch||null};
  }else{
   const b=f.batch?(await resolveBatch(db,f.batch,item.id)).id:null;if(f.batch&&!item.batch_managed)throw Error(`${item.code} is not batch managed`);
   detail={batches:(await takeOut(db,item,o.warehouse_id,qty,{batch:b,line:l.id,kind:'delivery',reason:`ship ${o.code}`,event})).map(x=>`${x.batch||'-'} ${x.quantity}`)};
  }
  await db.query('update order_lines set completed=completed+$1 where id=$2',[qty,l.id]);
  const rows=await db.query("update orders set status=case when exists(select 1 from order_lines where order_id=$1 and completed<quantity) then 'open' else 'completed' end where id=$1 returning code,status",[o.id]);
  await audit(db,cmd,o.id,{line:l.line_no,quantity:qty,event,...detail});return rows.map(r=>({...r,...detail}));
 }
 if(cmd==='plan-production'){
  allow(f,['due_on','warehouse','code','for_order']);const i=await resolve(db,'item',p[0]);if(i.kind!=='made')throw Error(`${i.code} is bought in, not made`);
  if(!(await db.query('select id from bom_lines where parent_id=$1',[i.id])).length)throw Error(`${i.code} has no bill of materials; add it with set-bom`);
  const w=f.warehouse?(await resolve(db,'warehouse',f.warehouse)).id:(await db.query('select id from warehouses order by code limit 1'))[0].id;
  const code=f.code||`MO-${Number((await db.query("select coalesce(max(substring(code from 4)::int),0) as n from production_orders where code ~ '^MO-[0-9]+$'"))[0].n)+1}`;
  const forOrder=f.for_order?(await resolve(db,'order',f.for_order)).id:null;
  const rows=await db.query('insert into production_orders(code,item_id,warehouse_id,planned_qty,due_on,for_order_id) values($1,$2,$3,$4,$5,$6) returning code,planned_qty,due_on,status',[code,i.id,w,number(p[1],{positive:true}),date(required(f.due_on,'--due-on')),forOrder]);
  await audit(db,cmd,code,rows[0]);return rows;
 }
 if(['release-production','complete-production','close-production'].includes(cmd)){
  const mo=await locked(db,'production',p[0]);
  if(cmd==='release-production'){allow(f,[]);if(mo.status!=='planned')throw Error('Only a planned production order can be released');const rows=await db.query("update production_orders set status='released' where id=$1 returning code,status",[mo.id]);await audit(db,cmd,mo.id,{});return rows;}
  if(cmd==='close-production'){allow(f,[]);if(!['planned','released'].includes(mo.status))throw Error('Production order is already closed');const why=required(p[1],'Reason');const rows=await db.query(`update production_orders set status=$1 where id=$2 returning code,status,completed_qty,planned_qty`,[Number(mo.completed_qty)>0?'closed':'cancelled',mo.id]);await db.query('insert into activity(record,note) values($1,$2)',[mo.code,`Closed: ${why}`]);await audit(db,cmd,mo.id,{why});return rows;}
  allow(f,['event','batch']);if(mo.status!=='released')throw Error('Release the production order first');const qty=number(p[1],{positive:true});if(round3(Number(mo.completed_qty)+qty)>Number(mo.planned_qty))throw Error('Quantity exceeds what is left on the production order');
  const event=required(f.event,'--event'),item=(await db.query('select * from items where id=$1 for update',[mo.item_id]))[0],used=[];
  for(const b of await db.query('select b.quantity,i.* from bom_lines b join items i on i.id=b.component_id where b.parent_id=$1 order by i.code for update of i',[mo.item_id])){
   const need=round3(qty*Number(b.quantity));const picks=await takeOut(db,b,mo.warehouse_id,need,{production:mo.id,kind:'issue',reason:`issue to ${mo.code}`,event:`${event}:${b.code}`});
   used.push(...picks.map(x=>({component:b.code,batch:x.batch||'',quantity:x.quantity})));
  }
  let batch=null;if(item.batch_managed)batch=(await newBatch(db,item,{code:required(f.batch,`${item.code} is batch managed: --batch`),made:today(),production:mo.id})).id;else if(f.batch)throw Error(`${item.code} is not batch managed`);
  await move(db,{item:item.id,warehouse:mo.warehouse_id,batch,production:mo.id,kind:'output',quantity:qty,reason:`made on ${mo.code}`,event});
  const rows=await db.query("update production_orders set completed_qty=completed_qty+$1,status=case when completed_qty+$1>=planned_qty then 'closed' else status end where id=$2 returning code,status,completed_qty,planned_qty",[qty,mo.id]);
  await audit(db,cmd,mo.id,{quantity:qty,batch:f.batch||null,used,event});return {production_order:rows,components_used:used};
 }
 if(cmd==='transfer'){
  allow(f,['event','batch']);const i=await resolve(db,'item',p[0]),from=await resolve(db,'warehouse',p[1]),to=await resolve(db,'warehouse',p[2]);if(from.id===to.id)throw Error('Pick two different warehouses');
  const qty=number(p[3],{positive:true}),event=required(f.event,'--event');await db.query('select id from items where id=$1 for update',[i.id]);
  const picks=await takeOut(db,i,from.id,qty,{batch:f.batch?(await resolveBatch(db,f.batch,i.id)).id:null,kind:'transfer',reason:`transfer to ${to.code}`,event:`${event}:out`});
  for(const [n,x] of picks.entries())await move(db,{item:i.id,warehouse:to.id,batch:x.batch_id,kind:'transfer',quantity:x.quantity,reason:`transfer from ${from.code}`,event:picks.length>1?`${event}:in:${n+1}`:`${event}:in`});
  await audit(db,cmd,i.id,{from:from.code,to:to.code,quantity:qty,event});return picks.map(x=>({item:i.code,batch:x.batch||'',from:from.code,to:to.code,quantity:x.quantity}));
 }
 if(cmd==='adjust-stock'||cmd==='count'){
  allow(f,['event','batch']);const i=await resolve(db,'item',p[0]),w=await resolve(db,'warehouse',p[1]);const event=required(f.event,'--event');
  if(i.batch_managed&&!f.batch)throw Error(`${i.code} is batch managed: --batch`);if(!i.batch_managed&&f.batch)throw Error(`${i.code} is not batch managed`);
  const b=f.batch?await resolveBatch(db,f.batch,i.id):null;await db.query('select id from items where id=$1 for update',[i.id]);
  const held=Number((await db.query(`select coalesce(sum(quantity),0) as q from stock_moves where item_id=$1 and warehouse_id=$2 ${b?'and batch_id=$3':''}`,b?[i.id,w.id,b.id]:[i.id,w.id]))[0].q);
  let qty,reason;
  if(cmd==='count'){qty=round3(number(p[2])-held);reason=`count: ${p[2]} counted, ${held} on record`;}
  else{qty=Number(p[2]);if(!Number.isFinite(qty)||qty===0)throw Error('Nonzero stock quantity required');reason=required(p[3],'Reason');}
  if(round3(held+qty)<0)throw Error('Insufficient stock');
  if(qty!==0)await move(db,{item:i.id,warehouse:w.id,batch:b?.id??null,kind:cmd==='count'?'count':'adjust',quantity:qty,reason,event});
  if(cmd==='count')await db.query('update items set last_counted_on=current_date where id=$1',[i.id]);
  await audit(db,cmd,i.id,{warehouse:w.code,batch:b?.code??null,difference:qty,event});return [{item:i.code,warehouse:w.code,batch:b?.code??'',on_record:held,difference:qty}];
 }
 if(cmd==='hold-batch'||cmd==='release-batch'){
  allow(f,['item']);const b=await resolveBatch(db,p[0],f.item?(await resolve(db,'item',f.item)).id:null);
  const rows=cmd==='hold-batch'?await db.query('update batches set on_hold=true,hold_reason=$1 where id=$2 returning code,on_hold,hold_reason',[required(p[1],'Hold reason'),b.id]):await db.query("update batches set on_hold=false,hold_reason='' where id=$1 returning code,on_hold",[b.id]);
  await audit(db,cmd,b.id,rows[0]);return rows;
 }
 if(cmd==='mock-recall'){
  allow(f,['item','on']);const b=await resolveBatch(db,p[0],f.item?(await resolve(db,'item',f.item)).id:null);const t=await trace(db,b.id),on=f.on?date(f.on):today();
  await db.query('update settings set last_mock_recall=$1',[on]);
  const summary={batch:b.code,customers:new Set(t.shipped_to.map(r=>r.customer_code)).size,shipped:t.shipped_to.reduce((s,r)=>s+Number(r.quantity),0),still_held:t.still_held.reduce((s,r)=>s+Number(r.on_hand),0),downstream_batches:t.used_in.length,practised_on:on};
  await db.query('insert into activity(record,note) values($1,$2)',[`batch ${b.code}`,`Practice recall: ${summary.customers} customers, ${summary.shipped} shipped, ${summary.still_held} still held`]);await audit(db,cmd,b.id,summary);return [summary];
 }
 if(cmd==='log'){allow(f,[]);const ref=p[0];let rec;try{rec=(await resolve(db,'order',ref)).code;}catch{rec=(await resolve(db,'production',ref)).code;}const rows=await db.query('insert into activity(record,note) values($1,$2) returning *',[rec,required(p[1],'Note')]);await audit(db,cmd,rec,rows[0]);return rows;}
 if(cmd==='invoice-balance'){allow(f,[]);const inv=await locked(db,'invoice',p[0]);const rows=await db.query('update invoices set paid=$1,ledger_ref=$2 where id=$3 returning code,total,paid,ledger_ref',[number(p[1]),required(p[2],'Ledger evidence'),inv.id]);await audit(db,cmd,inv.id,rows[0]);return rows;}
 throw Error(`Unhandled command ${cmd}`);
 });
}
function cell(v){return v instanceof Date?v.toISOString().slice(0,10):v&&typeof v==='object'?JSON.stringify(v):v;}
export function display(value){if(Array.isArray(value)){if(!value.length)return '(none)';const rows=value.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,cell(v)])));return table(rows,Object.keys(rows[0]).map(key=>({key,label:key.replaceAll('_',' '),width:key==='id'?8:60})));}return Object.entries(value).map(([k,v])=>`${k.replaceAll('_',' ').toUpperCase()}\n${display(Array.isArray(v)?v:v?[v]:[])}`).join('\n\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):display(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
