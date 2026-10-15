import { categories, topics } from './data.mjs';
import { escapeHtml as e, selectArticles, safeMediaUrl } from './lib.mjs';

const paths = {
  logo:'m4 8 8-5 8 5-8 5z M4 13l8 5 8-5 M4 18l8 5 8-5',
  search:'m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow:'M4 12h16m-6-6 6 6-6 6', up:'m6 14 6-6 6 6',
  pen:'m15 5 4 4 M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15z',
  compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 8l-3 5-5 3 3-5z',
  code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
  server:'M4 3h16v7H4z M4 14h16v7H4z M7 6h.01 M7 17h.01',
  sparkles:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  terminal:'M3 4h18v16H3z m4 4 4 4-4 4 m7 0h4',
  coffee:'M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M16 8h2a3 3 0 0 1 0 6h-2 M7 2v2m5-2v2',
  bookmark:'M6 3h12v19l-6-4-6 4z', heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  comment:'M21 11a8.5 8.5 0 0 1-9 9 10 10 0 0 1-4-1l-6 2 2-6a10 10 0 0 1-1-4 9 9 0 0 1 18 0z',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  check:'m5 12 4 4L19 6', calendar:'M4 5h16v16H4z M8 2v6m8-6v6 M4 10h16',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 21v-2a4 4 0 0 0-3-4 M16 3a4 4 0 0 1 0 8',
  close:'m6 6 12 12M6 18 18 6', menu:'M3 6h18M3 12h18M3 18h18',
  sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  share:'M18 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6 M18 22a3 3 0 1 1 0-6 3 3 0 0 1 0 6 M6 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6 M9 10l6-4M9 14l6 4',
  book:'M3 3h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v17h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3z M12 5v17',
};

/** 生成统一线性图标。
 * Args:
 *   name: 图标名称。
 * Returns:
 *   隐藏于辅助技术的 SVG。
 */
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.code}"/></svg>`;
}

/** 格式化浏览量。
 * Args:
 *   n: 数量。
 * Returns:
 *   紧凑数量文本。
 */
export function count(n) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }

/** 从云端作者列表查找作者，仅将本人标识映射为当前账号。
 * Args:
 *   state: 页面状态。
 *   id: 作者标识。
 * Returns:
 *   作者对象。
 */
export function authorFor(state,id) {
  const authorId=id==='me'?state.user?.id:id;
  if(state.user && authorId===state.user.id) {
    const profile=state.profile || {};
    return {...profile,id:state.user.id,name:profile.name || '社区用户',initials:[...(profile.name || '用')][0],color:'sage',bio:profile.bio || '',role:'创作者',followers:profile.followers || 0};
  }
  return state.authors.find(a=>a.id===authorId) || {id:authorId || '',name:'社区用户',initials:'用',color:'sage',bio:'',role:'创作者',followers:0};
}

/** 生成作者头像。
 * Args:
 *   author: 作者对象。
 *   small: 是否缩小。
 * Returns:
 *   头像标记。
 */
export function avatar(author,small=false) {
  const src=safeMediaUrl(author.avatarUrl);
  return src ? `<img class="avatar admin-media-avatar ${small?'small':''}" src="${e(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="avatar ${e(author.color || 'sage')} ${small?'small':''}" aria-hidden="true">${e(author.initials || [...(author.name || '用')][0])}</span>`;
}

/** 生成网站导航。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   页头标记。
 */
export function header(state) {
  const route=state.route;
  return `<header class="site-header"><div class="header-inner">
    <a class="brand" href="#/" aria-label="栈外首页"><span class="brand-icon">${icon('logo')}</span><strong>栈外<span>ZHANWAI</span></strong></a>
    <nav class="top-nav" aria-label="主导航"><a class="${route==='home'?'active':''}" href="#/">发现</a><a class="${route==='topics'?'active':''}" href="#/topics">专题</a><a class="${route==='weekly'?'active':''}" href="#/weekly">栈外周刊<span class="nav-dot"></span></a></nav>
    <form id="search-form" class="search-box" role="search"><label class="sr-only" for="global-search">搜索文章、作者或标签</label>${icon('search')}<input id="global-search" name="q" placeholder="搜索感兴趣的内容…" value="${e(state.query)}" autocomplete="off" maxlength="100"><kbd>/</kbd></form>
    <button class="mobile-search-button" data-action="open-search" aria-label="搜索文章">${icon('search')}</button><a class="write-button" aria-label="写文章" href="#/write">${icon('pen')}<span>写文章</span></a>${state.user?`<a class="profile-button" href="#/profile" aria-label="我的主页">${avatar(authorFor(state,'me'))}</a>`:'<a class="account-nav-login" href="#/login">登录</a>'}
  </div></header>`;
}

/** 选取已发布的编辑精选；尚无精选时使用最新文章。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   最多四篇真实的周刊文章。
 */
function weeklyArticles(state) {
  const published=state.allArticles.filter(a=>a.status==='published');
  const picks=published.filter(a=>a.pick);
  return [...(picks.length?picks:published)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
}

/** 生成首页主视觉。
 * Args:
 *   state: 页面状态，包含真实文章列表。
 * Returns:
 *   带原创几何插画的专题入口。
 */
export function hero(state) {
  const picks=weeklyArticles(state);
  return `<section class="hero-grid" aria-label="本周精选"><div class="hero-main">
    <div class="hero-copy"><span class="eyebrow"><i></i> 好奇心，是最好的起点</span><h1>让每一次探索，<br>都有<span>回响。</span></h1><p>在代码与生活之间，发现值得分享的好想法。<br>与认真创造的人，一起把热爱写下来。</p><a class="hero-link" href="#/topics">发现你的灵感 ${icon('arrow')}</a></div>
    <div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="art-star star-one">✳</span><span class="art-star star-two">✦</span><div class="art-window"><div class="window-bar"><i></i><i></i><i></i><span>hello, world.</span></div><div class="window-code"><span class="line-number">01</span><span class="code-purple">const</span> curiosity = <span class="code-yellow">true</span>;<br><span class="line-number">02</span><br><span class="line-number">03</span><span class="code-purple">while</span> (curiosity) {<br><span class="line-number">04</span>&nbsp;&nbsp;explore();<br><span class="line-number">05</span>&nbsp;&nbsp;create();<br><span class="line-number">06</span>&nbsp;&nbsp;<span class="code-yellow">share</span>();<br><span class="line-number">07</span>}</div></div><div class="art-label"><span>↗</span> Keep building.<small>Keep becoming.</small></div><span class="art-spark">+</span></div>
    <span class="hero-issue">A SPACE FOR CURIOUS MINDS</span>
    </div><a class="hero-side" href="#/weekly"><div class="side-heading"><span>栈外周刊 / 持续更新</span>${icon('arrow')}</div><h2>慢一点，<br>想深一点。</h2><p>在快速变化的世界里，<br>找回专注创造的节奏。</p><div class="sculpture" aria-hidden="true"><i class="sculpture-ball"></i><i class="sculpture-arch"></i><i class="sculpture-step"></i><i class="sculpture-dot"></i><div class="sculpture-floor"></div></div><span class="side-bottom">${picks.length ? `${picks.length} 篇值得读的文章` : '阅读清单，等待你的分享'} ${icon('arrow')}</span></a></section>`;
}

/** 生成分类侧栏。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   可交互分类导航。
 */
export function sidebar(state) {
  const visibleSaved=state.user?state.allArticles.filter(a=>a.status==='published' && state.saved.includes(a.id)).length:0;
  return `<aside class="left-sidebar"><p class="section-label">探索社区 <span>EXPLORE</span></p><nav class="category-nav" aria-label="文章分类">${categories.map(c=>`<button data-action="category" data-value="${c.id}" class="category-button ${state.category===c.id && state.route==='home'?'selected':''}" ${state.category===c.id && state.route==='home'?'aria-current="page"':''}>${icon(c.icon)}${c.name}${c.id==='all'?'<span class="tiny-dot"></span>':''}</button>`).join('')}</nav><div class="sidebar-divider"></div><a class="sidebar-link ${state.route==='saved'?'selected':''}" href="#/saved">${icon('bookmark')}我的收藏<span>${visibleSaved || ''}</span></a><a class="sidebar-link" href="#/profile">${icon('users')}我的关注<span>${state.following.length || ''}</span></a><a class="sidebar-note" href="#/write"><span class="note-symbol">✳</span><strong>好想法，值得被看见</strong><p>记录思考，分享经验，<br>从你的第一篇文章开始。</p><span>开始创作 ${icon('arrow')}</span></a><div class="left-footer"><span>保持好奇，持续创造。</span><br>© 2026 栈外 Zhanwai</div></aside>`;
}

/** 生成文章封面图形。
 * Args:
 *   kind: 封面样式名称。
 *   coverUrl: 真实封面媒体地址。
 * Returns:
 *   装饰封面标记。
 */
export function cover(kind,coverUrl='') {
  const src=safeMediaUrl(coverUrl);
  if(src)return `<img class="article-cover admin-media-cover" src="${e(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  const labels={craft:['THE LITTLE','DETAILS','✳'],ai:['BUILD','WITH AI','⌘'],grid:['CSS','GRID','▦'],system:['SMALL','SYSTEMS','⌘'],tools:['LESS,','BUT BETTER','↗'],life:['MAKE','SOMETHING','☼'],design:['ROOM TO','BREATHE','◒']};
  const label=Object.hasOwn(labels,kind)?labels[kind]:labels.craft;
  return `<div class="article-cover cover-${Object.hasOwn(labels,kind)?kind:'craft'}" aria-hidden="true"><span>${label[0]}<br>${label[1]}</span><b>${label[2]}</b><i></i></div>`;
}

/** 生成文章卡片。
 * Args:
 *   state: 页面状态。
 *   a: 文章对象。
 * Returns:
 *   文章列表项。
 */
export function articleCard(state,a) {
  const author=authorFor(state,a.author), liked=state.liked.includes(a.id), saved=state.saved.includes(a.id);
  const unpublished=a.status!=='published';
  const status=({pending:'待审核',rejected:'未通过',hidden:'已隐藏',draft:'草稿'})[a.status] || '待审核';
  return `<article class="article-card"><div class="article-byline"><a href="#/author/${encodeURIComponent(author.id)}">${avatar(author,true)}<span>${e(author.name)}</span></a><span class="byline-divider">·</span><time datetime="${e(a.date)}">${e(a.date)}</time>${unpublished?`<span class="admin-status">${status}</span>`:a.pick?'<span class="editor-pick">编辑精选</span>':''}</div><div class="article-content"><div class="article-copy"><a class="article-title" href="#/article/${encodeURIComponent(a.id)}"><h2>${e(a.title)}</h2></a><p class="article-excerpt">${e(a.excerpt)}</p><div class="article-meta"><button class="metric ${liked?'is-active':''}" data-action="like" data-id="${e(a.id)}" aria-label="${liked?'取消点赞':'点赞'}：${e(a.title)}" aria-pressed="${liked}" ${unpublished?'disabled':''}>${icon('heart')}${count(a.likes)}</button><a href="#/article/${encodeURIComponent(a.id)}?comments">${icon('comment')}${count(a.comments)}</a><div class="article-tags">${a.tags.slice(0,2).map(t=>`<button data-action="tag" data-value="${e(t)}">${e(t)}</button>`).join('')}</div></div></div><a class="cover-link" href="#/article/${encodeURIComponent(a.id)}" tabindex="-1" aria-hidden="true">${cover(a.cover,a.coverUrl)}</a></div><button class="card-save ${saved?'is-active':''}" data-action="save" data-id="${e(a.id)}" aria-label="${saved?'取消收藏':'收藏'}：${e(a.title)}" aria-pressed="${saved}" ${unpublished?'disabled':''}>${icon('bookmark')}</button></article>`;
}

/** 生成右侧社区推荐。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   签到、热榜和作者列表。
 */
export function rightSidebar(state) {
  const checked=state.checkin===new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
  const published=state.allArticles.filter(a=>a.status==='published');
  const publishedAuthors=new Set(published.map(a=>a.author));
  const authors=state.authors.filter(a=>publishedAuthors.has(a.id));
  const suggestions=authors.filter(a=>a.id!==state.user?.id);
  return `<aside class="right-sidebar"><section class="checkin-card"><div class="checkin-top"><span class="sun-icon">${icon('sun')}</span><div><h3>今天也要保持好奇</h3><p>每一次到来，都是新的开始。</p></div></div><button class="checkin-button ${checked?'checked':''}" data-action="checkin" ${checked?'disabled':''}>${icon(checked?'check':'calendar')}${checked?'今日已签到':'每日签到'}<span>${checked?'明天见':'积累一点好习惯'}</span></button></section><section class="panel"><div class="panel-heading"><h3><span class="hot-symbol">↗</span> 社区热读</h3><a href="#/weekly" aria-label="查看社区阅读清单">${icon('arrow')}</a></div>${published.length?`<ol class="hot-list">${[...published].sort((a,b)=>b.likes-a.likes).slice(0,5).map((a,i)=>`<li><span class="rank rank-${i}">0${i+1}</span><a href="#/article/${encodeURIComponent(a.id)}"><strong>${e(a.title)}</strong><small>${count(a.likes)} 次点赞</small></a></li>`).join('')}</ol>`:'<p class="admin-sidebar-empty">还没有公开文章，期待第一份分享。</p>'}</section><section class="panel author-panel"><div class="panel-heading"><h3>值得关注的创作者</h3>${suggestions.length>3?'<button data-action="rotate-authors" aria-label="换一批创作者">换一批 ↻</button>':''}</div>${suggestions.length?suggestions.slice(state.authorOffset%suggestions.length).concat(suggestions.slice(0,state.authorOffset%suggestions.length)).slice(0,3).map(a=>`<div class="author-row"><a class="author-identity" href="#/author/${encodeURIComponent(a.id)}">${avatar(a)}<span><strong>${e(a.name)}</strong><small>${e(a.role || '创作者')}</small></span></a><button class="follow-small ${state.following.includes(a.id)?'following':''}" data-action="follow" data-id="${e(a.id)}" aria-pressed="${state.following.includes(a.id)}">${state.following.includes(a.id)?'已关注':'+ 关注'}</button></div>`).join(''):'<p class="admin-sidebar-empty">创作者发布文章后，会出现在这里。</p>'}</section><section class="topic-mini"><span>灵感话题 <i>DISCUSS</i></span><a href="#/topics"># 你最近做了什么<br>有趣的小东西？ ${icon('arrow')}</a><div class="mini-avatars">${authors.slice(0,3).map(a=>avatar(a,true)).join('')}<span>${authors.length?'来看看大家的灵感':'下一份灵感，或许来自你'}</span></div></section><p class="aside-footer">这里展示社区已发布的真实内容。<br>登录后，收藏与创作可跨设备同步。</p></aside>`;
}

/** 生成通用空状态。
 * Args:
 *   title: 空状态标题。
 *   description: 说明文字。
 * Returns:
 *   可恢复的空页面。
 */
export function empty(title,description) {
  return `<div class="empty-state"><span>✳</span><h2>${e(title)}</h2><p>${e(description)}</p><button class="button primary" data-action="reset">去发现好文章 ${icon('arrow')}</button></div>`;
}

/** 生成首页或收藏文章流。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   首页主要内容。
 */
export function homeView(state) {
  const saved=state.route==='saved';
  const enriched=state.allArticles.filter(a=>a.status==='published').map(a=>({...a,authorName:authorFor(state,a.author).name}));
  let list=selectArticles(enriched,{category:saved?'all':state.category,query:state.query,sort:state.sort,saved:saved?state.saved:null});
  if(state.feed==='following' && !saved) list=list.filter(a=>state.following.includes(a.author));
  const title=saved?'我的收藏':state.query?`搜索「${state.query}」`:categories.find(c=>c.id===state.category)?.name || '发现';
  return `${!saved && !state.query && state.category==='all'?hero(state):''}<div class="content-layout">${sidebar(state)}<section class="feed" id="feed" aria-label="文章列表"><div class="feed-heading">${saved || state.query || state.category!=='all'?`<h1>${e(title)}<small>${list.length} 篇文章</small></h1>`:`<div class="feed-tabs" role="group" aria-label="文章来源"><button data-action="feed" data-value="discover" class="${state.feed==='discover'?'active':''}">为你推荐</button><button data-action="feed" data-value="following" class="${state.feed==='following'?'active':''}">关注</button></div>`}<div class="sort-options" role="group" aria-label="文章排序">${[['recommend','推荐'],['new','最新'],['hot','热门']].map(([id,name])=>`<button data-action="sort" data-value="${id}" class="${state.sort===id?'active':''}" aria-pressed="${state.sort===id}">${name}</button>`).join('')}</div></div>${list.length?list.slice(0,state.limit).map(a=>articleCard(state,a)).join(''):empty(saved?'把喜欢的文章留在这里':state.feed==='following'?'关注创作者，遇见好内容':'还没有找到相关内容',saved?'阅读时点击收藏图标，就能在这里再次找到它。':state.feed==='following'?'从右侧的创作者开始，建立属于你的阅读清单。':'试试其他关键词，或回到推荐看看。')} ${list.length>state.limit?`<button class="load-more" data-action="load">再发现一些好内容 ${icon('arrow')}</button>`:list.length?'<div class="feed-end"><span></span>你已读完，灵感还在继续<span></span></div>':''}</section>${rightSidebar(state)}</div>`;
}

/** 生成专题集合。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   专题页面。
 */
export function topicsView(state) {
  return `<div class="page-intro"><span class="eyebrow dark">COLLECTIONS / 按兴趣探索</span><h1>好内容，值得慢慢读。</h1><p>把零散的灵感，串成更清晰的脉络。找到属于你的下一次探索。</p></div><div class="topics-grid">${topics.map(t=>`<button class="topic-card tone-${t.tone}" data-action="category" data-value="${t.id}"><div class="topic-top"><span>${t.eyebrow}</span>${icon('arrow')}</div><span class="topic-symbol" aria-hidden="true">${t.symbol}</span><h2>${e(t.title)}</h2><p>${e(t.description)}</p><div class="topic-bottom"><div>${t.tags.map(tag=>`<span>${e(tag)}</span>`).join('')}</div><span>${state.allArticles.filter(a=>a.status==='published' && a.category===t.id).length} 篇文章</span></div></button>`).join('')}</div>`;
}

/** 生成周刊页面。
 * Args:
 *   state: 页面状态。
 * Returns:
 *   编辑精选文章页。
 */
export function weeklyView(state) {
  const list=weeklyArticles(state);
  const minutes=list.reduce((total,a)=>total+a.read,0);
  return `<section class="weekly-hero"><div><span class="eyebrow">ZHANWAI WEEKLY / 持续更新</span><h1>慢一点，想深一点。</h1><p>写代码，也关心代码之外的事。<br>从社区的真实分享中，寻找下一次值得深入的探索。</p><span class="weekly-date">${list.length?`最近更新 ${e(list[0].date)}`:'等待第一份创作'} · 栈外阅读清单</span></div><span class="weekly-flower" aria-hidden="true">✳</span></section><div class="weekly-content"><div class="section-heading"><h2>本期阅读清单 <span>THE READING LIST</span></h2><span>${list.length} 篇文章${minutes?` · 约 ${minutes} 分钟`:''}</span></div>${list.length?list.map(a=>articleCard(state,a)).join(''):empty('下一篇好文章，等待你的分享','公开发布的文章将在这里组成阅读清单。')}</div>`;
}

/** 生成页尾。
 * Returns:
 *   网站页尾。
 */
export function footer() {
  return `<footer class="site-footer"><a href="#/" class="footer-brand">${icon('logo')}栈外 <span>BEYOND THE STACK.</span></a><p>技术之外，灵感之内。</p><span>用好奇心连接彼此 © 2026</span></footer>`;
}
