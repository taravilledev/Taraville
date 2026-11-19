import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localEnvironment } from './dev-local.mjs';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }));
const local = localEnvironment(status);
assert.equal(new URL(local.NEXT_PUBLIC_SUPABASE_URL).port, '54321');
const auth = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false}});
const login = await auth.auth.signInWithPassword({email:'admin@staff.taraville.invalid',password:'test1234'});
assert.equal(login.error,null);
const actor = login.data.user.id;
const token = login.data.session.access_token;
const headers = {apikey:local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization:'Bearer '+token,'Content-Type':'application/json'};
function sql(query) {
  return execFileSync('docker',['exec','supabase_db_Taraville_pj','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',query],
    {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
async function rpc(name,input,expected=200) {
  const response=await fetch(local.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(input)});
  const body=await response.json();
  assert.equal(response.status,expected, name+': '+JSON.stringify(body));
  return body;
}
const lead=randomUUID();
sql("insert into public.leads(id,brand,first_name,last_name,phone,owner_id,created_by,create_request_id,create_payload_hash,privacy_mode) values('"+lead+"','BAAN_KUNAPAP','Synthetic Demo','Flow','0000000000','"+actor+"','"+actor+"','"+randomUUID()+"',repeat('0',64),'synthetic')");
const project=await rpc('walkin_open_project',{p_lead_id:lead,p_expected_version:1,p_request_id:randomUUID()});
let job=await rpc('sales_create_case',{p_lead_id:lead,p_project_id:project.id,p_unit_id:null,p_customer_id:null,p_request_id:randomUUID()});
const id=job.id;
job=await rpc('sales_save_design_plan',{p_case_id:id,p_version:job.version,p_input:{tier:'under150',usable_area:'120'},p_request_id:randomUUID()});
const detail=()=>rpc('sales_case_detail',{p_case_id:id});
const documents=()=>rpc('sales_agreement_detail',{p_case_id:id});
const house={model:'Synthetic house',stories:'2',bedrooms:'3',kitchens:'1',bathrooms:'2',usable_area:'175.5'};
const input={house,total_cents:null,spec_rows:[{item:'Structure',detail:'Synthetic specification',note:''}],exclusions:['Synthetic exclusion']};
const offer=async value=> {
 const current=await detail();
 return rpc('sales_issue_quotation',{p_case_id:id,p_version:current.version,p_input:value,p_request_id:randomUUID()});
};
const estimate=await offer(input);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=','base64');
const proof=id+'/agreement/'+randomUUID()+'.png';
const uploaded=await fetch(local.NEXT_PUBLIC_SUPABASE_URL+'/storage/v1/object/sales-evidence/'+proof,{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:png});
assert.equal(uploaded.status,200,await uploaded.text());
await rpc('sales_accept_quotation',{p_document_id:estimate.document_id,p_version:estimate.version,p_evidence_path:proof,p_request_id:randomUUID()},400);
assert.equal((await detail()).net_price_cents,null,'Estimate must not set price');
const q1=await offer({...input,total_cents:'10000001'});
let current=await rpc('sales_accept_quotation',{p_document_id:q1.document_id,p_version:q1.version,p_evidence_path:proof,p_request_id:randomUUID()});
const schedule=[1000,1800,1800,1800,1800,1800].map((basis_points,index)=>({basis_points,label:'Instalment '+index,progress_percent:index===0?null:index*20,work_description:'Synthetic work'}));
const contractInput={customer:{full_name:'Synthetic signer',phone:'0000000000',site_address:'Synthetic site'},start_date:'2026-11-08',schedule};
const draftArgs={p_case_id:id,p_version:current.version,p_quotation_id:q1.document_id,p_input:contractInput,p_document_id:null,p_document_version:null,p_request_id:randomUUID()};
let draft=await rpc('sales_save_contract_draft',draftArgs);
assert.deepEqual(await rpc('sales_save_contract_draft',draftArgs),draft,'Replay returns same draft');
let docs=await documents();
let doc=docs.documents.find(d=>d.id===draft.document_id);
assert.equal(doc.number,null);assert.equal(doc.state,'draft');assert.equal(docs.instalments.length,0);
assert.equal((await detail()).net_price_cents,'10000001');
await rpc('sales_save_contract_draft',{...draftArgs,p_version:draft.version,p_request_id:randomUUID()},400);
const q2=await offer({...input,total_cents:'20000001'});
current=await rpc('sales_accept_quotation',{p_document_id:q2.document_id,p_version:q2.version,p_evidence_path:proof,p_request_id:randomUUID()});
assert.equal((await detail()).net_price_cents,'10000001','Acceptance cannot rebind live draft');
draft=await rpc('sales_save_contract_draft',{...draftArgs,p_version:current.version,p_quotation_id:q2.document_id,p_document_id:doc.id,p_document_version:doc.version,p_request_id:randomUUID()});
assert.equal((await detail()).net_price_cents,'20000001');
docs=await documents();doc=docs.documents.find(d=>d.id===draft.document_id);
assert.equal(doc.parent_id,q2.document_id);
current=await detail();
await rpc('sales_save_case',{p_case_id:id,p_expected_version:current.version,p_input:{customer_snapshot:current.customer_snapshot,details:current.details,list_price_cents:'1',promotion_price_cents:null,discount_cents:'0'},p_request_id:randomUUID()},400);
const lockArgs={p_document_id:doc.id,p_version:current.version,p_document_version:doc.version,p_request_id:randomUUID()};
const locks=await Promise.all([rpc('sales_lock_contract',lockArgs),rpc('sales_lock_contract',lockArgs)]);
assert.deepEqual(locks[0],locks[1],'Concurrent replay issues one number');
let locked=locks[0];assert.ok(locked.number);
await rpc('sales_sign_contract',{p_document_id:doc.id,p_version:current.version,p_evidence_path:proof,p_request_id:randomUUID()},409);
const reopened=await rpc('sales_unlock_contract',{p_document_id:doc.id,p_version:locked.version,p_document_version:locked.document_version,p_reason:'Synthetic edit',p_request_id:randomUUID()});
docs=await documents();assert.equal(docs.documents.find(d=>d.id===doc.id).state,'cancelled');
doc=docs.documents.find(d=>d.id===reopened.document_id);
assert.equal(doc.state,'draft');assert.equal(doc.number,null);assert.equal(doc.payload.replaces_document_id,locked.document_id);
locked=await rpc('sales_lock_contract',{p_document_id:doc.id,p_version:reopened.version,p_document_version:doc.version,p_request_id:randomUUID()});
assert.notEqual(locked.number,locks[0].number,'Relock creates new number');
const prepared=await rpc('sales_prepare_payment',{p_case_id:id,p_version:locked.version,p_input:{
 kind:'design_fee',amount_cents:'100',method:'cash',paid_date:'2026-11-08',payer_name:'Synthetic payer',description:'Synthetic later payment'
},p_request_id:randomUUID()});
const payment=await rpc('sales_confirm_payment',{p_payment_request_id:prepared.payment_request_id,p_version:prepared.version,p_funds_confirmed:true,p_request_id:randomUUID()});
const staleCredit=await rpc('sales_sign_contract',{p_document_id:doc.id,p_version:payment.version,p_evidence_path:proof,p_request_id:randomUUID()},409);
assert.equal(staleCredit.message,'credit_changed_prepare_new_contract');
const refreshed=await rpc('sales_unlock_contract',{p_document_id:doc.id,p_version:payment.version,p_document_version:locked.document_version,p_reason:'Refresh credit',p_request_id:randomUUID()});
doc=(await documents()).documents.find(d=>d.id===refreshed.document_id);
locked=await rpc('sales_lock_contract',{p_document_id:doc.id,p_version:refreshed.version,p_document_version:doc.version,p_request_id:randomUUID()});
const signArgs={p_document_id:doc.id,p_version:locked.version,p_evidence_path:proof,p_request_id:randomUUID()};
const signed=await rpc('sales_sign_contract',signArgs);
assert.deepEqual(await rpc('sales_sign_contract',signArgs),signed,'Sign replay is idempotent');
docs=await documents();assert.equal(docs.instalments.length,6);
assert.equal(docs.instalments.reduce((sum,r)=>sum+BigInt(r.gross_cents),0n),20000001n);
assert.equal(docs.instalments.reduce((sum,r)=>sum+BigInt(r.credit_cents),0n),100n);
assert.equal((await detail()).status,'contracted');
console.log('BKP HTTP flow PASS: estimate, revisions, acceptance, draft/rebind, concurrency/replay, lock/unlock, signing and six instalments. Case '+id);
