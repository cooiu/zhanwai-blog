let apiBase='';

/** 配置受部署文件控制的后端地址，不读取 URL 参数或浏览器存储。
 * Args:
 *   config: 部署生成的公开配置。
 * Returns:
 *   通过校验的 API origin；空字符串表示同源服务。
 * Raises:
 *   ApiError: 后端地址不符合 HTTPS origin 约束。
 */
export function configureClient(config) {
  if(!config || typeof config.apiBase!=='string')throw new ApiError('网站连接配置无效');
  if(config.apiBase===''){apiBase='';return apiBase;}
  try {
    const url=new URL(config.apiBase);
    if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error();
    apiBase=url.origin;return apiBase;
  }catch {throw new ApiError('网站后端地址必须为有效的 HTTPS 地址');}
}

/** 读取随网页发布的后端配置，保留 GitHub Pages 仓库子路径。
 * Returns:
 *   配置读取完成的 Promise。
 * Raises:
 *   ApiError: 配置缺失或无法解析。
 */
export async function loadClientConfig() {
  let response;
  try {response=await fetch(new URL('./config.json',import.meta.url),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});}
  catch {throw new ApiError('暂时无法读取网站连接配置，请刷新重试');}
  if(!response.ok)throw new ApiError('网站尚未发布完整连接配置');
  try {return configureClient(await response.json());}
  catch(error){throw error instanceof ApiError?error:new ApiError('网站连接配置格式无效');}
}

/** 保存接口错误，供页面区分登录失效和服务不可用。
 * Args:
 *   message: 可向用户展示的错误说明。
 *   status: HTTP 状态。
 *   code: 稳定的业务错误标识。
 * Returns:
 *   接口错误实例。
 */
export class ApiError extends Error {
  /** 初始化接口错误。
   * Args:
   *   message: 错误说明。
   *   status: HTTP 状态。
   *   code: 错误标识。
   */
  constructor(message,status=0,code='REQUEST_FAILED') { super(message);this.status=status;this.code=code; }
}

/** 请求可信部署后端，身份凭证只通过 HttpOnly Cookie 发送。
 * Args:
 *   path: /api/ 下的相对路径。
 *   options: HTTP 方法、JSON 数据及可选取消信号。
 * Returns:
 *   解析后的响应对象。
 * Raises:
 *   ApiError: 网络失败、响应错误或服务未配置。
 */
export async function request(path,{method='GET',body,signal}={}) {
  if(!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path))throw new ApiError('请求地址无效');
  const writing=!['GET','HEAD'].includes(method);
  let response;
  try {
    response=await fetch(`${apiBase}/api${path}`,{method,credentials:apiBase?'include':'same-origin',cache:'no-store',headers:writing?{'Content-Type':'application/json'}:{},body:writing?JSON.stringify(body ?? {}):undefined,signal:signal || AbortSignal.timeout(30000)});
  } catch { throw new ApiError('暂时无法连接社区，请检查网络后重试。',0,'NETWORK_ERROR'); }
  let result;
  try {result=await response.json();} catch {throw new ApiError('社区服务暂时无法使用，请稍后重试。',response.status,'INVALID_RESPONSE');}
  if(!response.ok)throw new ApiError(result.error || '操作未完成，请稍后重试。',response.status,result.code);
  return result;
}

/** 把服务端草稿整理为编辑表单需要的数据。
 * Args:
 *   draft: 服务端草稿或文章。
 * Returns:
 *   不含认证信息的编辑器状态。
 */
export function normalizeDraft(draft={}) {
  return {title:draft.title || '',body:draft.body || '',tags:Array.isArray(draft.tags)?draft.tags.join('，'):(draft.tags || ''),category:draft.category || 'frontend',cover_path:draft.cover_path || '',coverUrl:draft.coverUrl || '',editing_post_id:draft.editing_post_id || '',updated:draft.updated_at || ''};
}

/** 校验并编码待上传图片，服务端还会再次检查文件签名。
 * Args:
 *   file: 用户选择的图片。
 * Returns:
 *   含 MIME 和 Base64 的上传参数。
 * Raises:
 *   ApiError: 类型、大小不合法或文件读取失败。
 */
export async function imagePayload(file) {
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new ApiError('请选择 JPG、PNG 或 WebP 图片。');
  if(file.size>2*1024*1024)throw new ApiError('图片不能超过 2 MB。');
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return {mime:file.type,base64:btoa(binary)};
}
