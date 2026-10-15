import { categories } from './data.mjs';
import { escapeHtml as e } from './lib.mjs';
import { request, normalizeDraft, imagePayload, loadClientConfig } from './client.mjs';
import { icon, avatar, authorFor, header, homeView, topicsView, weeklyView, footer, empty } from './ui.mjs';
import { articleView, profileView, editorView } from './content-ui.mjs';
import { authView, adminView, serviceBanner } from './account-ui.mjs';

const state={route:'home',routeId:'',category:'all',query:'',sort:'recommend',feed:'discover',limit:6,authorOffset:0,editorMode:'edit',service:'loading',user:null,isAdmin:false,banned:false,profile:{name:'访客',bio:''},authors:[],allArticles:[],saved:[],liked:[],following:[],checkin:'',comments:{},draft:normalizeDraft(),admin:{posts:[],comments:[],users:[]},adminTab:'posts',authType:'email',authMessage:'',authToken:'',routeError:'',routeLoading:false,busy:false};
const root=document.querySelector('#app');
const modal=document.querySelector('#modal');
let toastTimer,draftTimer,routeRevision=0,draftRevision=0,draftDirty=false;
let draftQueue=Promise.resolve();
let authRevision=0,personalRevision=0,publishAttempt=null;
const inFlight=new Set(),commentAttempts=new Map();

/** 清理账号私有数据，作废旧请求，避免切换账号时回填。
 * Returns:
 *   当前会话版本。
 */
function clearSession() {
  authRevision++;personalRevision++;clearTimeout(draftTimer);routeRevision++;
  state.user=null;state.isAdmin=false;state.banned=false;state.profile={name:'访客',bio:''};
  state.saved=[];state.liked=[];state.following=[];state.checkin='';state.comments={};
  state.admin={posts:[],comments:[],users:[]};state.draft=normalizeDraft();draftDirty=false;
  state.allArticles=state.allArticles.filter(a=>a.status==='published');
  publishAttempt=null;commentAttempts.clear();modal.close();
  return authRevision;
}

/** 检查异步响应是否仍属于当前登录账号。
 * Args:
 *   revision: 请求开始时的会话版本。
 *   userId: 请求开始时的账号标识。
 * Returns:
 *   是否允许应用响应。
 */
function sameSession(revision,userId=state.user?.id) {return revision===authRevision && userId===state.user?.id;}

/** 为相同内容的超时重试保留提交标识。
 * Args:
 *   previous: 上一次提交记录。
 *   signature: 当前请求内容。
 * Returns:
 *   提交记录。
 */
function attemptFor(previous,signature) {return previous?.signature===signature?previous:{signature,id:crypto.randomUUID()};}

/** 显示操作反馈，不插入不可信 HTML。
 * Args:
 *   message: 提示文本。
 * Returns:
 *   无返回值。
 */
function toast(message) {
  const box=document.querySelector('#toast');clearTimeout(toastTimer);
  box.textContent=message;box.classList.add('visible');
  toastTimer=setTimeout(()=>box.classList.remove('visible'),4200);
}

/** 按标识合并真实记录，保留已经加载的文章和作者。
 * Args:
 *   current: 已加载数组。
 *   incoming: 新记录数组。
 * Returns:
 *   去重后的新数组。
 */
function merge(current,incoming=[]) {return [...new Map([...current,...incoming].filter(Boolean).map(item=>[item.id,item])).values()];}

/** 渲染当前页面，并保留操作按钮的键盘焦点。
 * Returns:
 *   无返回值。
 */
function render() {
  const focus=document.activeElement?.dataset || {};
  const views={home:homeView,saved:homeView,topics:topicsView,weekly:weeklyView,article:articleView,profile:profileView,author:profileView,write:editorView,login:authView,register:authView,forgot:authView,reset:authView,confirm:authView,admin:adminView};
  const protectedPage=['profile','saved','write'].includes(state.route);
  let content;
  if(state.routeLoading)content='<div class="page-loading" role="status"><span>✳</span><p>正在寻找下一点灵感…</p></div>';
  else if(protectedPage && !state.user)content=`<div class="empty-state"><span>✳</span><h1>让阅读与创作，随你同步。</h1><p>登录后查看个人收藏、草稿和文章。</p><a class="button primary" href="#/login">登录社区 ${icon('arrow')}</a></div>`;
  else if(state.routeError)content=empty('暂时无法打开这里',state.routeError);
  else content=views[state.route]?views[state.route](state):empty('这一页还没有被写下','从发现开始，寻找下一次灵感。');
  const banner=['login','register','forgot','reset','confirm'].includes(state.route)?'':serviceBanner(state);
  root.innerHTML=`${header(state)}<main class="main-shell" id="main" tabindex="-1">${banner}${state.banned?'<aside class="service-banner" role="status">账号当前受到限制，你仍可阅读已公开内容。如有疑问，请联系站点管理员。</aside>':''}${content}</main>${footer()}<button class="back-top" data-action="top" aria-label="返回顶部">${icon('up')}</button>`;
  const article=state.route==='article'?state.allArticles.find(a=>a.id===state.routeId):null;
  const titles={home:state.query?`搜索：${state.query}`:'发现',topics:'精选专题',weekly:'栈外周刊',saved:'我的收藏',profile:'我的主页',author:'创作者主页',write:'写文章',login:'登录',register:'注册',forgot:'找回密码',reset:'更新密码',confirm:'确认邮箱',admin:'内容管理'};
  document.title=`${article?.title || titles[state.route] || '页面未找到'} · 栈外 ZHANWAI`;
  if(focus.action) [...root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focus.action && el.dataset.id===focus.id && el.dataset.value===focus.value)?.focus({preventScroll:true});
}

/** 读取本人云端内容，保留正在输入的草稿。
 * Args:
 *   keepDraft: 是否保留编辑器中的草稿。
 * Returns:
 *   读取完成的 Promise。
 */
async function syncPersonal(keepDraft=state.route==='write' && draftDirty) {
  if(!state.user || state.banned)return;
  const auth=authRevision,userId=state.user.id,revision=++personalRevision;
  const me=await request('/me');
  if(!sameSession(auth,userId) || revision!==personalRevision)return;
  state.profile=me.profile || state.profile;state.isAdmin=me.isAdmin;
  state.saved=me.saved;state.liked=me.liked;state.following=me.following;state.checkin=me.checkin;
  state.allArticles=merge(state.allArticles.filter(a=>a.author!==userId),[...me.articles,...(me.savedArticles || [])]);
  state.authors=merge(state.authors,[me.profile,...(me.savedAuthors || []),...(me.followingProfiles || [])]);
  if(!keepDraft && !draftDirty){state.draft=normalizeDraft(me.draft);draftDirty=false;}
}

/** 重新读取会话和公开内容，退出后不残留私人文章。
 * Returns:
 *   社区读取完成的 Promise。
 */
async function refreshCommunity() {
  const auth=clearSession();
  const session=await request('/session');
  if(auth!==authRevision)return;
  state.user=session.user;state.isAdmin=session.isAdmin;state.banned=session.banned;
  state.authType=session.canResetPassword?'recovery':'email';
  state.profile=session.profile || {name:'访客',bio:''};
  const feed=await request('/feed');if(auth!==authRevision)return;state.allArticles=feed.articles;state.authors=feed.authors;
  state.saved=[];state.liked=[];state.following=[];state.checkin='';state.comments={};
  if(state.user && !state.banned)await syncPersonal();
}

/** 启动社区连接，配置和网络错误都明确展示。
 * Returns:
 *   启动完成的 Promise。
 */
async function bootstrap() {
  state.service='loading';render();
  try {
    await loadClientConfig();
    const health=await request('/health');
    if(!health.configured){state.service='unconfigured';render();return;}
    await refreshCommunity();state.service='ready';await route();
  } catch(error){state.service='error';state.routeLoading=false;render();toast(error.message);}
}

/** 解析路由并按需加载文章、作者或管理数据。
 * Returns:
 *   页面加载完成的 Promise。
 */
async function route() {
  if(state.publishing){history.replaceState(null,'','#/write');return;}
  const revision=++routeRevision;
  const auth=authRevision;
  clearTimeout(draftTimer);
  const target=location.hash.slice(1) || '/';
  if(state.route==='write' && draftDirty && document.querySelector('#editor-form')) {
    try {await saveDraft(false);}catch(error){history.replaceState(null,'','#/write');toast(`草稿尚未保存：${error.message}`);return;}
  }
  if(revision!==routeRevision)return;
  const [path,query='']=target.split('?');
  const [,name,id]=path.split('/');state.route=name || 'home';state.routeId=id || '';
  state.authMessage='';state.routeError='';state.routeLoading=false;state.limit=6;
  if(state.route==='write')state.editorMode='edit';
  if(state.route==='confirm') {
    const params=new URLSearchParams(query);state.authToken=params.get('token_hash') || '';
    state.authType=params.get('type')==='recovery'?'recovery':'email';
  }
  if(state.service!=='ready'){render();return;}
  const needsContent=['article','author','admin','write','profile','saved'].includes(state.route);
  if(needsContent){state.routeLoading=true;render();}
  try {
    if(state.route==='article') {
      const result=await request(`/posts/${encodeURIComponent(state.routeId)}`);
      if(revision!==routeRevision || auth!==authRevision)return;
      state.allArticles=merge(state.allArticles,[result.article]);state.authors=merge(state.authors,[result.author]);state.comments={...state.comments,[state.routeId]:result.comments};
    } else if(state.route==='author' && state.routeId!=='me') {
      const result=await request(`/profiles/${encodeURIComponent(state.routeId)}`);
      if(revision!==routeRevision || auth!==authRevision)return;
      state.authors=merge(state.authors,[result.profile]);state.allArticles=merge(state.allArticles,result.articles);
    } else if(state.route==='admin' && state.isAdmin)await loadAdmin();
    else if(['profile','saved','write'].includes(state.route) && state.user && !state.banned)await syncPersonal();
  } catch(error){if(revision===routeRevision)state.routeError=error.message;}
  if(revision!==routeRevision || auth!==authRevision)return;
  state.routeLoading=false;render();window.scrollTo({top:0,behavior:'instant'});
  if(query==='comments')document.querySelector('#comments')?.scrollIntoView();
}

/** 检查写操作是否有可用账号。
 * Returns:
 *   是否允许继续操作。
 */
function requireUser() {
  if(state.service!=='ready'){toast('社区服务暂时不可用，请稍后再试。');return false;}
  if(!state.user){state.afterAuth=location.hash;location.hash='/login';return false;}
  if(state.banned){toast('账号当前受到限制，暂时无法操作。');return false;}
  return true;
}

/** 回到首页并应用分类筛选。
 * Args:
 *   value: 分类标识。
 * Returns:
 *   无返回值。
 */
function chooseCategory(value) {
  if(!categories.some(c=>c.id===value))return;
  state.category=value;state.query='';state.feed='discover';state.limit=6;
  if(state.route!=='home')location.hash='/';else{render();document.querySelector('#feed')?.scrollIntoView({behavior:'smooth'});}
}

/** 读取当前编辑表单；保存失败时仍保留内存中的输入。
 * Returns:
 *   草稿数据。
 */
function readDraftForm() {
  if(!document.querySelector('#editor-form'))return state.draft;
  return {...state.draft,title:document.querySelector('#article-title').value,body:document.querySelector('#article-body').value,tags:document.querySelector('#article-tags').value,category:document.querySelector('#article-category').value};
}

/** 将编辑器状态转换为服务端允许的字段。
 * Args:
 *   draft: 草稿对象。
 * Returns:
 *   草稿请求体。
 */
function draftPayload(draft) {
  return {title:draft.title,body:draft.body,category:draft.category,tags:draft.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean).slice(0,5),cover_path:draft.cover_path || null,editing_post_id:draft.editing_post_id || null};
}

/** 串行保存云端草稿，较早响应不覆盖较新的输入。
 * Args:
 *   notify: 是否显示保存通知。
 *   suppliedDraft: 可选的明确草稿内容，用于提交后串行清空。
 * Returns:
 *   保存完成的 Promise。
 * Raises:
 *   ApiError: 草稿保存失败。
 */
async function saveDraft(notify=true,suppliedDraft=null) {
  if(!state.user || state.banned)throw new Error('请先登录可用账号');
  const draft=suppliedDraft || readDraftForm(),revision=draftRevision,auth=authRevision,userId=state.user.id;
  if(!suppliedDraft)state.draft=draft;
  draftQueue=draftQueue.catch(()=>{}).then(()=>{if(!sameSession(auth,userId))throw new Error('登录状态已变化，请重试');return request('/draft',{method:'PUT',body:draftPayload(draft)});});
  await draftQueue;
  if(!sameSession(auth,userId))return;
  if(revision===draftRevision){draftDirty=false;state.draft={...(suppliedDraft || state.draft),updated:new Date().toISOString()};}
  const label=document.querySelector('#draft-status');if(label)label.textContent=draftDirty?'仍有修改待保存':'草稿已保存到云端';
  if(notify)toast('草稿已保存，可在其他设备继续创作。');
}

/** 提交文章审核，成功后清空当前云端草稿。
 * Returns:
 *   提交完成的 Promise。
 */
async function publishArticle() {
  if(!requireUser())return;
  const auth=authRevision,userId=state.user.id;
  clearTimeout(draftTimer);await draftQueue.catch(()=>{});
  const draft=readDraftForm();state.draft=draft;
  if(draft.title.trim().length<3 || draft.body.trim().length<20){state.editorMode='edit';render();toast('标题至少 3 个字，正文至少 20 个字。');return;}
  const {editing_post_id,...body}=draftPayload(draft);
  publishAttempt=attemptFor(publishAttempt,JSON.stringify({userId,...body}));
  const result=await request(editing_post_id?`/posts/${editing_post_id}`:'/posts',{method:editing_post_id?'PATCH':'POST',body:{...body,status:'pending',...(!editing_post_id?{requestId:publishAttempt.id}:{})}});
  if(!sameSession(auth,userId))return;
  state.allArticles=merge(state.allArticles,[result.article]);draftDirty=false;state.draft=normalizeDraft();
  publishAttempt=null;
  try {await saveDraft(false,state.draft);}catch {toast('文章已提交，但旧草稿未清空，可稍后手动清理。');}
  if(!sameSession(auth,userId))return;
  state.publishing=false;
  location.hash=`/article/${result.article.id}`;toast('文章已提交审核，通过后所有人都能阅读。');
}

/** 读取管理员工作台，并将用户字段统一为页面约定。
 * Returns:
 *   读取完成的 Promise。
 */
async function loadAdmin() {
  const auth=authRevision,userId=state.user?.id;
  const data=await request('/admin');if(!sameSession(auth,userId) || !state.isAdmin)return;
  state.admin={...data,users:data.profiles || data.users || []};
  state.admin.comments=state.admin.comments.map(comment=>({...comment,name:state.admin.users.find(user=>user.id===comment.user_id)?.name || '社区用户',date:comment.created_at?.slice(0,10) || ''}));
  state.allArticles=merge(state.allArticles,data.posts);
  state.authors=merge(state.authors,state.admin.users);
}

/** 打开个人资料编辑窗口。
 * Returns:
 *   无返回值。
 */
function editProfile() {
  if(!requireUser())return;
  modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">编辑个人资料</h2><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><form id="profile-form"><label>昵称<input name="name" required minlength="2" maxlength="20" value="${e(state.profile.name)}"></label><label>个人简介<textarea name="bio" maxlength="100">${e(state.profile.bio)}</textarea></label><label>头像<input type="file" id="avatar-upload" accept="image/jpeg,image/png,image/webp"></label><p class="muted">图片不超过 2 MB，上传后可公开访问。</p><button class="button primary" type="submit">保存资料 ${icon('check')}</button></form>`;
  modal.showModal();
}

/** 请求删除确认，避免一次误点击直接删除文章。
 * Args:
 *   id: 文章标识。
 * Returns:
 *   无返回值。
 */
function confirmDelete(id) {
  modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">删除这篇文章？</h2><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><p>删除后文章与关联评论将无法恢复。你可以先复制正文留作备份。</p><div class="dialog-actions"><button class="button" data-action="close-modal">保留文章</button><button class="button danger-button" data-action="confirm-delete" data-id="${e(id)}">确认删除</button></div>`;modal.showModal();
}

/** 处理需要云端写入的点击操作。
 * Args:
 *   action: 操作名称。
 *   id: 对象标识。
 *   value: 目标状态。
 * Returns:
 *   操作完成的 Promise。
 */
async function cloudAction(action,id,value) {
  if(action==='logout') {
    if(!state.user)return;
    clearTimeout(draftTimer);if(draftDirty && !state.banned)await saveDraft(false);
    await draftQueue.catch(()=>{});
    try {await request('/auth/logout',{method:'POST'});}catch(error){if(error.code==='NETWORK_ERROR')throw new Error('当前页面已清理，但退出请求尚未确认。恢复网络后请重新登录并退出。');throw error;}finally {clearSession();location.hash='/';render();}
    await refreshCommunity();render();toast('已退出登录');return;
  }
  if(!requireUser())return;
  const auth=authRevision,userId=state.user.id;
  if(['like','save','follow'].includes(action)) {
    const key={like:'liked',save:'saved',follow:'following'}[action],resource={like:'likes',save:'bookmarks',follow:'follows'}[action];
    await request(`/${resource}/${id}`,{method:state[key].includes(id)?'DELETE':'PUT'});
    if(!sameSession(auth,userId))return;
    await syncPersonal(true);
    if(!sameSession(auth,userId))return;
    if(action==='like'){const result=await request(`/posts/${id}`);if(!sameSession(auth,userId))return;state.allArticles=merge(state.allArticles,[result.article]);}
    if(action==='save')toast(state.saved.includes(id)?'已加入收藏，登录后可跨设备查看。':'已取消收藏');
    if(action==='follow')toast(state.following.includes(id)?'已关注这位创作者':'已取消关注');
  } else if(action==='checkin'){await request('/checkin',{method:'POST'});if(!sameSession(auth,userId))return;await syncPersonal(true);toast('签到成功，今天也有一点新收获。');}
  else if(action==='edit-post' || action==='edit-post-confirm') {
    const article=state.allArticles.find(a=>a.id===id);
    if(!article || article.author!==state.user.id)throw new Error('你只能编辑自己的文章。');
    if(action==='edit-post' && state.draft.editing_post_id!==id && (state.draft.title || state.draft.body)) {
      modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">替换当前草稿？</h2><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><p>账号中已保存一份草稿。继续编辑这篇文章会替换它，请先保留需要的内容。</p><div class="dialog-actions"><button class="button" data-action="close-modal">保留草稿</button><button class="button danger-button" data-action="edit-post-confirm" data-id="${e(id)}">替换并编辑</button></div>`;modal.showModal();return;
    }
    const editedDraft=normalizeDraft({...article,editing_post_id:article.id});
    await saveDraft(false,editedDraft);if(!sameSession(auth,userId))return;modal.close();draftDirty=false;location.hash='/write';
  } else if(action==='confirm-delete') {await request(`/posts/${id}`,{method:'DELETE'});if(!sameSession(auth,userId))return;modal.close();await refreshCommunity();location.hash='/profile';toast('文章已删除');}
  else if(action==='delete-comment'){await request(`/comments/${id}`,{method:'DELETE'});await route();toast('评论已删除');}
  else if(action==='moderate-post' || action==='feature-post') {
    const article=state.admin.posts.find(a=>a.id===id);
    await request(`/admin/posts/${id}`,{method:'PATCH',body:{status:action==='feature-post'?article?.status:value,...(action==='feature-post'?{pick:value==='true'}:{}),expected_updated_at:article?.updated_at}});if(!sameSession(auth,userId))return;await loadAdmin();toast('文章状态已更新');
  } else if(action==='moderate-comment'){await request(`/admin/comments/${id}`,{method:'PATCH',body:{status:value}});await loadAdmin();toast('评论状态已更新');}
  else if(action==='moderate-user'){await request(`/admin/users/${id}`,{method:'PATCH',body:{banned:value==='ban'}});await loadAdmin();toast('账号状态已更新');}
  if(sameSession(auth,userId))render();
}

/** 处理页面点击，云端失败保留原数据并明确反馈。
 * Args:
 *   event: 点击事件。
 * Returns:
 *   处理完成的 Promise。
 */
async function handleClick(event) {
  if((state.publishing || state.authTransition) && event.target.closest('a,button,input')){event.preventDefault();return;}
  if(event.target.closest('.skip-link')){event.preventDefault();document.querySelector('#main')?.focus();document.querySelector('#main')?.scrollIntoView();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  event.preventDefault();const {action,id,value}=target.dataset;
  const operationKey=`${authRevision}:${['feature-post','moderate-post'].includes(action)?'post':action}:${id || ''}`;
  if(inFlight.has(operationKey))return;
  inFlight.add(operationKey);
  try {
    if(action==='category')chooseCategory(value);
    else if(action==='reset'){state.category='all';state.query='';state.feed='discover';state.limit=6;if(state.route==='home')render();else location.hash='/';}
    else if(action==='sort'){state.sort=value;render();}
    else if(action==='feed'){state.feed=value;state.limit=6;render();}
    else if(action==='load'){state.limit+=6;render();}
    else if(action==='tag'){state.category='all';state.query=value;state.feed='discover';if(state.route==='home')render();else location.hash='/';}
    else if(action==='rotate-authors'){state.authorOffset=state.authorOffset+3>=state.authors.length?0:state.authorOffset+3;render();}
    else if(action==='section')document.getElementById(value)?.scrollIntoView({behavior:'smooth'});
    else if(action==='comments')document.querySelector('#comments')?.scrollIntoView({behavior:'smooth'});
    else if(action==='top')window.scrollTo({top:0,behavior:'smooth'});
    else if(action==='share'){await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/article/${state.routeId}`);toast('文章链接已复制；待审核文章仅作者和管理员可见。');}
    else if(action==='save-draft'){target.disabled=true;await saveDraft();target.disabled=false;}
    else if(action==='edit-mode'){state.draft=readDraftForm();state.editorMode=value;render();}
    else if(action==='open-search')openSearch();
    else if(action==='edit-profile')editProfile();
    else if(action==='delete-post' && requireUser())confirmDelete(id);
    else if(action==='close-modal')modal.close();
    else if(action==='admin-tab'){state.adminTab=value;render();}
    else if(action==='remove-cover' && requireUser()){state.draft={...readDraftForm(),cover_path:'',coverUrl:''};draftDirty=true;draftRevision++;await saveDraft(false);render();}
    else if(action==='clear-draft' && requireUser()){
      modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">清空当前草稿？</h2><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><p>将清空账号中保存的这份草稿，已提交的文章不受影响。</p><div class="dialog-actions"><button class="button" data-action="close-modal">保留草稿</button><button class="button danger-button" data-action="confirm-clear-draft">确认清空</button></div>`;modal.showModal();
    }
    else if(action==='confirm-clear-draft' && requireUser()){
      clearTimeout(draftTimer);draftRevision++;state.publishing=true;
      const controls=[...document.querySelectorAll('#editor-form input,#editor-form textarea,#editor-form select,#editor-form button')];controls.forEach(control=>{control.disabled=true;});
      try {await saveDraft(false,normalizeDraft());publishAttempt=null;modal.close();render();toast('云端草稿已清空');}finally {state.publishing=false;controls.forEach(control=>{control.disabled=false;});}
    }
    else if(action==='retry-service')await bootstrap();
    else {target.disabled=true;if(action==='logout')state.authTransition=true;await cloudAction(action,id,value);}
  } catch(error){
    if(error.code==='LOGOUT_UNCONFIRMED'){clearSession();location.hash='/';render();}
    toast(error.message);
  }
  finally{if(action==='logout')state.authTransition=false;inFlight.delete(operationKey);if(target.isConnected)target.disabled=false;}
}

/** 打开手机搜索窗口。
 * Returns:
 *   无返回值。
 */
function openSearch() {
  modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">发现感兴趣的内容</h2><button data-action="close-modal" class="icon-button" aria-label="关闭">${icon('close')}</button></div><form id="mobile-search-form"><label>文章、作者或标签<input name="q" required maxlength="100" value="${e(state.query)}" placeholder="输入你感兴趣的关键词"></label><button class="button primary" type="submit">搜索文章</button></form>`;modal.showModal();
}

/** 处理邮箱注册、登录、确认与密码恢复。
 * Args:
 *   form: 账号表单。
 *   data: 表单数据。
 * Returns:
 *   处理完成的 Promise。
 */
async function submitAuth(form,data) {
  const mode=form.dataset.mode;
  const password=String(data.get('password') || '');
  if(['register','reset'].includes(mode) && password!==data.get('confirmPassword'))throw new Error('两次输入的密码不一致。');
  if(['login','confirm','reset'].includes(mode)){await draftQueue.catch(()=>{});authRevision++;personalRevision++;}
  let result;
  if(mode==='confirm') {
    if(!state.authToken)throw new Error('确认链接缺少验证信息，请重新申请邮件。');
    result=await request('/auth/confirm',{method:'POST',body:{token_hash:state.authToken,type:state.authType}});
    state.authToken='';await refreshCommunity();if(!state.user){location.replace('#/login');toast('邮件已验证，但浏览器未保存登录状态。请使用新版浏览器重新登录。');return;}location.replace(state.authType==='recovery'?'#/reset':'#/profile');toast('邮箱验证成功');return;
  }
  const body=mode==='register'?{email:String(data.get('email')).trim(),password,name:String(data.get('name')).trim()}:mode==='forgot'?{email:String(data.get('email')).trim()}:mode==='reset'?{password,...(data.get('currentPassword')?{currentPassword:String(data.get('currentPassword'))}:{})}:{email:String(data.get('email')).trim(),password};
  result=await request(`/auth/${mode==='register'?'signup':mode}`,{method:'POST',body});
  if(mode==='login'){await refreshCommunity();if(!state.user)throw new Error('浏览器未保存登录状态，请使用支持分区 Cookie 的新版浏览器，并允许本站保存数据。');const destination=state.afterAuth || '#/profile';state.afterAuth='';location.hash=destination;toast('欢迎回来，继续探索吧。');return;}
  if(mode==='reset'){state.authType='email';await refreshCommunity();location.hash='/login';toast(result.message || '密码已更新，请使用新密码登录。');return;}
  state.authMessage=result.message || (mode==='register'?'如邮箱可用于注册，请前往邮箱完成验证。':'如邮箱已注册，将收到密码重置邮件。');
  const message=document.querySelector('#auth-message');if(message){message.textContent=state.authMessage;message.focus();}
  form.querySelectorAll('input[type="password"]').forEach(input=>{input.value='';});
}

/** 统一处理表单提交和失败提示。
 * Args:
 *   event: 提交事件。
 * Returns:
 *   提交完成的 Promise。
 */
async function handleSubmit(event) {
  const form=event.target;if(!['search-form','mobile-search-form','editor-form','profile-form','comment-form','auth-form'].includes(form.id))return;
  event.preventDefault();if(state.busy || state.authTransition)return;
  if(state.uploading && ['editor-form','profile-form'].includes(form.id)){toast('图片正在上传，请完成后再提交。');return;}
  const data=new FormData(form),button=form.querySelector('[type="submit"]');
  const auth=authRevision,userId=state.user?.id;
  state.busy=true;if(button)button.disabled=true;
  if(form.id==='auth-form')state.authTransition=true;
  const editorControls=form.id==='editor-form'?[...form.querySelectorAll('input,textarea,select,button')]:[];
  if(form.id==='editor-form'){state.publishing=true;editorControls.forEach(control=>{control.disabled=true;});}
  try {
    if(['search-form','mobile-search-form'].includes(form.id)){if(modal.open)modal.close();state.query=String(data.get('q')).trim();state.category='all';state.feed='discover';state.limit=6;if(state.route==='home'){render();document.querySelector('#feed')?.scrollIntoView({behavior:'smooth'});}else location.hash='/';}
    else if(form.id==='auth-form')await submitAuth(form,data);
    else if(form.id==='editor-form')await publishArticle();
    else if(requireUser() && form.id==='profile-form'){await request('/profile',{method:'PUT',body:{name:String(data.get('name')).trim(),bio:String(data.get('bio')).trim(),avatar_path:state.profile.avatar_path || null}});if(!sameSession(auth,userId))return;modal.close();await syncPersonal();render();toast('个人资料已更新');}
    else if(requireUser() && form.id==='comment-form'){
      const body=String(data.get('comment')).trim(),key=`${userId}:${form.dataset.id}`;
      const attempt=attemptFor(commentAttempts.get(key),body);commentAttempts.set(key,attempt);
      await request(`/posts/${form.dataset.id}/comments`,{method:'POST',body:{body,requestId:attempt.id}});
      if(!sameSession(auth,userId))return;
      commentAttempts.delete(key);if(form.isConnected){await route();document.querySelector('#comments')?.scrollIntoView();}toast('评论已发布');
    }
  } catch(error){const message=form.id==='auth-form'?document.querySelector('#auth-message'):null;if(message){message.textContent=error.message;message.focus();}else toast(error.message);}
  finally{state.busy=false;state.publishing=false;if(form.id==='auth-form')state.authTransition=false;editorControls.forEach(control=>{control.disabled=false;});if(button?.isConnected)button.disabled=false;}
}

/** 处理图片选择并上传，上传后保留编辑器输入。
 * Args:
 *   input: 图片文件输入框。
 * Returns:
 *   上传完成的 Promise。
 */
async function uploadImage(input) {
  if(!requireUser() || !input.files[0])return;
  if(state.uploading){toast('已有图片正在上传，请稍候。');input.value='';return;}
  input.disabled=true;state.uploading=true;
  const userId=state.user.id,auth=authRevision,page=routeRevision,editingId=state.draft.editing_post_id;
  try {
    const payload=await imagePayload(input.files[0]);const result=await request('/uploads',{method:'POST',body:payload});
    if(!sameSession(auth,userId) || page!==routeRevision || editingId!==state.draft.editing_post_id || !input.isConnected)throw new Error('页面或登录状态已变化，请重新选择图片。');
    if(input.id==='avatar-upload'){state.profile={...state.profile,avatar_path:result.path,avatarUrl:result.url};toast('头像已上传，点击保存资料即可应用。');}
    else {state.draft={...readDraftForm(),cover_path:result.path,coverUrl:result.url};draftDirty=true;draftRevision++;await saveDraft(false);render();toast('文章封面已上传');}
  } catch(error){toast(error.message);}finally{state.uploading=false;input.disabled=false;input.value='';}
}

/** 更新字数和云端自动保存状态。
 * Args:
 *   event: 输入事件。
 * Returns:
 *   无返回值。
 */
function handleInput(event) {
  if(state.publishing)return;
  if(!event.target.closest('#editor-form') || event.target.type==='file')return;
  state.draft=readDraftForm();draftDirty=true;draftRevision++;
  const count=document.querySelector('#word-count');if(count)count.textContent=`${state.draft.body.length} 字`;
  const label=document.querySelector('#draft-status');if(label)label.textContent='修改尚未保存';
  clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraft(false).catch(error=>{if(label?.isConnected)label.textContent='保存失败，请重试';toast(error.message);}),1500);
}

/** 支持快速搜索键，避免覆盖表单输入。
 * Args:
 *   event: 键盘事件。
 * Returns:
 *   无返回值。
 */
function handleKeyboard(event) {
  if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !modal.open){event.preventDefault();const search=document.querySelector('#global-search');if(search?.offsetParent)search.focus();else openSearch();}
}

document.addEventListener('click',handleClick);
document.addEventListener('submit',handleSubmit);
document.addEventListener('input',handleInput);
document.addEventListener('change',event=>{if(['cover-upload','avatar-upload'].includes(event.target.id))uploadImage(event.target);else handleInput(event);});
document.addEventListener('keydown',handleKeyboard);
window.addEventListener('hashchange',()=>route().catch(error=>toast(error.message)));
window.addEventListener('beforeunload',event=>{if(draftDirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('scroll',()=>document.querySelector('.back-top')?.classList.toggle('show',window.scrollY>500),{passive:true});
modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
route();bootstrap();
