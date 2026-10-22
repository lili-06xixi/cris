(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.RecordModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const imagePattern=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const safeImage=value=>typeof value==='string'&&imagePattern.test(value)?value:'';
  const validImage=file=>!!file&&['image/jpeg','image/png','image/webp'].includes(file.type);
  function normalizeImages(item){
    const images=Array.isArray(item.images)?item.images.map(safeImage).filter(Boolean):[];
    if(!images.length&&safeImage(item.image))images.push(item.image);
    return images;
  }
  function normalizeRecord(item){
    const result={...item};
    if(item.type==='commission'){
      result.showcase=item.showcase!==false;
      result.images=normalizeImages(item);
    }else if(item.type==='product'){
      result.images=normalizeImages(item);
      result.image=result.images[0]||'';
      result.commissionId=typeof item.commissionId==='string'?item.commissionId:'';
    }
    return result;
  }
  function coverImage(item){return normalizeRecord(item).images[0]||''}
  function imageFileName(item,index){
    const src=normalizeRecord(item).images[index]||'';
    const kind=/^data:image\/(png|jpeg|webp);/.exec(src)?.[1]||'png';
    const title=String(item.title||'图片').replace(/[<>:"/\\|?*]/g,'_').trim()||'图片';
    return `${title}-原图-${index+1}.${kind==='jpeg'?'jpg':kind}`;
  }
  function showcaseItems(records,mode){return records.filter(item=>mode==='product'?item.type==='product':item.type==='commission'&&item.showcase!==false)}
  function moveImage(images,from,to){
    if(from<0||to<0||from>=images.length||to>=images.length)return [...images];
    const result=[...images];result.splice(to,0,result.splice(from,1)[0]);return result;
  }
  function normalizeBackup(data){
    if(data?.format!=='hua-yu-wu-backup'||data.version!==1||!Array.isArray(data.records)||data.records.length>10000)throw Error('Invalid backup');
    const result=data.records.map(item=>{
      if(!item||typeof item.id!=='string'||!['commission','product'].includes(item.type)||typeof item.title!=='string'||typeof item.createdAt!=='string')throw Error('Invalid record');
      return normalizeRecord(item);
    });
    const ids=new Set(result.map(item=>item.id));
    if(ids.size!==result.length||result.some(item=>item.type==='product'&&item.commissionId&&!result.some(c=>c.id===item.commissionId&&c.type==='commission')))throw Error('Invalid relation');
    return result;
  }
  function calculateTotals(records){
    const cents={commissions:0,products:0};
    for(const item of records){
      const amount=Number(item.amount);
      if(!Number.isFinite(amount)||amount<0)continue;
      const value=Math.round(amount*100);
      if(item.type==='commission')cents.commissions+=value;
      if(item.type==='product')cents.products+=value;
    }
    return {commissions:cents.commissions/100,products:cents.products/100,total:(cents.commissions+cents.products)/100};
  }
  return {safeImage,validImage,normalizeRecord,coverImage,imageFileName,showcaseItems,moveImage,normalizeBackup,calculateTotals};
});
