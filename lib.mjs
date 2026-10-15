/** 将不可信文本转义为 HTML。
 * Args:
 *   value: 任意待展示文本。
 * Returns:
 *   可安全插入文本位置的字符串。
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

/** 校验社区媒体地址，只允许 Supabase 的公开媒体存储路径。
 * Args:
 *   value: 待展示的图片地址。
 * Returns:
 *   安全的 HTTPS 地址；不符合白名单时为空字符串。
 */
export function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
      && !url.username && !url.password && !url.port
      && url.pathname.startsWith('/storage/v1/object/public/media/')
      && !url.search && !url.hash ? url.href : '';
  } catch { return ''; }
}

/** 按分类、查询和排序筛选文章，保留原始数组。
 * Args:
 *   articles: 文章列表。
 *   options: 分类、搜索词、排序及收藏集合。
 * Returns:
 *   筛选并排序后的新数组。
 */
export function selectArticles(articles, {category='all', query='', sort='recommend', saved=null}={}) {
  const needle = query.trim().toLocaleLowerCase();
  return articles.filter(a => (category === 'all' || a.category === category)
    && (!saved || saved.includes(a.id))
    && (!needle || `${a.title} ${a.excerpt} ${a.authorName || ''} ${a.tags.join(' ')}`.toLocaleLowerCase().includes(needle)))
    .sort((a,b) => sort === 'hot' ? b.likes - a.likes : sort === 'new' ? b.date.localeCompare(a.date) : Number(Boolean(b.pick))-Number(Boolean(a.pick)) || b.date.localeCompare(a.date));
}

/** 把有限 Markdown 转为已转义的语义化 HTML，禁止原始 HTML。
 * Args:
 *   source: 文章正文，支持标题、代码围栏、引用、列表和段落。
 * Returns:
 *   安全的正文 HTML。
 */
export function renderMarkdown(source) {
  let inCode=false, code=[], paragraph=[], list=[], heading=0;
  const output=[];
  /** 输出累积文本块。
   * Returns:
   *   无返回值。
   */
  function flush() {
    if (paragraph.length) output.push(`<p>${paragraph.map(escapeHtml).join('<br>')}</p>`);
    if (list.length) output.push(`<ul>${list.map(line=>`<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
    paragraph=[]; list=[];
  }
  for (const line of String(source).split('\n')) {
    if (line.startsWith('```')) {
      flush();
      if (inCode) { output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code=[]; }
      inCode=!inCode; continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^#{1,3} /.test(line)) { flush(); output.push(`<h2 id="section-${heading++}">${escapeHtml(line.replace(/^#{1,3} /,''))}</h2>`); }
    else if (line.startsWith('> ')) { flush(); output.push(`<blockquote>${escapeHtml(line.slice(2))}</blockquote>`); }
    else if (line.startsWith('- ')) { if (paragraph.length) flush(); list.push(line.slice(2)); }
    else { if (list.length) flush(); paragraph.push(line); }
  }
  flush();
  if (inCode) output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return output.join('\n');
}

/** 提取代码围栏之外的 Markdown 标题，保证目录与正文一致。
 * Args:
 *   source: 文章正文。
 * Returns:
 *   按出现顺序排列的标题原文。
 */
export function extractHeadings(source) {
  let inCode=false;
  return String(source).split('\n').filter(line=>{
    if(line.startsWith('```')){inCode=!inCode;return false;}
    return !inCode && /^#{1,3} /.test(line);
  });
}
