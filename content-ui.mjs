import { categories } from './data.mjs';
import { escapeHtml as e, renderMarkdown, extractHeadings, safeMediaUrl } from './lib.mjs';
import { icon, avatar, authorFor, articleCard, empty } from './ui.mjs';

/** 将内容状态转换为对作者可读的文字。
 * Args:
 *   status: 内容状态。
 * Returns:
 *   状态说明。
 */
function statusName(status) {return ({draft:'草稿',pending:'待审核',published:'已发布',rejected:'未通过审核',hidden:'已隐藏'})[status] || '待审核';}

/** 生成真实云端文章阅读页。
 * Args:
 *   state: 当前文章、账号及评论数据。
 * Returns:
 *   文章、目录和评论区。
 */
export function articleView(state) {
  const a=state.allArticles.find(article=>article.id===state.routeId);
  if(!a)return empty('这篇文章暂时不在这里','文章可能尚未公开，或已被作者删除。');
  const author=authorFor(state,a.author),mine=state.user?.id===a.author;
  const liked=state.liked.includes(a.id),saved=state.saved.includes(a.id),published=a.status==='published';
  const headings=extractHeadings(a.body),comments=state.comments[a.id] || [];
  return `<div class="reading-layout"><div class="reading-actions"><a href="#/" aria-label="返回首页">${icon('compass')}</a><button data-action="like" data-id="${e(a.id)}" class="${liked?'is-active':''}" aria-label="${liked?'取消点赞':'点赞'}" aria-pressed="${liked}" ${!published?'disabled':''}>${icon('heart')}<small>${a.likes}</small></button><button data-action="save" data-id="${e(a.id)}" class="${saved?'is-active':''}" aria-label="${saved?'取消收藏':'收藏'}" aria-pressed="${saved}" ${!published?'disabled':''}>${icon('bookmark')}</button><button data-action="share" aria-label="复制文章链接">${icon('share')}</button><a href="#comments" data-action="comments" aria-label="前往评论">${icon('comment')}</a></div>
    <article class="reading-article"><a href="#/" class="back-link">← 返回发现</a>
    ${!published?`<aside class="post-status-notice"><strong>${statusName(a.status)}</strong><p>这篇文章尚未公开，仅作者和管理员可以查看。${mine?(a.status==='hidden'?'文章已被管理员隐藏，暂时无法修改。':'你可以修改后重新提交审核。'):''}</p></aside>`:''}
    <div class="reading-tags">${a.tags.map(tag=>`<button data-action="tag" data-value="${e(tag)}">${e(tag)}</button>`).join('')}</div><h1>${e(a.title)}</h1>
    <div class="reading-byline"><a href="#/author/${e(author.id)}">${avatar(author)}<span><strong>${e(author.name)}</strong><small>${e(a.date)} · ${a.read} 分钟阅读</small></span></a>${mine?'<a class="button small-button" href="#/profile">我的创作</a>':`<button class="button small-button" data-action="follow" data-id="${e(author.id)}" aria-pressed="${state.following.includes(author.id)}">${state.following.includes(author.id)?'已关注':'+ 关注作者'}</button>`}</div>
    ${mine?`<div class="post-owner-actions">${a.status!=='hidden'?`<button data-action="edit-post" data-id="${e(a.id)}">${icon('pen')}编辑文章</button>`:''}<button data-action="delete-post" data-id="${e(a.id)}">删除文章</button></div>`:''}
    ${safeMediaUrl(a.coverUrl)?`<img class="reading-cover" src="${e(safeMediaUrl(a.coverUrl))}" alt="文章封面" loading="lazy">`:''}
    <div class="article-lead">${e(a.excerpt)}</div><div class="prose">${renderMarkdown(a.body)}</div>
    <div class="article-ending"><span>✳</span><p>感谢阅读，期待下一次灵感相遇。</p><button class="button ${liked?'primary':''}" data-action="like" data-id="${e(a.id)}" ${!published?'disabled':''}>${icon('heart')}${liked?'已点赞':'喜欢这篇文章'} · ${a.likes}</button></div>
    <section class="comments-section" id="comments"><h2>交流一下 <small>${a.comments} 条评论</small></h2>
    ${!published?'<p class="muted">文章公开后，大家就能在这里交流。</p>':!state.user?'<p class="comment-login"><a href="#/login">登录</a>后，写下你的想法。</p>':state.banned?'<p class="muted">账号当前受到限制，暂时无法评论。</p>':`<form id="comment-form" data-id="${e(a.id)}"><label class="sr-only" for="comment-text">写下你的想法</label><textarea id="comment-text" name="comment" required minlength="2" maxlength="2000" placeholder="读完之后，你有什么想法？"></textarea><button class="button primary" type="submit">发布评论 ${icon('arrow')}</button></form>`}
    ${comments.map(c=>`<div class="comment-item">${avatar({color:'sage',initials:(c.name || '用').slice(0,1)},true)}<div><strong>${e(c.name || '社区用户')}</strong><small>${e(c.date)}</small><p>${e(c.body)}</p>${state.user?.id===c.author?`<button class="comment-delete" data-action="delete-comment" data-id="${e(c.id)}">删除</button>`:''}</div></div>`).join('')}</section></article>
    <aside class="reading-aside"><section class="panel reading-author">${avatar(author)}<h3>${e(author.name)}</h3><p>${e(author.bio || '保持好奇，持续创造。')}</p><div><strong>${author.posts ?? state.allArticles.filter(post=>post.author===author.id && post.status==='published').length}<small>文章</small></strong><strong>${author.followers || 0}<small>关注者</small></strong></div></section>
    <nav class="toc panel" aria-label="文章目录"><h3>文章目录</h3>${headings.map((heading,i)=>`<a href="#section-${i}" data-action="section" data-value="section-${i}">${e(heading.replace(/^#{1,3} /,''))}</a>`).join('')}</nav>${state.isAdmin?'<a class="button" href="#/admin">内容管理 →</a>':''}<p class="aside-footer">给思考留一点空间。<br>栈外 · BEYOND THE STACK</p></aside></div>`;
}

/** 生成作者主页和自己的创作管理页。
 * Args:
 *   state: 当前作者和已授权文章数据。
 * Returns:
 *   个人资料、文章和关注列表。
 */
export function profileView(state) {
  const mine=state.route==='profile' || state.routeId==='me' || state.routeId===state.user?.id;
  const id=mine?state.user?.id:state.routeId;
  const author=authorFor(state,id);
  if(!id || !state.authors.some(item=>item.id===id))return empty('暂时没有找到这位创作者','从发现开始，认识认真分享的人。');
  const list=state.allArticles.filter(a=>a.author===id && (mine || a.status==='published'));
  return `<section class="profile-hero"><div class="profile-hero-art" aria-hidden="true">✳</div>${avatar(author)}<div><span class="eyebrow dark">${mine?'MY LITTLE CORNER':'CREATOR / 栈外创作者'}</span><h1>${e(author.name)}</h1><p>${e(author.bio || '保持好奇，持续创造。')}</p><div class="profile-stats"><span><b>${list.length}</b> 文章</span>${mine?`<a href="#/saved"><b>${state.saved.length}</b> 收藏</a><span><b>${state.following.length}</b> 关注</span>`:`<span><b>${author.followers || 0}</b> 关注者</span>`}</div></div><button class="button ${mine?'':'primary'}" data-action="${mine?'edit-profile':'follow'}" data-id="${e(author.id)}">${mine?'编辑资料':state.following.includes(author.id)?'已关注':'+ 关注'}</button></section>
    ${mine?`<div class="profile-tools"><span>${e(state.user.email)}</span>${state.isAdmin?'<a href="#/admin">内容管理</a>':''}<a href="#/reset">修改密码</a><button data-action="logout">退出登录</button></div>`:''}
    <div class="profile-content"><div class="section-heading"><h2>${mine?'我的创作':'TA 的文章'} <span>ARTICLES</span></h2>${mine?'<a class="text-link" href="#/write">写一篇新文章 ↗</a>':''}</div>
    ${mine && (state.draft.body || state.draft.title)?`<a class="draft-resume" href="#/write">${icon('pen')}<span><strong>${e(state.draft.title || '未命名草稿')}</strong><small>云端草稿 · 继续创作</small></span>${icon('arrow')}</a>`:''}
    ${list.length?list.map(a=>articleCard(state,a)).join(''):empty('你的故事，从这里开始','把一次探索、一点经验，写成自己的第一篇文章。')}
    ${mine?`<div class="profile-following"><h2>我关注的创作者</h2>${state.following.length?state.following.map(followId=>{const person=authorFor(state,followId);return `<a href="#/author/${e(followId)}">${avatar(person)}<span>${e(person.name)}</span>${icon('arrow')}</a>`;}).join(''):'<p class="muted">还没有关注创作者，去发现页认识有趣的人吧。</p>'}</div>`:''}</div>`;
}

/** 生成支持云端草稿、封面和审核提交的编辑器。
 * Args:
 *   state: 当前草稿与编辑模式。
 * Returns:
 *   编辑器表单。
 */
export function editorView(state) {
  const draft=state.draft,preview=state.editorMode==='preview';
  if(state.banned)return empty('账号当前受到限制','你仍可以阅读已公开内容，暂时无法提交文章。');
  return `<section class="editor-shell"><div class="editor-heading"><div><span class="eyebrow dark">WRITE SOMETHING GOOD</span><h1>让想法，落在纸上。</h1></div><a class="back-link" href="#/profile">我的创作 ${icon('arrow')}</a></div>
    <div class="editor-notice">${icon('book')}草稿会自动保存到账号。文章提交后进入审核，通过后向所有人公开。图片上传后可公开访问。</div>
    <form id="editor-form" novalidate><div class="editor-toolbar"><div class="editor-tabs"><button type="button" data-action="edit-mode" data-value="edit" class="${!preview?'active':''}">写作</button><button type="button" data-action="edit-mode" data-value="preview" class="${preview?'active':''}">预览</button></div><div><button type="button" class="button" data-action="clear-draft">清空草稿</button><span id="draft-status">${draft.updated?'已恢复云端草稿':'写下你的第一句话'}</span><button type="button" class="button" data-action="save-draft">保存草稿</button><button class="button primary" type="submit">提交审核 ${icon('arrow')}</button></div></div>
    <div class="editor-fields ${preview?'hidden':''}"><label class="sr-only" for="article-title">文章标题</label><input id="article-title" name="title" class="editor-title" required maxlength="120" placeholder="给你的文章起个好标题…" value="${e(draft.title)}">
    <div class="editor-settings"><label>分类 <select name="category" id="article-category">${categories.filter(c=>c.id!=='all').map(c=>`<option value="${c.id}" ${draft.category===c.id?'selected':''}>${c.name}</option>`).join('')}</select></label><label>标签 <input name="tags" id="article-tags" placeholder="用逗号分隔，最多 5 个" maxlength="120" value="${e(draft.tags)}"></label></div>
    <div class="editor-media">${safeMediaUrl(draft.coverUrl)?`<img class="editor-cover-thumb" src="${e(safeMediaUrl(draft.coverUrl))}" alt="当前文章封面">`:''}<label class="upload-label">${icon('pen')}${draft.cover_path?'更换文章封面':'上传文章封面'}<input type="file" id="cover-upload" accept="image/jpeg,image/png,image/webp"></label><span>JPG / PNG / WebP · 不超过 2 MB</span>${draft.cover_path?'<small>封面已保存</small><button type="button" data-action="remove-cover">移除封面</button>':''}</div>
    <label class="sr-only" for="article-body">正文</label><textarea id="article-body" name="body" required minlength="20" maxlength="50000" placeholder="分享你的经验、思考，或者一个有趣的发现。&#10;&#10;支持简单 Markdown：&#10;## 小标题&#10;- 列表&#10;> 引用&#10;代码块用三个反引号包围">${e(draft.body)}</textarea></div>
    <div class="editor-preview prose ${preview?'':'hidden'}"><h1>${e(draft.title || '未命名文章')}</h1>${draft.body?renderMarkdown(draft.body):'<p class="muted">写下正文后，在这里预览你的文章。</p>'}</div>
    <div class="editor-bottom"><span>${draft.editing_post_id?'编辑已有文章 · 重新提交后将再次审核':'云端保留一份当前草稿'} · 支持标题、列表、引用与代码块</span><span id="word-count">${draft.body.length} 字</span></div></form></section>`;
}
