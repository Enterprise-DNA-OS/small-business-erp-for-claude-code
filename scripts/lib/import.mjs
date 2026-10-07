// import sap-business-one: reads CSV files saved from SAP Business One, either Data Transfer
// Workbench style (CardCode, ItemCode, DocNum, LineNum, OpenQty) or the labels on the screens and
// Query Manager exports (BP Code, Item No., Open Qty). Dry run by default; --apply keeps the whole
// batch in one transaction. A file already imported is skipped by its content hash.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCsv,pick} from './csv.mjs';
import {resolve,number,date,audit} from './domain.mjs';
export const types=['business-partners','items','bom','stock','batches','sales-orders','sales-lines','purchase-orders','purchase-lines'];
const YES=/^(tyes|y|yes|true|1)$/i;
const CLOSED=/^(c|closed|bost_close|cancell?ed|canceled|inactive|frozen)$/i;
function amount(v,fallback='0'){const s=String(v||fallback).replaceAll(',','').replace(/^\$/,'').trim();if(!/^-?\d+(\.\d+)?$/.test(s))throw Error(`Invalid amount ${v}`);return String(number(s));}
function day(v,order){
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return date(v);
 if(/^\d{8}$/.test(v||''))return date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6)}`);
 const m=/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v||'');if(!m)throw Error(`Invalid date ${v}`);
 if(!['dmy','mdy'].includes(order))throw Error('Dates like 03/04/2026 need --date-order=dmy (NZ and AU) or mdy');
 const [d,mo]=order==='dmy'?[m[1],m[2]]:[m[2],m[1]];return date(`${m[3]}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`);
}
function inactive(row){return YES.test(pick(row,'Frozen','Inactive'))||/^(tno|n|no)$/i.test(pick(row,'Valid','Active'))||CLOSED.test(pick(row,'Status','DocStatus','Document Status'))||YES.test(pick(row,'Cancelled','CANCELED'));}
async function existing(db,table,code){return (await db.query(`select * from ${table} where lower(code)=lower($1)`,[code]))[0];}
async function insert(db,table,vals){const k=Object.keys(vals);return (await db.query(`insert into ${table}(${k.join(',')}) values(${k.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,Object.values(vals)))[0];}
async function warehouseFor(db,row,f){const w=pick(row,'WhsCode','WarehouseCode','Warehouse','Whse')||f.warehouse;if(!w)throw Error('No warehouse column; pass --warehouse=<code>');return (await resolve(db,'warehouse',w)).id;}
function lineNo(row){const zero=pick(row,'LineNum');if(zero!=='')return number(zero,{integer:true})+1;return number(pick(row,'Row','Line','#','Line No.'),{positive:true,integer:true});}
async function one(db,type,row,f,key){
 const o=f.date_order;
 if(type==='business-partners'){
  const code=pick(row,'CardCode','BP Code'),name=pick(row,'CardName','BP Name'),t=pick(row,'CardType','BP Type');
  if(!code||!name)throw Error('CardCode and CardName are required');
  const kind=/^(ccustomer|c|customer)$/i.test(t)?'customer':/^(csupplier|s|supplier|vendor)$/i.test(t)?'supplier':/^(clid|l|lead)$/i.test(t)?'lead':null;
  if(!kind)throw Error(`Unknown CardType ${t}: expected cCustomer, cSupplier or cLid`);if(kind==='lead'||inactive(row))return 'skipped';
  const old=await existing(db,'partners',code);if(old){if(old.name!==name||old.kind!==kind)throw Error(`${code} already exists with different source data; reconcile it first`);return 'existing';}
  await insert(db,'partners',{code,kind,name,email:pick(row,'EmailAddress','E-Mail','Email'),phone:pick(row,'Phone1','Telephone 1','Phone'),address:[pick(row,'Address','BillToStreet','Street'),pick(row,'City')].filter(Boolean).join(', '),
   tax_id:pick(row,'FederalTaxID','Federal Tax ID','Tax ID','ABN','NZBN'),credit_limit:amount(pick(row,'CreditLimit','Credit Limit')),lead_days:String(number(pick(row,'Lead Time','LeadTime')||'7',{integer:true})),source_data:row});return 'inserted';
 }
 if(type==='items'){
  const code=pick(row,'ItemCode','Item No.'),name=pick(row,'ItemName','Item Description');if(!code||!name)throw Error('ItemCode and ItemName are required');if(inactive(row))return 'skipped';
  const old=await existing(db,'items',code);if(old){if(old.name!==name)throw Error(`${code} already exists with different source data; reconcile it first`);return 'existing';}
  const vendor=pick(row,'Mainsupplier','Preferred Vendor'),shelf=pick(row,'Shelf Life (Days)','U_ShelfLife');
  await insert(db,'items',{code,name,uom:pick(row,'InventoryUOM','Inventory UoM','UoM')||'EA',kind:/^(m|make|bom_make)$/i.test(pick(row,'ProcurementMethod','Procurement Method'))?'made':'purchased',
   batch_managed:YES.test(pick(row,'ManageBatchNumbers','Manage Batch No.')),shelf_life_days:shelf?String(number(shelf,{positive:true,integer:true})):null,
   unit_cost:amount(pick(row,'AvgStdPrice','Item Cost','Last Purchase Price')),unit_price:amount(pick(row,'Price','Unit Price')),reorder_point:amount(pick(row,'MinInventory','Minimum Inventory','Required (Purchasing UoM)')),
   order_multiple:Number(amount(pick(row,'OrderMultiple','Order Multiple'),'1'))>0?amount(pick(row,'OrderMultiple','Order Multiple'),'1'):'1',
   supplier_id:vendor?(await resolve(db,'supplier',vendor)).id:null,make_days:String(number(pick(row,'LeadTime','Lead Time')||'2',{integer:true})),source_data:row});return 'inserted';
 }
 if(type==='bom'){
  const parent=pick(row,'TreeCode','Father','Parent Item','Product No.'),comp=pick(row,'ItemCode','Code','Component','Item No.');if(!parent||!comp)throw Error('TreeCode and ItemCode are required');
  const per=Number(amount(pick(row,'Quantity'),'0'))/Number(amount(pick(row,'Parent Quantity','PlanAvgProdSize','Father Quantity'),'1'));if(!(per>0))throw Error('Quantity must be above zero');
  const p=await resolve(db,'item',parent),c=await resolve(db,'item',comp);if(p.kind!=='made')throw Error(`${p.code} is not set to Make; set its procurement method first`);
  const old=(await db.query('select * from bom_lines where parent_id=$1 and component_id=$2',[p.id,c.id]))[0];
  if(old){if(Math.abs(Number(old.quantity)-per)>1e-6)throw Error(`${p.code}/${c.code} already exists with a different quantity`);return 'existing';}
  await insert(db,'bom_lines',{parent_id:p.id,component_id:c.id,quantity:String(Math.round(per*10000)/10000)});return 'inserted';
 }
 if(type==='stock'||type==='batches'){
  const item=await resolve(db,'item',pick(row,'ItemCode','Item No.')),wh=await warehouseFor(db,row,f),qty=Number(amount(pick(row,'Quantity','OnHand','In Stock')));if(qty===0)return 'skipped';if(qty<0)throw Error('Opening stock cannot be negative');
  let batch=null;
  if(type==='batches'){
   if(!item.batch_managed)throw Error(`${item.code} is not batch managed`);const code=pick(row,'BatchNumber','DistNumber','Batch','Batch Number');if(!code)throw Error('BatchNumber is required');
   const made=pick(row,'MnfDate','ManufacturingDate','Manufacturing Date','InDate','Admission Date'),exp=pick(row,'ExpDate','ExpirationDate','Expiration Date');
   const old=(await db.query('select id from batches where item_id=$1 and lower(code)=lower($2)',[item.id,code]))[0];
   batch=old?old.id:(await insert(db,'batches',{item_id:item.id,code,made_on:made?day(made,o):new Date().toISOString().slice(0,10),expires_on:exp?day(exp,o):null,supplier_lot:pick(row,'MnfSerial','Batch Attribute 1','Supplier Lot')})).id;
  }else if(item.batch_managed)throw Error(`${item.code} is batch managed; import it with the batches file`);
  const event=`import:${key}`;if((await db.query('select id from stock_moves where event_key=$1',[event])).length)return 'existing';
  await insert(db,'stock_moves',{item_id:item.id,warehouse_id:wh,batch_id:batch,kind:'opening',quantity:String(qty),reason:'Opening stock from SAP Business One',event_key:event});return 'inserted';
 }
 if(type==='sales-orders'||type==='purchase-orders'){
  const kind=type==='sales-orders'?'sales':'purchase',code=pick(row,'DocNum','Doc. No.','Document Number'),who=pick(row,'CardCode','BP Code',kind==='sales'?'Customer Code':'Vendor Code');
  if(!code||!who)throw Error('DocNum and CardCode are required');if(inactive(row))return 'skipped';
  const prefix=kind==='sales'?'SO-':'PO-',full=/^\d+$/.test(code)?prefix+code:code;if(await existing(db,'orders',full))return 'existing';
  await insert(db,'orders',{code:full,kind,partner_id:(await resolve(db,kind==='sales'?'customer':'supplier',who)).id,warehouse_id:await warehouseFor(db,row,f),status:'draft',
   due_on:day(pick(row,'DocDueDate','Delivery Date','Due Date','DocDate'),o),reference:pick(row,'NumAtCard','Customer Ref. No.','Vendor Ref. No.'),source_data:row});return 'inserted';
 }
 const kind=type==='sales-lines'?'sales':'purchase',doc=pick(row,'DocNum','ParentKey','Doc. No.'),itemCode=pick(row,'ItemCode','Item No.');if(!doc||!itemCode)throw Error('DocNum and ItemCode are required');
 const ord=await resolve(db,'order',/^\d+$/.test(doc)?(kind==='sales'?'SO-':'PO-')+doc:doc);if(ord.kind!==kind||ord.status!=='draft')throw Error('Lines import into matching draft orders only');
 if(CLOSED.test(pick(row,'LineStatus','Row Status')))return 'skipped';
 const qty=amount(pick(row,'OpenQty','Open Qty','Remaining Open Quantity','Quantity'));if(Number(qty)===0)return 'skipped';
 const it=await resolve(db,'item',itemCode),uom=pick(row,'UoMCode','UoM Code','UoM');if(uom&&uom.toLowerCase()!==it.uom.toLowerCase())throw Error(`Unit ${uom} differs from ${it.code}'s inventory unit ${it.uom}; convert first`);
 const whs=pick(row,'WarehouseCode','WhsCode','Whse');if(whs&&(await resolve(db,'warehouse',whs)).id!==ord.warehouse_id)throw Error(`Line warehouse ${whs} differs from the order's; split the order by warehouse`);
 const no=lineNo(row),price=amount(pick(row,'Price','Price after Discount','Unit Price'));
 const old=(await db.query('select * from order_lines where order_id=$1 and line_no=$2',[ord.id,no]))[0];
 if(old){if(old.item_id!==it.id||Number(old.quantity)!==Number(qty))throw Error('Existing line differs; reconcile it first');return 'existing';}
 await insert(db,'order_lines',{order_id:ord.id,line_no:no,item_id:it.id,quantity:qty,unit_price:price,unit_cost:it.unit_cost});return 'inserted';
}
export async function importSapB1(db,type,file,f){
 if(type!=='bundle'&&!types.includes(type))throw Error(`Import type must be bundle or one of ${types.join(', ')}`);if(!file)throw Error('CSV file or bundle folder required');
 if(f.date_order&&!['dmy','mdy'].includes(f.date_order))throw Error('date-order must be dmy or mdy');
 const files=type==='bundle'?types.map(t=>({type:t,file:path.join(file,`${t}.csv`)})).filter(x=>fs.existsSync(x.file)):[{type,file}];if(!files.length)throw Error('No supported CSV files in the bundle folder');
 const result=[];await db.exec('BEGIN');
 try{
  for(const input of files){
   const raw=fs.readFileSync(input.file,'utf8'),digest=createHash('sha256').update(raw).digest('hex'),rows=parseCsv(raw);if(!rows.length)throw Error(`Empty CSV ${input.file}`);
   const name=`${input.type}:${digest}:${f.warehouse||''}:${f.date_order||''}`;
   if((await db.query('select id from import_batches where name=$1',[name])).length){result.push({type:input.type,mode:f.apply?'apply':'dry-run',inserted:0,existing:rows.length,skipped:0});continue;}
   const n={inserted:0,existing:0,skipped:0};
   for(let i=0;i<rows.length;i++){try{n[await one(db,input.type,rows[i],f,`${digest.slice(0,16)}:${i}`)]++;}catch(e){throw Error(`${path.basename(input.file)} row ${i+2}: ${e.message}`);}}
   await db.query('insert into import_batches(name,entity,digest,row_count,source_file) values($1,$2,$3,$4,$5)',[name,input.type,digest,rows.length,path.basename(input.file)]);
   result.push({type:input.type,mode:f.apply?'apply':'dry-run',...n});
  }
  if(f.apply){await audit(db,'import sap-business-one',null,{files:files.map(x=>path.basename(x.file)),result});await db.exec('COMMIT');}else await db.exec('ROLLBACK');
  return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
