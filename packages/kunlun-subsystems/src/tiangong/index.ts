/**
 * 天工 Tiangong (S8) — 三元信度驱动的表达渲染
 * V2 职责: 三元信度标签渲染、矛盾张力美学、矛盾可视化
 *
 * 关键变化:
 *  - ConfidenceTagRenderer: 为输出片段标注三元信度
 *  - ContradictionVisualizer: 矛盾分析结果可视化
 *  - 三元信度标签: +1=已验证, 0=待验证, -1=已否定
 */

import { Trit, T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════
// ConfidenceTag — 信度标签
// ═══════════════════════════════════════════════════════════

export interface ConfidenceTag {
  trit: Trit;
  label: string;
  color: 'green' | 'yellow' | 'red';
  symbol: string;
  description: string;
}

export const CONFIDENCE_TAGS: Record<string, ConfidenceTag> = {
  '+1': { trit: T_TRUE, label: '已验证', color: 'green', symbol: '\u2713', description: '经过实践验证，高置信度' },
  '0':  { trit: T_UNKNOWN, label: '待验证', color: 'yellow', symbol: '?', description: '初步判断，需进一步验证' },
  '-1': { trit: T_FALSE, label: '已否定', color: 'red', symbol: '\u2717', description: '被实践证伪，仅供参考' },
};

// ═══════════════════════════════════════════════════════════
// RenderFragment + RenderOutput
// ═══════════════════════════════════════════════════════════

export interface RenderFragment {
  content: string;
  confidenceTags: Trit[];
  index: number;
  source?: string;
}

export interface RenderOutput {
  fragments: RenderFragment[];
  overallConfidence: Trit;
  confidenceSummary: string;
}

// ═══════════════════════════════════════════════════════════
// ConfidenceTagRenderer
// ═══════════════════════════════════════════════════════════

export class ConfidenceTagRenderer {

  render(content: string, confidenceTrits: Trit[]): RenderOutput {
    const fragments: RenderFragment[] = [];
    const segments = this.splitIntoSegments(content);

    for (let i = 0; i < segments.length; i++) {
      fragments.push({
        content: segments[i],
        confidenceTags: [confidenceTrits[i] ?? T_UNKNOWN],
        index: i,
      });
    }

    const overallConfidence = this.majorityVote(confidenceTrits);
    const confidenceSummary = this.buildSummary(overallConfidence, fragments.length);

    return { fragments, overallConfidence, confidenceSummary };
  }

  private splitIntoSegments(content: string): string[] {
    if (!content || content.trim().length === 0) return [content];
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) return paragraphs;
    const sentences = content.split(/(?<=[。！？.!?])\s*/).filter(s => s.trim().length > 0);
    return sentences.length > 1 ? sentences : [content];
  }

  private majorityVote(trits: Trit[]): Trit {
    if (trits.length === 0) return T_UNKNOWN;
    const counts = { [T_TRUE]: 0, [T_UNKNOWN]: 0, [T_FALSE]: 0 };
    for (const t of trits) counts[t]++;
    if (counts[T_TRUE] > counts[T_UNKNOWN] && counts[T_TRUE] > counts[T_FALSE]) return T_TRUE;
    if (counts[T_FALSE] > counts[T_UNKNOWN] && counts[T_FALSE] > counts[T_TRUE]) return T_FALSE;
    return T_UNKNOWN;
  }

  private buildSummary(overall: Trit, fragmentCount: number): string {
    const tag = this.getTag(overall);
    return `${tag.symbol} ${tag.label} — ${fragmentCount} fragments, overall: ${tag.description}`;
  }

  getTag(trit: Trit): ConfidenceTag {
    if (trit === T_TRUE) return CONFIDENCE_TAGS['+1'];
    if (trit === T_FALSE) return CONFIDENCE_TAGS['-1'];
    return CONFIDENCE_TAGS['0'];
  }

  /**
   * 连续置信度分级（天工渲染增强）：把 0-1 共识置信度映射为可读等级，
   * 让三元信度不再是固定"待验证"，而反映"系统有多确定"（大成智慧学约束4 不夸大）。
   */
  getConfidenceGrade(confidence: number): { grade: string; symbol: string; note: string } {
    if (confidence >= 0.75) return { grade: '强共识', symbol: '✓', note: '多数角色有明确立场，置信高' };
    if (confidence >= 0.5) return { grade: '中共识', symbol: '~', note: '部分角色有立场，可参考' };
    if (confidence >= 0.25) return { grade: '弱共识', symbol: '?', note: '少数角色有立场，初步判断' };
    return { grade: '待定', symbol: '⏳', note: '角色普遍未定位，需进一步验证或补卡' };
  }

  getAvailableTags(): ConfidenceTag[] {
    return Object.values(CONFIDENCE_TAGS);
  }
}

// ═══════════════════════════════════════════════════════════
// ContradictionVisualizer
// ═══════════════════════════════════════════════════════════

export interface VisualizationNode {
  id: string;
  label: string;
  trit: Trit;
  type: 'thesis' | 'antithesis' | 'synthesis';
}

export interface VisualizationEdge {
  from: string;
  to: string;
  label: string;
  trit: Trit;
}

export interface ContradictionGraph {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
}

export class ContradictionVisualizer {

  buildGraph(thesis: string, antithesis: string, synthesis?: string): ContradictionGraph {
    const nodes: VisualizationNode[] = [
      { id: 'thesis', label: thesis, trit: T_TRUE, type: 'thesis' },
      { id: 'antithesis', label: antithesis, trit: T_FALSE, type: 'antithesis' },
    ];
    const edges: VisualizationEdge[] = [
      { from: 'thesis', to: 'antithesis', label: 'opposes', trit: T_UNKNOWN },
    ];
    if (synthesis) {
      nodes.push({ id: 'synthesis', label: synthesis, trit: T_UNKNOWN, type: 'synthesis' });
      edges.push(
        { from: 'thesis', to: 'synthesis', label: 'unifies', trit: T_TRUE },
        { from: 'antithesis', to: 'synthesis', label: 'unifies', trit: T_TRUE },
      );
    }
    return { nodes, edges };
  }

  toAscii(graph: ContradictionGraph): string {
    const lines: string[] = [];
    lines.push('+-------------------------------+');
    for (const node of graph.nodes) {
      const tag = node.trit === T_TRUE ? '[+]' : node.trit === T_FALSE ? '[-]' : '[~]';
      const typeLabel = node.type === 'thesis' ? 'T' : node.type === 'antithesis' ? 'A' : 'S';
      lines.push(`| ${tag} ${typeLabel}: ${node.label.substring(0, 22)}`);
    }
    lines.push('+-------------------------------+');
    for (const edge of graph.edges) {
      const etag = edge.trit === T_TRUE ? '+' : edge.trit === T_FALSE ? '-' : '~';
      lines.push(`|  ${edge.from} --${etag}-> ${edge.to}: ${edge.label}`);
    }
    lines.push('+-------------------------------+');
    return lines.join('\n');
  }

  toMarkdown(graph: ContradictionGraph): string {
    const lines: string[] = [];
    lines.push('```mermaid');
    lines.push('graph LR');
    for (const node of graph.nodes) {
      const tag = node.trit === T_TRUE ? '(+1)' : node.trit === T_FALSE ? '(-1)' : '(0)';
      const typeLabel = node.type === 'thesis' ? 'Thesis' : node.type === 'antithesis' ? 'Antithesis' : 'Synthesis';
      lines.push(`  ${node.id}["${typeLabel}<br/>${node.label.substring(0, 30)} ${tag}"]`);
    }
    for (const edge of graph.edges) {
      lines.push(`  ${edge.from} -->|${edge.label}| ${edge.to}`);
    }
    lines.push('```');
    return lines.join('\n');
  }
}
