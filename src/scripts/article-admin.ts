import { isLocalPreview, validateArticles, type Article } from '../lib/articles';
import { renderMarkdown } from '../lib/article-markdown';
import { withBase } from '../config/site';

export async function initializeArticleAdmin() {
  const form = document.querySelector<HTMLFormElement>('#article-form');
  if(!form) return;
  if(!isLocalPreview()) { document.querySelector<HTMLElement>('[data-article-desk]')!.textContent='文章管理預覽只在 localhost 開放。'; return; }
  const feedback = document.querySelector<HTMLElement>('#editor-feedback')!;
  const status = document.querySelector<HTMLElement>('#save-status')!;
  let rows: Article[]; let revision = ''; let saving = false;
  async function requestStore(options?: RequestInit) {
    const response = await fetch(withBase('__articles'),options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '無法讀取文章');
    validateArticles(data.rows); return data as {rows: Article[]; revision: string};
  }
  try { const data=await requestStore(); rows=data.rows; revision=data.revision; } catch(error) { feedback.textContent=String(error); form.querySelectorAll('input,button,select,textarea').forEach(el=>el.setAttribute('disabled','')); return; }
  let selected = rows[0]?.id ?? crypto.randomUUID();
  let filter = 'all'; let dirty=false;
  function field(name: string) { return form!.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; }
  function blank(): Article { return {id:crypto.randomUUID(),type:'journal',title:'',slug:'',summary:'',date:new Date().toLocaleDateString('en-CA'),topic:'Weekly Notes',status:'draft',stage:'進行中',featured:false,body:'',link:'',event:'',role:''}; }
  function values(): Article {
    return {id:selected,type:field('type').value === 'research'?'research':'journal',title:field('title').value.trim(),slug:field('slug').value.trim(),summary:field('summary').value.trim(),date:field('date').value,topic:field('topic').value,status:field('status').value === 'published'?'published':'draft',stage:field('stage').value === '已完成'?'已完成':'進行中',featured:(field('featured') as HTMLInputElement).checked,body:field('body').value,link:field('link').value,event:field('event').value,role:field('role').value};
  }
  function updateFields(topic?: string) {
    const research=field('type').value==='research';
    const select=field('topic') as HTMLSelectElement;
    if(topic !== undefined) {
      select.replaceChildren();
      for(const value of research?['Agent Systems','Deep Learning','Quantitative Finance']:['Competitions','Weekly Notes']) { const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option); }
      if([...select.options].some(option=>option.value===topic)) select.value=topic;
    }
    document.querySelector<HTMLElement>('#research-fields')!.hidden=!research;
    document.querySelector<HTMLElement>('#competition-fields')!.hidden=research || select.value!=='Competitions';
  }
  function preview() {
    const article=values();
    document.querySelector<HTMLElement>('#preview-title')!.textContent=article.title || '文章標題';
    document.querySelector<HTMLElement>('#preview-meta')!.textContent=`${article.date} / ${article.topic} / ${article.status==='draft'?'草稿':'待部署'}`;
    document.querySelector<HTMLElement>('#preview-summary')!.textContent=article.summary || '文章摘要會顯示在這裡。';
    renderMarkdown(document.querySelector<HTMLElement>('#preview-body')!,article.body);
  }
  function list() {
    const container=document.querySelector<HTMLElement>('#desk-list')!;container.replaceChildren();
    for(const article of rows.filter(row=>filter==='all'||row.type===filter).sort((a,b)=>b.date.localeCompare(a.date))) {
      const button=document.createElement('button');button.type='button';button.className='entry-button';button.setAttribute('aria-pressed',String(article.id===selected));
      const title=document.createElement('strong');title.textContent=article.title;
      const meta=document.createElement('small');meta.textContent=`${article.type==='research'?'Research':'Journal'} / ${article.status==='draft'?'草稿':'待部署'} / ${article.date}`;
      button.append(title,meta);button.addEventListener('click',()=>{if(!dirty||confirm('有尚未儲存的修改，確定切換文章？'))load(article);});container.append(button);
    }
  }
  function load(article: Article) {
    selected=article.id;field('type').value=article.type;updateFields(article.topic);
    for(const key of ['title','slug','summary','date','status','stage','body','link','event','role'] as const)field(key).value=article[key];
    (field('featured') as HTMLInputElement).checked=article.featured;
    document.querySelector<HTMLElement>('#editing-title')!.textContent=article.title?'編輯文章':'新增文章';
    dirty=false;status.textContent='尚未修改';feedback.textContent='';list();preview();
  }
  async function save() {
    if (saving) return false;
    if(!form!.reportValidity())return false;
    const article=values();
    if(!article.title || !article.summary || !article.body.trim()) {feedback.textContent='請填寫標題、摘要與內文。';return false;}
    if(rows.some(row=>row.slug===article.slug&&row.id!==article.id)){feedback.textContent='這個網址代稱已被使用，請換一個。';return false;}
    if(article.link && !/^https?:\/\//i.test(article.link)){feedback.textContent='連結必須使用 http 或 https。';return false;}
    const next=[...rows.filter(row=>row.id!==article.id),article];
    saving=true;
    const controls=document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea');
    controls.forEach(control=>control.disabled=true); status.textContent='儲存中…';
    try {
      const data=await requestStore({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:next,revision})});
      rows=data.rows;revision=data.revision;dirty=false;status.textContent='已儲存到專案';
      feedback.textContent=article.status==='draft'?'草稿已寫入專案，前台不會顯示。':'已寫入專案，localhost 可查看；部署後才會更新正式網站。';
      list();return true;
    }
    catch(error){status.textContent='儲存失敗';feedback.textContent=`儲存失敗，編輯內容仍保留：${error instanceof Error?error.message:String(error)}`;return false;}
    finally {saving=false;controls.forEach(control=>control.disabled=false);}
  }
  form.addEventListener('input',()=>{dirty=true;status.textContent='尚未儲存';preview();});
  field('type').addEventListener('change',()=>{updateFields('');preview();});
  field('topic').addEventListener('change',()=>{updateFields();preview();});
  form.addEventListener('submit',event=>{event.preventDefault();save();});
  document.querySelector('#read-preview')!.addEventListener('click',async ()=>{if(await save())location.href=withBase(`article.html?id=${encodeURIComponent(selected)}&preview=1`);});
  document.querySelector('#new-article')!.addEventListener('click',()=>{if(!dirty||confirm('有尚未儲存的修改，確定新增文章？'))load(blank());});
  document.querySelectorAll<HTMLButtonElement>('[data-library]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.library!;document.querySelectorAll('[data-library]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));list();}));
  window.addEventListener('beforeunload',event=>{if(dirty)event.preventDefault();});
  document.querySelector('#insert-template')!.addEventListener('click',()=>{
    if (field('body').value.trim() && !confirm('以寫作架構替換目前內文？')) return;
    field('body').value=field('type').value==='research'
      ? '## 研究問題\n\n想回答什麼？為什麼值得研究？\n\n## 假設與方法\n\n資料、設定、baseline 與評估方式。\n\n## 實驗與結果\n\n區分已觀察到的結果與尚未驗證的假設。\n\n## 限制與下一步\n\n## 參考資料\n'
      : field('topic').value==='Competitions'
      ? '## 比賽背景\n\n## 作品與問題\n\n## 我的角色與決策\n\n## 結果與反思\n\n## 下一步\n'
      : '## 這週完成\n\n## 遇到的問題\n\n## 學到的事\n\n## 下週想推進的事\n';
    dirty=true;status.textContent='尚未儲存';preview();
  });
  load(rows[0] ?? blank());
}
