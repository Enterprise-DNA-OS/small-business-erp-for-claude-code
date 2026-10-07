// npm test: temporary database (or an empty TEST_DATABASE_URL), migrate, seed, run every CLI command, check the numbers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,actions,composites} from './erp.mjs';
import {reports,resolve} from './lib/domain.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'small-business-erp-test-'));
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';process.env.DATA_DIR=path.join(dir,'db');process.env.OUTPUT_DIR=dir;
let db,checks=0;const seen=new Set();
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const ok=v=>{assert.ok(v);checks++;};
const call=async(...args)=>{seen.add(args[0]);return run(db,args);};const reject=async(args,re)=>{seen.add(args[0]);await assert.rejects(()=>run(db,args),re);checks++;};
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const find=(rows,k,v)=>rows.find(r=>r[k]===v);
const stock=async(code,wh)=>(await call('stock')).find(r=>r.code===code&&r.warehouse===wh);
try{
 db=await getDb();if(process.env.TEST_DATABASE_URL){const rows=await db.query("select tablename from pg_tables where schemaname='public'");assert.equal(rows.length,0,'TEST_DATABASE_URL must point to an empty disposable database');}
 await assert.rejects(()=>migrate({...db,exec:async sql=>{await db.exec(sql);if(sql.includes('CREATE TABLE partners'))throw Error('Migration rollback test');}}),/rollback/);checks++;
 eq((await db.query("select to_regclass('partners') as name"))[0].name,null);
 eq((await migrate(db)).ran.length,1);eq((await migrate(db)).ran.length,0);
 await reject(['add','warehouse','--code=X','--name=X'],/Run setup/);
 await seed(db);await seed(db);eq((await call('items')).length,9);eq((await call('customers')).length,4);eq((await call('suppliers')).length,4);eq((await call('bom')).length,12);
 for(const name of Object.keys(reports))ok(Array.isArray(await call(name)));
 ok((await call('help'))[0].writes.includes('complete-production'));

 // The demo tells a story: a late order short of sauce, a production run short of bottles,
 // two orders waiting for approval, a quote gone quiet and a paste lot about to expire.
 const att=await call('attention');ok(find(att,'code','SO-1001').reason.includes('overdue'));ok(find(att,'code','SO-1003').reason.includes('credit'));
 ok(find(att,'code','MO-501').reason.includes('short'));ok(find(att,'code','QT-3001').reason.includes('no reply'));ok(att.some(r=>r.record==='batch'&&r.code.startsWith('PT-2405')));
 eq(find(await call('ship-plan'),'item','TS-300').short,'250.000');
 eq(find(await call('can-make'),'component','BOT-300').short,'100.000');
 const mrp=await call('mrp');eq(mrp.map(r=>[r.code,r.suggested,r.timing]),[['TOM-PASTE','100.000','late'],['SUGAR','150.000','late'],['LBL-BBQ','2500.000','today']]);
 eq((await call('credit-check'))[0].over_by,'1220.00');eq((await call('approvals')).map(r=>r.code),['SO-1004','SO-1003']);
 eq((await call('quotes-follow-up'))[0].code,'QT-3001');eq((await call('expiring'))[0].batch,'PT-2405');
 eq((await stock('BBQ-300','HAM')).blocked,'60.000');eq(find(await call('margins'),'customer','Waikato Wholesale Grocers').shipped_margin,'1260.00');
 eq((await call('count-due')).map(r=>r.code),['LBL-BBQ','LBL-TS','SUGAR']);
 eq(find(await call('receivables'),'code','INV-2002').age,'1-30');
 eq(Object.keys(await call('weekly-review')),['attention','ship_plan','mrp']);
 eq(Object.keys(await call('month-end')),['receivables','credit_check','approvals','expiring','count_due','supplier_chase']);
 eq((await call('order','so-1001')).order.partner,'Waikato Wholesale Grocers');eq((await call('item','TS-300')).made_from.length,6);
 await assert.rejects(()=>resolve(db,'customer','N'),/Candidates:/);checks++;
 eq((await resolve(db,'customer',(await resolve(db,'customer','C100')).id.slice(0,8))).code,'C100');
 await assert.rejects(()=>resolve(db,'customer','S100'),/No match/);checks++;

 // Recall trace: one step back to the supplier lot, forward through production to customers.
 const tr=await call('trace','PT-2405');eq(tr.batch.supplier_lot,'PTP-88123');eq(tr.used_in[0].output_batch,'TS-0915');
 eq(tr.shipped_to.map(r=>[r.customer_code,r.quantity]),[['C100','600.000'],['C200','250.000']]);eq(tr.still_held.length,2);
 eq((await call('trace','TS-0915')).made_from.length,3);

 // Record checks with sources, then fixed one by one.
 const rules=(await call('compliance')).map(r=>r.rule);
 for(const r of ['RETENTION_POLICY','SOURCE_EVIDENCE','RETAIN_UNTIL','SELLER_TAX_NUMBER','BUYER_DETAILS','PPSR_REGISTRATION','RECALL_PLAN','MOCK_RECALL','SUPPLIER_LOT','BACKUP_REVIEW'])ok(rules.includes(r));

 // Approvals: a low-margin order waits, a manager approves, it opens.
 await reject(['approve','SO-1004'],/--by is required/);await call('approve','SO-1004','--by=Mere Tane');eq((await call('order','SO-1004')).order.status,'open');
 await reject(['approve','SO-1004','--by=x'],/not waiting/);await call('reject','SO-1003','Wait for INV-2003 to be paid');eq((await call('order','SO-1003')).order.approval,'rejected');
 await call('add','order','--code=SO-NEW','--kind=sales','--partner-id=C200','--warehouse-id=HAM','--due-on='+day(5));
 await reject(['release','SO-NEW'],/no lines/);await call('line','SO-NEW','TS-300','10','2.00','1');
 eq((await call('release','SO-NEW'))[0].approval,'pending');await call('cancel-order','SO-NEW','Price agreed by phone instead');
 await call('add','order','--code=SO-OK','--kind=sales','--partner-id=C100','--warehouse-id=HAM','--due-on='+day(5));await call('line','SO-OK','TS-300','10','4.20','1');
 eq((await call('release','SO-OK'))[0].status,'open');await reject(['line','SO-OK','TS-300','1','4.20','2'],/draft/);
 await reject(['add','order','--code=BAD','--kind=sales','--partner-id=S100','--warehouse-id=HAM','--due-on='+day(1)],/No match for customer/);
 await reject(['add','order','--code=BAD','--kind=sales','--partner-id=C100','--warehouse-id=HAM','--due-on=2026-02-30'],/Invalid ISO/);
 await reject(['add','customer','--code=X','--name=X','--extra=y'],/Unknown option/);

 // Quotes: win one into a sales order, lose another.
 await reject(['win-quote','SO-OK'],/open quote/);
 eq((await call('win-quote','QT-3001'))[0].sales_order,'SO-3001');eq((await call('order','SO-3001')).lines.length,2);eq((await call('order','QT-3001')).order.status,'won');
 await call('lose-quote','QT-3002','Went with a cheaper supplier');await reject(['lose-quote','QT-3002','again'],/open quote/);
 await reject(['cancel-order','QT-3002','x'],/lose-quote/);

 // Shipping picks the earliest usable batch and never a held one.
 await reject(['ship','SO-1001','2','10','--event=BBQ-1'],/Insufficient usable/);
 await reject(['ship','SO-1001','2','10','--event=X','--batch=BB-0630'],/on hold/);
 await call('ship','SO-1001','1','150','--event=DISPATCH-1');eq((await stock('TS-300','HAM')).on_hand,'0.000');
 await reject(['ship','SO-1001','1','1','--event=DISPATCH-1'],/Insufficient|unique|duplicate/i);
 await reject(['receive','SO-1001','1','1','--event=WRONG'],/Wrong order kind/);
 await call('release-batch','BB-0630');await call('ship','SO-1001','2','60','--event=DISPATCH-2','--batch=BB-0630');
 await call('hold-batch','BB-0702','Label misprint check');await reject(['transfer','BBQ-300','AKL','HAM','10','--event=TR-1'],/Insufficient usable/);
 await call('release-batch','BB-0702');await call('transfer','BBQ-300','AKL','HAM','40','--event=TR-1');await reject(['transfer','BBQ-300','AKL','HAM','1','--event=TR-1'],/unique|duplicate/i);
 await reject(['transfer','BBQ-300','AKL','AKL','1','--event=TR-2'],/different/);
 eq((await stock('BBQ-300','HAM')).on_hand,'40.000');await call('ship','SO-1001','2','40','--event=DISPATCH-3');
 eq((await call('order','SO-1001')).batches.map(r=>r.batch),['BB-0630','BB-0702','TS-0915']);

 // Receiving: bottles arrive, batch-managed paste needs a lot.
 await call('receive','PO-2001','1','200','--event=GR-1');eq(find(await call('can-make'),'component','BOT-300').short,'0.000');
 await reject(['receive','PO-2001','1','99999','--event=GR-2'],/remaining/);await reject(['receive','PO-2001','1','1','--event=GR-3','--batch=X'],/not batch managed/);
 await call('add','order','--code=PO-NEW','--kind=purchase','--partner-id=S100','--warehouse-id=HAM','--due-on='+day(21));await call('line','PO-NEW','TOM-PASTE','100','4.20','1');await call('release','PO-NEW');
 await reject(['receive','PO-NEW','1','100','--event=GR-4'],/--batch/);
 await call('receive','PO-NEW','1','100','--event=GR-4','--batch=PT-2501','--supplier-lot=PTP-91002');
 eq(find(await call('batches'),'batch','PT-2501').expires_on,day(365));eq((await call('order','PO-NEW')).order.status,'completed');
 await reject(['cancel-order','PO-2001','x'],/partly/);

 // Production: release, make a part run, components leave first expiry first, a new batch arrives.
 await reject(['complete-production','MO-502','10','--event=MK-0','--batch=B'],/Release/);
 await call('complete-production','MO-501','400','--event=MK-1','--batch=TS-1007').catch(e=>{throw e;});
 const tom=(await call('movements')).filter(r=>r.event_key.startsWith('MK-1:TOM-PASTE'));eq(tom.map(r=>[r.batch,r.quantity]),[['PT-2405','-40.000'],['PT-2409','-8.000']]);
 eq((await stock('TS-300','HAM')).on_hand,'400.000');eq((await call('production-orders')).find(r=>r.code==='MO-501').remaining,'600.000');
 await reject(['complete-production','MO-501','601','--event=MK-2','--batch=TS-1008'],/left/);
 await reject(['complete-production','MO-501','10','--event=MK-3'],/--batch/);
 const back=await call('trace','PT-2405');ok(back.used_in.some(r=>r.output_batch==='TS-1007'));
 await call('plan-production','BBQ-300','100','--due-on='+day(4),'--for-order=SO-1002');eq((await call('production-orders')).find(r=>r.code==='MO-503').status,'planned');
 await reject(['plan-production','SUGAR','10','--due-on='+day(1)],/bought in/);
 await call('release-production','MO-503');await reject(['release-production','MO-503'],/Only a planned/);
 await call('close-production','MO-503','Covered from Auckland stock');eq((await call('production-orders')).find(r=>r.code==='MO-503').status,'cancelled');
 await call('set-bom','BBQ-300','SUGAR','0.07');eq(find((await call('item','BBQ-300')).made_from,'code','SUGAR').quantity,'0.0700');
 await reject(['set-bom','SUGAR','TOM-PASTE','1'],/purchased/);

 // Counts and adjustments.
 await call('count','SUGAR','HAM','16','--event=CNT-1','--batch=SG-0820');ok(!(await call('count-due')).some(r=>r.code==='SUGAR'));
 eq(find(await call('movements'),'event_key','CNT-1').quantity,'-2.000');
 await reject(['count','SUGAR','HAM','28','--event=CNT-2'],/--batch/);
 await call('adjust-stock','LBL-TS','HAM','-25','Water damage','--event=ADJ-1');await reject(['adjust-stock','LBL-TS','HAM','-99999','x','--event=ADJ-2'],/Insufficient/);
 await call('set','item','LBL-TS','--reorder-point=1800');await reject(['set','item','LBL-TS','--on-hand=9'],/Unknown option/);
 await call('set','customer','C200','--email=hello@raglancafe.example','--ppsr-ref=Financing statement FS-DEMO-0002');
 await call('log','SO-1002','Customer confirmed a Thursday delivery window');ok((await call('order','SO-1002')).activity[0].note.includes('Thursday'));
 await call('log','MO-501','Bottle delivery split, second half Friday');
 await call('invoice-balance','INV-2002','1207.50','Remittance 5531');ok(!find(await call('receivables'),'code','INV-2002'));
 await reject(['invoice-balance','INV-2003','99999','bad'],/check constraint|violates/);

 // Practice recall, then fix the findings and the checks go quiet.
 eq((await call('mock-recall','PT-2405'))[0].customers,2);
 await call('setup','--name=Rimu Foods Demo','--tax-number=123-456-789','--retention-years=7','--recall-plan-ref=Recall procedure v3, QA binder','--last-backup='+day(0),'--backup-ref=Verified backup 31');
 await reject(['setup','--name=X','--country=AU','--currency=AUD'],/fixed/);
 await call('set','record','Batch TS-0915','--source-ref=Archive MO-480','--retain-until='+day(365*12));
 await db.query("update batches set supplier_lot='SC-2208' where code='SG-0820'");
 eq(await call('compliance'),[]);
 await db.query("update settings set country='AU',currency='AUD',retention_years=5,recall_plan_ref=''");
 const au=await call('compliance');ok(au.some(r=>r.rule==='RECALL_PLAN'&&r.finding.includes('clause 12')));
 await db.query("update settings set country='NZ',currency='NZD',retention_years=7,recall_plan_ref='Recall procedure v3'");

 // Drafts never send.
 for(const [cmd,ref] of [['draft-order','SO-1002'],['draft-chase','PO-2002'],['draft-statement','C100'],['draft-quote','QT-3002']]){const text=fs.readFileSync((await call(cmd,ref))[0].file,'utf8');ok(text.startsWith('# DRAFT'));ok(text.includes('Nothing has been sent'));}
 const recall=await call('draft-recall','TS-0915','--reason=a supplier reported a labelling fault');eq(recall.length,2);ok(fs.readFileSync(recall[0].file,'utf8').includes('labelling fault'));
 await reject(['draft-recall','PT-2501','--reason=x'],/reached a customer/);await reject(['draft-chase','SO-1002'],/purchase order/);

 // Import a SAP Business One export bundle: dry run, apply, repeat, bad rows roll back.
 const fixture=path.join(REPO_ROOT,'fixtures/sap-business-one');
 await reject(['import','sap-business-one','bundle',fixture],/date-order/);
 const preview=await call('import','sap-business-one','bundle',fixture,'--date-order=dmy');eq(preview.length,9);await reject(['order','SO-7001'],/No match/);
 const applied=await call('import','sap-business-one','bundle',fixture,'--date-order=dmy','--apply');eq(applied.reduce((s,r)=>s+r.inserted,0),11);eq(applied.reduce((s,r)=>s+r.skipped,0),6);
 eq((await call('import','sap-business-one','bundle',fixture,'--date-order=dmy','--apply')).reduce((s,r)=>s+r.inserted,0),0);
 eq((await resolve(db,'customer','IMP-C1')).credit_limit,'12000.00');eq((await resolve(db,'item','IMP-I1')).kind,'made');
 eq((await call('order','SO-7001')).order.due_on,'2026-10-20');eq((await call('order','SO-7001')).lines[0].quantity,'80.000');eq((await call('order','PO-8001')).order.due_on,'2026-10-15');
 eq(find((await call('item','IMP-I1')).made_from,'code','IMP-I2').quantity,'1.0000');eq(find(await call('batches'),'batch','CH-0901').expires_on,'2027-09-01');
 const bad=path.join(dir,'bad.csv');fs.writeFileSync(bad,'CardCode,CardName,CardType\nROLLBACK,Valid first,cCustomer\n,Bad second,cCustomer\n');
 await reject(['import','sap-business-one','business-partners',bad,'--apply'],/row 3/);eq((await db.query("select * from partners where code='ROLLBACK'")).length,0);
 fs.writeFileSync(bad,'CardCode,CardName,CardType\nIMP-C1,Changed name,cCustomer\n');await reject(['import','sap-business-one','business-partners',bad,'--apply'],/different source data/);
 fs.writeFileSync(bad,'CardCode,CardName\nQ,"unterminated\n');await reject(['import','sap-business-one','business-partners',bad],/unclosed/);
 fs.writeFileSync(bad,'DocNum,LineNum,ItemCode,OpenQty,Price,UoMCode\n7001,5,IMP-I1,1,10,BOX\n');await reject(['import','sap-business-one','sales-lines',bad],/inventory unit/);

 const exp=path.join(dir,'export.json');await call('export',exp);const snap=JSON.parse(fs.readFileSync(exp));eq(Object.keys(snap.records).length,15);ok(snap.records.audit.length>30);await reject(['export',exp],/exist/);
 const missed=[...Object.keys(reports),...composites,...actions].filter(c=>!seen.has(c));eq(missed,[]);
 await db.close();db=null;
 for(const script of ['docs','view']){const res=spawnSync(process.execPath,[`scripts/${script}.mjs`],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});if(res.status)console.error(res.stderr);eq(res.status,0);}
 ok(fs.readFileSync(path.join(dir,'views/week.html'),'utf8').includes('Rimu Foods Demo'));
 for(const d of ['sales-confirmation','purchase-order','production-sheet','batch-trace','customer-statement'])ok(fs.readdirSync(path.join(dir,'docs-out',d)).length>0);
 const amb=spawnSync(process.execPath,['scripts/erp.mjs','order','SO-10','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(amb.status,1);ok(amb.stderr.includes('Candidates:'));
 const json=spawnSync(process.execPath,['scripts/erp.mjs','warehouses','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(json.status,0);eq(JSON.parse(json.stdout).length,2);
 const recipes=fs.readdirSync(path.join(REPO_ROOT,'.claude/commands')).filter(f=>f.endsWith('.md')&&f!=='README.md');
 for(const c of [...Object.keys(reports),...composites,...actions])ok(recipes.includes(`${c}.md`));
 console.log(`PASS: ${checks} assertions; ${seen.size} CLI commands exercised; ${recipes.length} slash commands; documents and views rendered.`);
}finally{await db?.close();fs.rmSync(dir,{recursive:true,force:true});}
