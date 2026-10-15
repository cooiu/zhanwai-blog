import { icon, avatar } from './ui.mjs';
import { escapeHtml as e, renderMarkdown } from './lib.mjs';

/** 生成面向访客的社区服务提示。
 * Args:
 *   state: 社区连接和账号状态。
 * Returns:
 *   提示标记；正常连接时为空字符串。
 */
export function serviceBanner(state) {
  if (state.service === 'ready') return '';
  const message = state.service === 'unconfigured'
    ? '社区服务尚未开通，账号与发布暂不可用。'
    : state.service === 'error'
      ? '社区服务暂时无法连接，请稍后重试。'
      : '正在连接社区服务…';
  return `<aside class="service-banner" role="status">${icon('coffee')}<p>${message}</p>${state.service === 'error' ? '<button type="button" data-action="retry-service">重新连接</button>' : ''}</aside>`;
}

/** 生成一个具有明确标签的账号表单字段。
 * Args:
 *   name: 字段名称。
 *   label: 字段标签。
 *   attributes: 由模块内部提供的固定属性。
 *   hint: 可选的字段说明。
 * Returns:
 *   表单字段标记。
 */
function field(name, label, attributes, hint = '') {
  return `<div class="account-field"><label for="account-${name}">${e(label)}</label><input id="account-${name}" name="${e(name)}" ${attributes}${hint ? ` aria-describedby="account-${name}-hint"` : ''}>${hint ? `<small id="account-${name}-hint">${e(hint)}</small>` : ''}</div>`;
}

/** 生成独立邮箱注册、登录及密码恢复界面。
 * Args:
 *   state: 当前路由、账号及提交状态。
 * Returns:
 *   账号页面标记。
 */
export function authView(state) {
  const route = ['login', 'register', 'forgot', 'reset', 'confirm'].includes(state.route) ? state.route : 'login';
  const copy = {
    login: ['欢迎回到栈外。', '登录后，继续你的阅读与创作。', '登录'],
    register: ['每个好想法，都有起点。', '用邮箱创建账号，开启你的创作旅程。', '创建账号'],
    forgot: ['重新找回你的灵感。', '输入注册邮箱，我们将发送密码重置邮件。', '发送重置邮件'],
    reset: ['为账号设置新密码。', '使用一个独立且足够长的密码，保护你的创作。', '更新密码'],
    confirm: ['再一步，回到社区。', '请确认这是你主动发起的操作，再继续完成邮件验证。', state.authType === 'recovery' ? '继续找回密码' : '确认邮箱'],
  }[route];
  const unavailable = state.service !== 'ready' || state.busy;
  let fields = '';
  if (route === 'register') fields += field('name', '昵称', 'type="text" autocomplete="nickname" required minlength="2" maxlength="20" placeholder="大家该怎么称呼你"');
  if (['login', 'register', 'forgot'].includes(route)) fields += field('email', '邮箱地址', 'type="email" inputmode="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"');
  if (route === 'reset' && state.user && state.authType !== 'recovery') fields += field('currentPassword', '当前密码', 'type="password" autocomplete="current-password" required minlength="1" maxlength="128"', '修改密码前，请先验证当前密码。');
  if (['login', 'register', 'reset'].includes(route)) fields += field('password', route === 'reset' ? '新密码' : '密码', `type="password" autocomplete="${route === 'login' ? 'current-password' : 'new-password'}" required minlength="${route === 'login' ? '1' : '12'}" maxlength="128"`, route === 'login' ? '' : '至少 12 个字符，建议使用多个词语组成的长密码。');
  if (['register', 'reset'].includes(route)) fields += field('confirmPassword', '确认密码', 'type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="再次输入密码"');
  if (route === 'confirm') fields = `<div class="account-confirm">${icon('check')}<p>${state.authType === 'recovery' ? '点击下方按钮验证邮件链接，然后设置新密码。' : '点击下方按钮验证你的邮箱地址。'}如果你没有申请此操作，可以直接关闭本页。</p><small>链接可能已经过期或使用；如验证失败，请重新申请邮件。</small></div>`;
  return `<section class="account-shell" aria-labelledby="account-heading"><aside class="account-story"><a href="#/" class="account-brand">${icon('logo')} 栈外 <span>ZHANWAI</span></a><span class="account-flower" aria-hidden="true">✳</span><h2>让好奇心，<br>有处安放。</h2><p>阅读值得思考的文字，<br>留下属于自己的见解。</p><span class="account-story-foot">A SPACE FOR CURIOUS MINDS</span></aside><div class="account-panel"><a class="account-back" href="#/">← 返回发现</a><span class="account-kicker">YOUR NEXT CHAPTER</span><h1 id="account-heading">${copy[0]}</h1><p class="account-description">${copy[1]}</p>${state.user && route !== 'reset' && route !== 'confirm' ? `<p class="account-session">当前账号：${e(state.user.email)} · <a href="#/profile">查看个人主页</a></p>` : ''}${serviceBanner(state)}<form id="auth-form" class="account-form" data-mode="${route}" aria-busy="${Boolean(state.busy)}">${fields}<p id="auth-message" class="account-message" role="status" aria-live="polite" tabindex="-1">${e(state.authMessage || '')}</p><button type="submit" class="account-submit" ${unavailable ? 'disabled' : ''}>${state.busy ? '正在处理…' : copy[2]}${icon('arrow')}</button></form>${route === 'login' ? '<div class="account-links"><a href="#/forgot">忘记密码？</a><span>还没有账号？<a href="#/register">立即注册</a></span></div>' : `<div class="account-links"><span>${route === 'register' ? '已经有账号？' : '记起密码了？'}<a href="#/login">返回登录</a></span>${route === 'confirm' ? `<a href="#/${state.authType === 'recovery' ? 'forgot' : 'register'}">重新申请邮件</a>` : ''}</div>`}<p class="account-footnote">${route === 'register' ? '注册后，请前往邮箱完成验证，再登录社区。' : '使用独立邮箱账号，阅读与创作随你同步。'}</p></div></section>`;
}

/** 将数据库中的内容状态转换为可读标签。
 * Args:
 *   status: 内容状态值。
 * Returns:
 *   状态文本。
 */
function statusLabel(status) {
  return ({ pending: '待审核', published: '已发布', rejected: '未通过', hidden: '已隐藏', visible: '可见', draft: '草稿' })[status] || '待处理';
}

/** 生成固定白名单内的管理操作按钮。
 * Args:
 *   action: 操作名称。
 *   id: 内容或用户标识。
 *   value: 目标状态。
 *   label: 按钮文字。
 *   disabled: 是否不可操作。
 * Returns:
 *   管理按钮标记。
 */
function actionButton(action, id, value, label, disabled = false) {
  return `<button type="button" class="admin-action${['rejected', 'hidden', 'ban'].includes(value) ? ' admin-danger' : ''}" data-action="${e(action)}" data-id="${e(id)}" data-value="${e(value)}" ${disabled ? 'disabled' : ''}>${e(label)}</button>`;
}

/** 生成文章审核卡片。
 * Args:
 *   post: 待展示的真实文章数据。
 *   state: 页面提交状态。
 * Returns:
 *   包含预览和审核操作的文章卡片。
 */
function postCard(post, state) {
  const author=state.authors.find(item=>item.id===post.author);
  return `<article class="admin-card"><div class="admin-card-top"><span class="admin-status">${statusLabel(post.status)}${post.pick?' · 编辑精选':''}</span><time>${e(post.date || '')}</time></div><h2><a href="#/article/${encodeURIComponent(post.id)}">${e(post.title)}</a></h2><p class="admin-byline">作者：${e(author?.name || post.authorName || '社区用户')}</p><p class="admin-excerpt">${e(post.excerpt || String(post.body || '').slice(0, 180))}</p><details class="admin-preview"><summary>预览正文</summary><div class="admin-body">${renderMarkdown(post.body || '')}</div></details><div class="admin-actions">${[['published', '通过发布'], ['rejected', '拒绝发布'], ['hidden', '隐藏文章']].map(([value, label]) => actionButton('moderate-post', post.id, value, label, state.busy || (value==='hidden'?post.status==='hidden':post.status!=='pending'))).join('')}${actionButton('feature-post',post.id,String(!post.pick),post.pick?'取消精选':'设为精选',state.busy || post.status!=='published')}<a href="#/article/${encodeURIComponent(post.id)}">打开阅读页 ${icon('arrow')}</a></div></article>`;
}

/** 生成评论审核卡片。
 * Args:
 *   comment: 真实评论数据。
 *   state: 页面提交状态。
 * Returns:
 *   评论卡片标记。
 */
function commentCard(comment, state) {
  return `<article class="admin-card"><div class="admin-card-top"><span class="admin-status">${statusLabel(comment.status)}</span><time>${e(comment.date || '')}</time></div><p class="admin-byline">${e(comment.userName || comment.name || '社区用户')}</p><p class="admin-comment-text">${e(comment.body || comment.text || '')}</p><div class="admin-actions">${actionButton('moderate-comment', comment.id, comment.status === 'hidden' ? 'visible' : 'hidden', comment.status === 'hidden' ? '恢复显示' : '隐藏评论', state.busy)}${comment.post_id ? `<a href="#/article/${encodeURIComponent(comment.post_id)}">查看原文 ${icon('arrow')}</a>` : ''}</div></article>`;
}

/** 生成账号管理卡片，禁止限制管理员本人。
 * Args:
 *   user: 真实用户资料。
 *   state: 当前管理员和提交状态。
 * Returns:
 *   用户管理卡片标记。
 */
function userCard(user, state) {
  const self = user.id === state.user?.id;
  return `<article class="admin-card admin-user"><div class="admin-user-identity">${avatar({ color: 'sage', initials: String(user.name || '用').slice(0, 1) })}<div><h2>${e(user.name || '未命名用户')}${self ? ' <span class="admin-self">你</span>' : ''}</h2><p>${user.role === 'admin' ? '管理员' : '社区成员'} · ${user.banned ? '已限制' : '正常'}</p></div></div>${actionButton('moderate-user', user.id, user.banned ? 'unban' : 'ban', self ? '当前管理员' : user.role==='admin'?'管理员':user.banned ? '解除限制' : '限制账号', state.busy || self || user.role==='admin')}</article>`;
}

/** 生成内容管理页面，界面权限不替代服务端鉴权。
 * Args:
 *   state: 管理员身份、管理数据和当前选项卡。
 * Returns:
 *   管理页面或无权访问提示。
 */
export function adminView(state) {
  if (!state.user || !state.isAdmin || state.banned) return `<section class="admin-unavailable"><span aria-hidden="true">${icon('users')}</span><h1>暂时无法访问</h1><p>此页面仅对具有管理权限的账号开放。</p><a href="#/">返回发现 ${icon('arrow')}</a></section>`;
  const tab = ['posts', 'comments', 'users'].includes(state.adminTab) ? state.adminTab : 'posts';
  const rows = state.admin?.[tab] || [];
  const tabs = [['posts', '文章审核'], ['comments', '评论管理'], ['users', '用户管理']];
  return `<section class="admin-shell" aria-labelledby="admin-heading"><header class="admin-heading"><div><span class="admin-kicker">COMMUNITY WORKSPACE</span><h1 id="admin-heading">照料每一份好内容。</h1><p>审核文章、维护讨论，让社区有序生长。</p></div><a href="#/profile">个人主页 ${icon('arrow')}</a></header>${serviceBanner(state)}<nav class="admin-tabs" aria-label="内容管理分类">${tabs.map(([value, label]) => `<button type="button" class="${value === tab ? 'admin-selected' : ''}" data-action="admin-tab" data-value="${value}" aria-pressed="${value === tab}">${label}<span>${(state.admin?.[value] || []).length}</span></button>`).join('')}</nav><div class="admin-content" aria-busy="${Boolean(state.busy)}"><p class="admin-feedback" role="status" aria-live="polite">${e(state.authMessage || '')}</p>${rows.length ? rows.map(row => tab === 'posts' ? postCard(row, state) : tab === 'comments' ? commentCard(row, state) : userCard(row, state)).join('') : `<div class="admin-empty">${icon('coffee')}<h2>${state.busy ? '正在读取…' : '这里暂时没有内容'}</h2><p>${state.busy ? '请稍候。' : '内容载入后会显示在此处。'}</p></div>`}</div></section>`;
}
