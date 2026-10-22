const $=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DB='hua-yu-wu-v1', STORE='records';
let db, records=[], selected=null, editing=null, image='', images=[], view='home', filter='全部', showcaseMode='commission', showcaseSelection=null;
const commissions=()=>records.filter(x=>x.type==='commission'), products=()=>records.filter(x=>x.type==='product'), byId=id=>records.find(x=>x.id===id);
const {safeImage,coverImage,showcaseItems,moveImage,normalizeRecord,normalizeBackup,calculateTotals}=RecordModel;
const money=value=>'¥'+new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
function openDB(){return new Promise((ok,no)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function tx(mode,work){return new Promise((ok,no)=>{let t=db.transaction(STORE,mode),result;try{result=work(t.objectStore(STORE))}catch(e){t.abort();no(e);return}t.oncomplete=()=>ok(result?.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})}
async function load(){records=(await tx('readonly',s=>s.getAll())).map(normalizeRecord);render()}
async function save(x){await tx('readwrite',s=>s.put(x));await load()}
async function remove(ids){await tx('readwrite',s=>ids.forEach(id=>s.delete(id)));await load()}
function toast(s){let e=$('#toast');e.textContent=s;e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),2700)}
function setView(v){view=v;selected=null;showcaseSelection=null;if(v==='showcase')showcaseMode='commission';filter='全部';$('#search').value='';document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===v));render();if(v==='commissions')$('#collection').scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'})}
function render(){
  const totals=calculateTotals(records);
  $('#stat-commissions').textContent=commissions().length;$('#stat-products').textContent=products().length;$('#stat-total').textContent=money(totals.total);
  $('#cost-commissions').textContent=money(totals.commissions);$('#cost-products').textContent=money(totals.products);$('#cost-total').textContent=money(totals.total);
  let detail=selected&&byId(selected);
  $('#main-view').classList.toggle('hidden',!!detail||view==='products'||view==='showcase');
  $('#product-page').classList.toggle('hidden',!detail||view==='showcase');
  $('#all-products').classList.toggle('hidden',!!detail||view!=='products');
  $('#showcase-page').classList.toggle('hidden',view!=='showcase');
  if(view==='showcase'){renderShowcase();return}
  if(detail){renderDetail(detail);return}
  if(view==='products'){renderAllProducts();return}
  $('#breadcrumb').textContent=view==='home'?'我的收藏 / 总览':'我的收藏 / 约稿收藏';
  $('#section-title').innerHTML=(view==='home'?'最近收藏':'约稿收藏')+' <span>✳</span>';
  $('#filters').innerHTML=['全部','已有制品','暂无制品'].map(x=>`<button class="chip ${filter===x?'active':''}" data-filter="${x}">${x}</button>`).join('');
  let q=$('#search').value.trim().toLocaleLowerCase();
  let list=commissions().filter(c=>{let n=products().filter(p=>p.commissionId===c.id).length;return(filter==='全部'||(filter==='已有制品'?n>0:n===0))&&(!q||[c.title,c.artist,c.platform,c.notes].some(v=>String(v??'').toLocaleLowerCase().includes(q)))}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('#items').innerHTML=list.length?list.map(commissionCard).join(''):`<div class="empty"><div class="empty-symbol">✳</div><h3>${commissions().length?'没有找到符合条件的约稿':'这里还空着，等你的第一份收藏'}</h3><p>${commissions().length?'试试其他关键词或筛选条件。':'先记录一份约稿，再为它添加制品吧。'}</p>${commissions().length?'':'<button class="primary" data-create="commission">＋ 记录新约稿</button>'}</div>`;
}
function commissionCard(c){let n=products().filter(p=>p.commissionId===c.id).length,img=coverImage(c);return `<article class="card"><div class="card-image">${img?`<img src="${img}" alt="${esc(c.title)}">`:'<span class="placeholder">✿</span>'}</div><div class="card-body"><span class="card-kicker">COMMISSION</span><h3>${esc(c.title)}</h3><p>${esc([c.platform,c.artist].filter(Boolean).join(' · ')||'尚未填写平台与画师')}</p><div class="card-actions"><button data-products="${esc(c.id)}">制品 ${n} 件 →</button><button data-edit="${esc(c.id)}">编辑</button></div></div></article>`}
function productCard(p){let img=safeImage(p.image),source=byId(p.commissionId);return `<button class="card product-card" data-edit="${esc(p.id)}"><div class="card-image">${img?`<img src="${img}" alt="${esc(p.title)}">`:'<span class="placeholder">◈</span>'}</div><div class="card-body"><span class="card-kicker">CREATION</span><h3>${esc(p.title)}</h3><p>${esc([p.kind,p.craft,p.size].filter(Boolean).join(' · ')||'尚未填写详情')}</p><p class="product-source">${source?'关联：'+esc(source.title):'独立制品'}</p></div></button>`}
function renderAllProducts(){
  $('#breadcrumb').textContent='我的收藏 / 制品清单';
  const list=products().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('#all-product-items').innerHTML=list.length?list.map(productCard).join(''):'<div class="empty"><div class="empty-symbol">◈</div><h3>还没有制品记录</h3><p>可先独立添加，之后再选择关联约稿。</p><button class="primary" data-create="product">＋ 添加制品</button></div>';
}
function showcaseCard(item){
  const isProduct=item.type==='product', linked=isProduct?0:products().filter(p=>p.commissionId===item.id).length;
  const img=isProduct?safeImage(item.image):coverImage(item);
  const caption=isProduct?(item.kind||'制品收藏'):(linked?`展开相关制品 · ${linked} 件 →`:'暂无关联制品');
  return `<button class="shelf-card ${!isProduct&&!linked?'shelf-card-static':''}" type="button" ${!isProduct&&!linked?'disabled':''} data-showcase-open="${esc(item.id)}"><span class="shelf-frame">${img?`<img src="${img}" alt="${esc(item.title)}">`:`<span class="shelf-placeholder">${isProduct?'◈':'✿'}</span>`}</span><span class="shelf-caption"><strong>${esc(item.title)}</strong><small>${esc(caption)}</small></span></button>`;
}
function showcaseProductInfo(p){
  const source=byId(p.commissionId),img=safeImage(p.image);
  const fields=[p.kind&&'类型：'+p.kind,p.craft&&'工艺：'+p.craft,p.size&&'尺寸：'+p.size,p.quantity&&'数量：'+p.quantity,p.amount&&'制作费用：¥'+p.amount,p.date&&'日期：'+p.date,source&&'关联约稿：'+source.title].filter(Boolean);
  return `<article class="showcase-product-card"><div class="showcase-product-photo">${img?`<img src="${img}" alt="${esc(p.title)}">`:'<span class="shelf-placeholder">◈</span>'}</div><div class="showcase-product-copy"><span class="eyebrow">LITTLE CREATION</span><h2>${esc(p.title)}</h2><div class="showcase-details">${fields.length?fields.map(value=>`<span>${esc(value)}</span>`).join(''):'<span>尚未填写详细信息</span>'}</div>${p.notes?`<p>${esc(p.notes)}</p>`:''}</div></article>`;
}
function renderShowcase(){
  const item=showcaseSelection&&byId(showcaseSelection);
  if(item&&(item.type==='product'||(item.type==='commission'&&item.showcase!==false&&products().some(p=>p.commissionId===item.id)))){
    renderShowcaseDetail(item);return;
  }
  showcaseSelection=null;
  $('#showcase-gallery').classList.remove('hidden');$('#showcase-detail').classList.add('hidden');
  $('#breadcrumb').textContent='我的收藏 / 展览柜';
  document.querySelectorAll('[data-showcase-mode]').forEach(button=>{const active=button.dataset.showcaseMode===showcaseMode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
  const list=showcaseItems(records,showcaseMode).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const rows=[];for(let i=0;i<list.length;i+=2)rows.push(`<div class="shelf-row">${list.slice(i,i+2).map(showcaseCard).join('')}</div>`);
  $('#showcase-items').innerHTML=rows.length?rows.join(''):`<div class="showcase-empty"><span>✳</span><h2>${showcaseMode==='product'?'还没有制品可以展示':'展览柜里暂时没有稿件'}</h2><p>${showcaseMode==='product'?'添加制品后，就能在这里欣赏。':'可在约稿编辑页勾选“加入展览柜”。'}</p></div>`;
}
function renderShowcaseDetail(item){
  $('#showcase-gallery').classList.add('hidden');$('#showcase-detail').classList.remove('hidden');
  $('#breadcrumb').textContent=`我的收藏 / 展览柜 / ${item.title}`;
  if(item.type==='product'){
    $('#showcase-detail').innerHTML=`<button type="button" class="showcase-back" data-showcase-back>← 返回展览柜</button>${showcaseProductInfo(item)}`;
    return;
  }
  const pictures=normalizeRecord(item).images;
  const thumbs=pictures.length>1?`<div class="showcase-thumbs">${pictures.map((src,i)=>`<button type="button" data-showcase-image="${i}" class="${i===0?'active':''}" aria-label="查看第 ${i+1} 张约稿图"><img src="${src}" alt=""></button>`).join('')}</div>`:'';
  const fields=[item.platform&&'平台：'+item.platform,item.artist&&'画师：'+item.artist,item.commissionDate&&'约稿：'+item.commissionDate,item.deliveryDate&&'交稿：'+item.deliveryDate].filter(Boolean);
  const linked=products().filter(p=>p.commissionId===item.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('#showcase-detail').innerHTML=`<button type="button" class="showcase-back" data-showcase-back>← 返回展览柜</button><div class="showcase-commission"><div class="showcase-art">${pictures.length?`<img id="showcase-display" src="${pictures[0]}" alt="${esc(item.title)}">`:'<span class="shelf-placeholder">✿</span>'}${thumbs}</div><div class="showcase-art-copy"><span class="eyebrow">COMMISSION ON DISPLAY</span><h1>${esc(item.title)}</h1><div class="showcase-details">${fields.map(value=>`<span>${esc(value)}</span>`).join('')}</div>${item.notes?`<p>${esc(item.notes)}</p>`:''}</div></div><div class="showcase-related"><span class="eyebrow">MADE FROM THIS ART</span><h2>与这幅画有关的制品 <span>✳</span></h2><div class="showcase-related-grid">${linked.map(showcaseProductInfo).join('')}</div></div>`;
}
function renderDetail(c){
  $('#breadcrumb').textContent=`我的收藏 / ${c.title} / 制品`;
  const pictures=normalizeRecord(c).images;
  const meta=[c.platform,c.artist,c.commissionDate&&'约稿 '+c.commissionDate,c.deliveryDate&&'交稿 '+c.deliveryDate,c.amount&&'¥'+c.amount].filter(Boolean);
  const thumbs=pictures.length>1?`<div class="detail-thumbnails">${pictures.map((src,i)=>`<button type="button" data-preview-index="${i}" class="${i===0?'active':''}" aria-label="查看第 ${i+1} 张约稿图"><img src="${src}" alt=""></button>`).join('')}</div>`:'';
  $('#commission-detail').innerHTML=`<div class="detail-card"><div class="detail-visual"><div class="detail-image">${pictures.length?`<img id="detail-display" src="${pictures[0]}" alt="${esc(c.title)}">`:'<span class="placeholder">✿</span>'}</div>${thumbs}</div><div class="detail-copy"><span class="eyebrow">COMMISSION STORY</span><h1>${esc(c.title)}</h1><div class="detail-meta">${meta.length?meta.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>还没有填写详细信息</span>'}</div>${c.notes?`<p>${esc(c.notes)}</p>`:''}<button class="detail-edit" data-edit="${esc(c.id)}">编辑约稿 ↗</button></div></div>`;
  const list=products().filter(p=>p.commissionId===c.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('#product-items').innerHTML=list.length?list.map(productCard).join(''):'<div class="empty"><div class="empty-symbol">◈</div><h3>这张画还没有制品记录</h3><p>点击“添加制品”，记下由它诞生的小物。</p></div>';
}
function updateType(type){
  const product=type==='product';
  $('#commission-fields').classList.toggle('hidden',product);
  $('#commission-dates').classList.toggle('hidden',product);
  $('#commission-image-field').classList.toggle('hidden',product);
  $('#showcase-field').classList.toggle('hidden',product);
  $('#product-fields').classList.toggle('hidden',!product);
  $('#product-extra').classList.toggle('hidden',!product);
  $('#product-image-field').classList.toggle('hidden',!product);
  $('#relation-field').classList.toggle('hidden',!product);
  $('#date-label').classList.toggle('hidden',!product);
  $('#amount-label').firstChild.textContent=product?'制作费用（整批，元）':'价格（元）';
  $('#title-label').firstChild.textContent=product?'制品名称 ':'约稿名称 ';
}
function preview(){
  const img=safeImage(image);
  $('#image-preview').innerHTML=img?`<img src="${img}" alt="制品照片预览"><button type="button" id="remove-image">移除图片</button>`:'';
  $('#image-preview').classList.toggle('hidden',!img||$('#editor').dataset.type!=='product');
}
function previewGallery(){
  $('#image-gallery-preview').classList.toggle('hidden',!images.length||$('#editor').dataset.type!=='commission');
  $('#image-gallery-preview').innerHTML=images.map((src,i)=>`<div class="gallery-item"><img src="${src}" alt="第 ${i+1} 张约稿图"><span>${i===0?'封面':'第 '+(i+1)+' 张'}</span><div><button type="button" data-move-image="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="向前移动第 ${i+1} 张">←</button><button type="button" data-move-image="${i}" data-direction="1" ${i===images.length-1?'disabled':''} aria-label="向后移动第 ${i+1} 张">→</button><button type="button" data-remove-gallery="${i}" aria-label="移除第 ${i+1} 张">移除</button></div></div>`).join('');
}
function openEditor(type,id){
  editing=id?byId(id):null;
  image=safeImage(editing?.image);
  images=type==='commission'&&editing?normalizeRecord(editing).images:[];
  $('#record-form').reset();$('#editor').dataset.type=type;updateType(type);
  $('#dialog-title').textContent=(editing?'编辑':'记录新')+(type==='product'?'制品':'约稿');
  $('#delete-record').classList.toggle('hidden',!editing);
  $('#commission-select').innerHTML='<option value="">不关联约稿</option>'+commissions().map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
  if(editing)for(const [key,value] of Object.entries(editing)){const field=$('#record-form').elements.namedItem(key);if(field&&field.type!=='file'&&field.type!=='checkbox')field.value=value??''}
  if(type==='commission')$('#record-form').elements.namedItem('showcase').checked=editing?.showcase!==false;
  if(type==='product')$('#commission-select').value=editing?.commissionId||selected||'';
  preview();previewGallery();$('#editor').showModal();
}
const autoTitle=t=>`${t==='product'?'制品':'约稿'} #${String(records.filter(x=>x.type===t).length+1).padStart(3,'0')}`;
async function submit(e){
  e.preventDefault();
  const type=$('#editor').dataset.type,data=new FormData($('#record-form'));
  const item={id:editing?.id||crypto.randomUUID(),type,title:String(data.get('title')||'').trim()||editing?.title||autoTitle(type),notes:String(data.get('notes')||'').trim(),amount:data.get('amount')||'',createdAt:editing?.createdAt||new Date().toISOString()};
  if(type==='commission')Object.assign(item,{showcase:data.has('showcase'),images:[...images],platform:String(data.get('platform')||'').trim(),artist:String(data.get('artist')||'').trim(),commissionDate:data.get('commissionDate')||'',deliveryDate:data.get('deliveryDate')||''});
  else {
    const commissionId=String(data.get('commissionId')||'');
    if(commissionId&&!commissions().some(c=>c.id===commissionId)){toast('关联约稿不存在，请重新选择');return}
    Object.assign(item,{image,commissionId,craft:String(data.get('craft')||'').trim(),size:String(data.get('size')||'').trim(),kind:String(data.get('kind')||'').trim(),quantity:data.get('quantity')||'',date:data.get('date')||''});
  }
  try{await save(item);$('#editor').close();toast(editing?'记录已更新':'记录已添加')}catch(err){console.error(err);toast('保存失败，请检查浏览器储存空间')}
}
async function del(){if(!editing)return;let kids=editing.type==='commission'?products().filter(p=>p.commissionId===editing.id):[];if(!confirm(kids.length?`这份约稿关联了 ${kids.length} 件制品。删除约稿也会删除这些制品，确定继续吗？`:'确定删除这条记录吗？'))return;try{await remove([editing.id,...kids.map(x=>x.id)]);if(selected===editing.id)selected=null;$('#editor').close();render();toast('记录已删除')}catch(err){console.error(err);toast('删除失败')}}
function exportBackup(){let url=URL.createObjectURL(new Blob([JSON.stringify({format:'hua-yu-wu-backup',version:1,exportedAt:new Date().toISOString(),records})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='画与物备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出')}
async function importBackup(file){
  if(!file)return;
  try{
    const list=normalizeBackup(JSON.parse(await file.text()));
    if(!confirm(`将用备份中的 ${list.length} 条记录替换本机现有的 ${records.length} 条记录。确定导入吗？`))return;
    await tx('readwrite',store=>{store.clear();list.forEach(item=>store.put(item))});
    selected=null;showcaseSelection=null;await load();toast('备份已导入');
  }catch(err){console.error(err);toast('导入失败：文件格式不正确或储存空间不足')}
  finally{$('#backup-file').value=''}
}
document.addEventListener('click',event=>{
  let node=event.target.closest('[data-view]');if(node)return setView(node.dataset.view);
  node=event.target.closest('[data-showcase-mode]');if(node){showcaseMode=node.dataset.showcaseMode;showcaseSelection=null;render();return}
  node=event.target.closest('[data-showcase-open]');if(node){showcaseSelection=node.dataset.showcaseOpen;render();window.scrollTo({top:0,behavior:'smooth'});return}
  node=event.target.closest('[data-showcase-back]');if(node){showcaseSelection=null;render();window.scrollTo({top:0,behavior:'smooth'});return}
  node=event.target.closest('[data-showcase-image]');if(node){
    const pictures=normalizeRecord(byId(showcaseSelection)).images;
    $('#showcase-display').src=pictures[Number(node.dataset.showcaseImage)];
    document.querySelectorAll('[data-showcase-image]').forEach(button=>button.classList.toggle('active',button===node));
    return;
  }
  node=event.target.closest('[data-filter]');if(node){filter=node.dataset.filter;return render()}
  node=event.target.closest('[data-products]');if(node){selected=node.dataset.products;render();return window.scrollTo({top:0,behavior:'smooth'})}
  node=event.target.closest('[data-edit]');if(node){const item=byId(node.dataset.edit);if(item)return openEditor(item.type,item.id)}
  node=event.target.closest('[data-create]');if(node)return openEditor(node.dataset.create);
  node=event.target.closest('[data-preview-index]');if(node){
    const pictures=normalizeRecord(byId(selected)).images,index=Number(node.dataset.previewIndex);
    $('#detail-display').src=pictures[index];
    document.querySelectorAll('[data-preview-index]').forEach(button=>button.classList.toggle('active',button===node));
    return;
  }
  node=event.target.closest('[data-move-image]');if(node){const from=Number(node.dataset.moveImage);images=moveImage(images,from,from+Number(node.dataset.direction));previewGallery();return}
  node=event.target.closest('[data-remove-gallery]');if(node){images.splice(Number(node.dataset.removeGallery),1);previewGallery();return}
  if(event.target.id==='remove-image'){image='';$('[name=image]').value='';preview()}
});
$('#new-commission').onclick=()=>openEditor('commission');
$('#new-hero-product').onclick=()=>openEditor('product');
$('#open-showcase').onclick=()=>setView('showcase');
$('#new-product').onclick=()=>openEditor('product');
$('#new-standalone-product').onclick=()=>openEditor('product');
$('#back-to-commissions').onclick=()=>{selected=null;render();window.scrollTo({top:0,behavior:'smooth'})};
$('#open-costs').onclick=()=>$('#cost-dialog').showModal();
$('#close-costs').onclick=()=>$('#cost-dialog').close();
$('#close-dialog').onclick=$('#cancel-dialog').onclick=()=>$('#editor').close();
$('#record-form').onsubmit=submit;$('#delete-record').onclick=del;$('#search').oninput=render;
$('#export-backup').onclick=exportBackup;$('#import-backup').onclick=()=>$('#backup-file').click();$('#backup-file').onchange=e=>importBackup(e.target.files[0]);
function readImage(file){return new Promise((ok,no)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>no(reader.error);reader.readAsDataURL(file)})}
function validImage(file){return file.size<=8*1024*1024&&['image/jpeg','image/png','image/webp'].includes(file.type)}
$('[name=image]').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(!validImage(file)){toast('请选择小于 8MB 的 JPG、PNG 或 WebP 图片');event.target.value='';return}
  try{image=safeImage(await readImage(file));preview()}catch(err){console.error(err);toast('图片读取失败')}
};
$('[name=images]').onchange=async event=>{
  const files=[...event.target.files];if(!files.length)return;
  if(files.some(file=>!validImage(file))){toast('每张图片须为小于 8MB 的 JPG、PNG 或 WebP');event.target.value='';return}
  try{for(const file of files){const src=safeImage(await readImage(file));if(src)images.push(src)}previewGallery()}
  catch(err){console.error(err);toast('图片读取失败')}
  finally{event.target.value=''}
};
$('#today').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(new Date());openDB().then(x=>{db=x;return load()}).catch(err=>{console.error(err);toast('无法打开浏览器储存')});
