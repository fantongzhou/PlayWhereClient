import { marked, type Token } from 'marked';
import remend from 'remend';

/**
 * 流式 Markdown 增量渲染器
 * ================================================================
 * 解决两个问题：
 *   1. 未闭合语法（`**加粗` / 半截表格 / 未闭合代码块）渲染时崩成裸文本或错版
 *   2. 每个 token 都对全文重跑 markdown 解析 → O(n²) 卡顿
 *
 * 两个手法对应业界两套成熟方案：
 *
 * 【修复】—— remend（Vercel streamdown 的预处理层，框架无关）
 *   在原始字符串层检测未闭合模式并补上收尾符号。等模型真正输出收尾符时，
 *   补出的符号自然被替换，视觉上无跳变。
 *
 * 【增量】—— 块级边界推进（Claude Code StreamingMarkdown 的做法）
 *   用 lexer 把文本切成顶层 block；最后一个 block 是"正在生长的"（可能是
 *   未闭合的代码块/表格），不能固化。它之前的所有 block 都已稳定，缓存其
 *   HTML 不再重算。于是每帧成本是 O(尾部长度) 而非 O(全文)。
 *
 *   为什么这个切分点是安全的：marked 会把未闭合的 ``` 或半截表格解析成
 *   *一个* token，所以"最后一个 token 之前"永远是完整块。
 */

// ---- marked 配置 ----
marked.setOptions({ gfm: true, breaks: false });

/**
 * 自定义 renderer：让 marked 输出沿用项目既有的 CSS 类名。
 *
 * 为什么必须做：plan.vue / m/plan.vue 的 scoped 样式全部选择 `.md-table`、
 * `.md-paragraph`、`.md-h2` 这类自定义类，而 marked 默认吐 `<table>`/`<p>`/`<h2>`
 * 原生标签 —— 不映射的话样式全丢。
 *
 * 同时也处理 remend 的占位符：
 *   - 未闭合链接的 href 是 `streamdown:incomplete-link` → 降级为纯文本，避免点击跳转失败
 *   - 未完成图片 remend 直接返回空串，这里再兜一道
 */
marked.use({
  breaks: true, // 段落内硬换行保留为 <br>（聊天场景用户常换行）
  renderer: {
    heading({ tokens, depth }: any) {
      const text = this.parser.parseInline(tokens);
      // 沿用旧实现的偏移映射（计划摘要里以 ## / ### 为主）
      const cls = depth === 1 ? 'md-h2' : depth === 2 ? 'md-h3' : 'md-h4';
      return `<h${depth} class="${cls}">${text}</h${depth}>`;
    },
    paragraph({ tokens }: any) {
      const text = this.parser.parseInline(tokens);
      return `<p class="md-paragraph">${text}</p>\n`;
    },
    hr() {
      return '<hr class="md-hr">\n';
    },
    link(token: any) {
      const href: string = token.href || '';
      const text = this.parser.parseInline(token.tokens);
      if (href.startsWith('streamdown:incomplete-link')) return text; // 未闭合链接：纯文本
      const title = token.title ? ` title="${token.title}"` : '';
      return `<a href="${href}" target="_blank" rel="noopener" class="md-link"${title}>${text}</a>`;
    },
    image(token: any) {
      const href: string = token.href || '';
      if (!href || href.startsWith('streamdown:')) return '';
      const alt = token.text || '图片';
      return `<img src="${href}" alt="${alt}" loading="lazy" class="md-image" onerror="this.style.display='none'" />`;
    },
    codespan({ text }: any) {
      return `<code class="inline-code">${text}</code>`;
    },
    list(token: any) {
      const tag = token.ordered ? 'ol' : 'ul';
      const cls = token.ordered ? 'md-ol' : 'md-ul';
      const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
      const body = token.items.map((item: any) => this.listitem(item)).join('');
      return `<${tag} class="${cls}"${start}>${body}</${tag}>\n`;
    },
    listitem(item: any) {
      // 任务列表项（- [ ] / - [x]）marked 的 item.task 标志，保留复选框语义
      const body = this.parser.parse(item.tokens, !!item.loose);
      return `<li class="md-li">${body.replace(/^<p class="md-paragraph">|<\/p>\n?$/g, '')}</li>`;
    },
    table(token: any) {
      const cell = (c: any) => this.parser.parseInline(c.tokens);
      const head = token.header.map((c: any) => `<th>${cell(c)}</th>`).join('');
      const rows = token.rows
        .map((row: any[], i: number) => {
          const cls = i % 2 === 0 ? '' : ' class="md-tr-alt"';
          const tds = row.map((c: any) => {
            // 兼容旧实现里手动插入的换行占位符
            const html = cell(c).replace(/%%BR%%/g, '<br>');
            return `<td>${html}</td>`;
          }).join('');
          return `<tr${cls}>${tds}</tr>`;
        })
        .join('');
      return `<table class="md-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>\n`;
    },
  },
});

/** 把一段稳定的 markdown 渲染为 HTML */
function renderChunk(md: string): string {
  if (!md.trim()) return '';
  try {
    return marked.parse(md, { async: false }) as string;
  } catch {
    // 解析失败兜底：转义后原样显示，绝不让整条消息白屏
    return `<p class="md-paragraph">${escapeHtml(md)}</p>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 修复未闭合语法后渲染。remend 只会把收尾符补在【最末尾】，
 * 而 breaks:true 会把中间的换行变成 <br> —— 补在末尾的收尾符会被换行隔开、
 * 配不成对，反而渲染成字面标记。先把尾部空白摘掉、修完再贴回。
 *
 * 边界情况：若未闭合标记与后续内容之间隔着空行（`**未闭合\n\n下段`），
 * remend 会把收尾符补到最后一段之后，产生游离标记。这种输入在真实流式里
 * 不会出现（未闭合标记总在尾部末尾），且属模型输出的畸形 markdown，
 * 显示为字面符反而是正确结果。经实测，为此加"跳过未平衡块"的守卫会让
 * 终态【变差】（游离标记从被吃掉变成出现在新段落末尾），故不设守卫。
 */
function renderTail(md: string): string {
  const trailing = md.match(/\s*$/)?.[0] ?? '';
  const core = md.slice(0, md.length - trailing.length);
  return renderChunk(remend(core) + trailing);
}

/**
 * 每个消息对应一个 renderer 实例：持有"稳定前缀"状态。
 * 关键不变量：stablePrefix 只增不减（单调推进），保证幂等 ——
 * 同一份输入重复调用结果一致，React/Vue 的重复渲染也安全。
 */
export class IncrementalMarkdownRenderer {
  private stableHtml = '';
  private stableRawLength = 0;
  /** 上一次的完整输入，用于检测"内容被改写"（如 complete 追加了表格） */
  private lastInput = '';

  /**
   * 渲染当前累积内容。
   * @param raw 截至目前的完整 markdown 原文
   * @returns 完整的 HTML（稳定前缀 + 实时重算的尾部）
   */
  render(raw: string): string {
    if (!raw) {
      this.reset();
      return '';
    }

    // 增量假设：新内容是在旧内容基础上的追加。
    // 若前缀被改写（长度回退或前缀不同），说明不是追加 —— 整个重置重算。
    if (
      raw.length < this.lastInput.length ||
      (this.lastInput && !raw.startsWith(this.lastInput.slice(0, this.stableRawLength)))
    ) {
      this.reset();
    }
    this.lastInput = raw;

    // 尾部 = 尚未固化的部分。注意：切分和游标推进一律基于【原文 raw】，
    // remend 只作用于最后要渲染的那一小段。
    //
    // 为什么不能在修复后的字符串上推进游标：remend 会插入修复字符（如给
    // `**加粗` 补上 `**`），长度与原文不再一一对应；一旦拿修复后的长度累加
    // stableRawLength，游标就会相对原文持续漂移，累积后切掉真实字符
    // （实测丢过 emoji —— 它是 surrogate pair，被多跳 2 个 UTF-16 单元）。
    const tail = raw.slice(this.stableRawLength);

    // 1) 对尾部做块级解析，找出可以固化的稳定前缀。
    //    最后一个 token 是"正在生长的块"，不能固化。
    let tokens: Token[];
    try {
      tokens = marked.lexer(tail);
    } catch {
      // 解析失败：不推进边界，整段走兜底渲染
      return this.stableHtml + renderTail(tail);
    }

    // 末尾的 space token 只是块间空行，固化它没有意义，反而让下一帧的分隔处理变复杂
    let stableCount = tokens.length;
    while (stableCount > 0 && tokens[stableCount - 1].type === 'space') stableCount--;
    // 保留最后一个内容 token 作为"不稳定尾部"
    if (stableCount > 0) stableCount--;

    // 推进稳定前缀（全部按原文 raw 长度累加，与 remend 无关）
    let advance = 0;
    for (let i = 0; i < stableCount; i++) advance += tokens[i].raw.length;

    if (advance > 0) {
      // 稳定前缀里的块都是已闭合的完整块，无需修复
      this.stableHtml += renderChunk(tail.slice(0, advance));
      this.stableRawLength += advance;
    }

    // 2) 尾部（可能不完整）每次实时重算 —— 长度很短，成本可控
    return this.stableHtml + renderTail(tail.slice(advance));
  }

  reset(): void {
    this.stableHtml = '';
    this.stableRawLength = 0;
    this.lastInput = '';
  }
}

/**
 * 按消息 id 维护 renderer 实例的缓存管理器。
 * - 正在流式的消息：每帧走增量渲染（O(尾部)）
 * - 历史消息：内容不变 → 直接命中缓存，零成本
 */
export class MarkdownRenderCache {
  private renderers = new Map<string, IncrementalMarkdownRenderer>();
  private htmlCache = new Map<string, { content: string; html: string }>();

  /** 渲染指定消息；同内容命中缓存直接返回 */
  render(msgId: string, content: string): string {
    const hit = this.htmlCache.get(msgId);
    if (hit && hit.content === content) return hit.html;

    let renderer = this.renderers.get(msgId);
    if (!renderer) {
      renderer = new IncrementalMarkdownRenderer();
      this.renderers.set(msgId, renderer);
    }
    const html = renderer.render(content);
    this.htmlCache.set(msgId, { content, html });
    return html;
  }

  /** 消息结束时释放 renderer（HTML 缓存保留，历史消息仍能命中） */
  finalize(msgId: string): void {
    this.renderers.delete(msgId);
  }

  clear(): void {
    this.renderers.clear();
    this.htmlCache.clear();
  }
}

/** 供单测/调试：暴露纯函数式的一次性渲染 */
export function renderMarkdownOnce(raw: string): string {
  const r = new IncrementalMarkdownRenderer();
  return r.render(raw);
}
