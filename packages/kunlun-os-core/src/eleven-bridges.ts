/**
 * 十一桥知识卡片系统 — 大成智慧学的知识基础设施
 * [成熟度: 种子期→成长期] 当前 33 张种子卡 + 龙门补录草稿；专家资格锚定归藏卡（约束6）
 *
 * 钱学森大成智慧学将人类知识体系通过 11 座学科桥梁连接：
 *   马克思主义哲学
 *       ↓ 十一座桥梁
 *   每桥三层：基础学科(AX公理) → 科学技术(SC学科) → 工程技术(TC工具)
 *
 * 三环节使用法：
 *   感知 → 用卡拆解命题
 *   思考 → 用卡重组推理
 *   表达 → 用卡梳理输出
 *
 * 这是昆仑OS 的唯一十一桥定义，替代 extension/index.ts 和 taiyi/index.ts 中的分散定义。
 */

// ═══════════════════════════════════════════════════════════════
// 桥定义（Q01-Q11，对应 design doc 第 22 章）
// ═══════════════════════════════════════════════════════════════

export interface BridgeProfile {
  /** 桥编号 */
  id: string;
  /** 桥名称 */
  name: string;
  /** 英文名 */
  en: string;
  /** 图标 */
  icon: string;
  /** 核心公理（来自 AX 卡） */
  axiom: string;
  /** 领域关键词（用于路由匹配） */
  keywords: string[];
  /** 该桥承载的卡片 */
  cards: KnowledgeCard[];
}

export interface KnowledgeCard {
  /** 卡片 ID（AX-001, SC-001, TC-001...） */
  id: string;
  /** 所属桥 */
  bridgeId: string;
  /** 层：基础学科 / 科学技术 / 工程技术 */
  layer: '基础学科' | '科学技术' | '工程技术';
  /** 类型：AX(公理卡) / SC(学科卡) / TC(工具卡) */
  type: 'AX' | 'SC' | 'TC';
  /** 标题 */
  title: string;
  /** 核心内容 */
  content: string;
  /** 标签 */
  tags: string[];
}

// ═══════════════════════════════════════════════════════════════
// 十一桥定义（33 张初始卡片）
// ═══════════════════════════════════════════════════════════════

export const ELEVEN_BRIDGES: BridgeProfile[] = [
  {
    id: 'Q01', name: '自然辩证法', en: 'Dialectics of Nature', icon: '🔬',
    axiom: '物质第一性·意识第二性',
    keywords: ['物理', '化学', '生物', '自然', '物质', '能量', '科学实验', '客观规律', '性能', '效率', '优化', '测量', '指标', 'nature', 'physics', 'chemistry', 'biology', 'performance', 'efficiency', 'optimization'],
    cards: [
      { id: 'AX-001', bridgeId: 'Q01', layer: '基础学科', type: 'AX', title: '物质第一性·意识第二性', content: '物质决定意识，意识对物质有能动反作用。分析任何系统时，先问物质基础（资源/约束/条件），再问意识上层（认知/策略/文化）。', tags: ['ontology', 'materialism'] },
      { id: 'SC-001', bridgeId: 'Q01', layer: '科学技术', type: 'SC', title: '自然科学的三大发现', content: '细胞学说、能量守恒与转化定律、生物进化论——揭示了自然界的辩证统一：一切事物相互联系、运动发展、矛盾转化。', tags: ['science-history', 'dialectics'] },
      { id: 'TC-001', bridgeId: 'Q01', layer: '工程技术', type: 'TC', title: '量变质变临界点检测', content: '跟踪关键参数的趋势斜率变化，检测系统响应的非线性跳变，识别"最后一根稻草"型触发事件。适用于技术突破预测、危机预警。', tags: ['threshold', 'prediction'] },
    ],
  },
  {
    id: 'Q02', name: '社会科学', en: 'Social Science', icon: '📊',
    axiom: '社会存在决定社会意识',
    keywords: ['社会', '经济', '政策', '市场', '资本', '阶级', '制度', '文化', '企业', '组织', '成本', '收益', '投资', '预算', '商业', '产业', '金融', '管理', '治理', '人力', '资源分配', 'society', 'economy', 'policy', 'market', 'cost', 'business', 'enterprise'],
    cards: [
      { id: 'AX-002', bridgeId: 'Q02', layer: '基础学科', type: 'AX', title: '社会存在决定社会意识', content: '社会的物质生活条件决定社会思想上层建筑。分析社会现象时：先解剖经济基础（生产关系/生产力），再理解上层建筑（政治/法律/文化）。', tags: ['historical-materialism'] },
      { id: 'SC-002', bridgeId: 'Q02', layer: '科学技术', type: 'SC', title: '政治经济学：生产关系与生产力', content: '生产力发展水平决定生产关系性质，生产关系反作用于生产力。当生产关系从促进转为阻碍时，变革时代到来。', tags: ['political-economy', 'productivity'] },
      { id: 'TC-002', bridgeId: 'Q02', layer: '工程技术', type: 'TC', title: '社会主要矛盾分析法', content: '三步定位主要矛盾：①列出所有矛盾对 ②按"影响全局程度"排序 ③识别解决了它其他矛盾就迎刃而解的。', tags: ['contradiction-analysis', 'priority'] },
    ],
  },
  {
    id: 'Q03', name: '数学科学', en: 'Mathematical Science', icon: '📐',
    axiom: '万物皆数·关系即结构',
    keywords: ['数学', '量化', '计算', '算法', '模型', '统计', '概率', '数据', 'math', 'algorithm', 'statistics', 'model'],
    cards: [
      { id: 'AX-003', bridgeId: 'Q03', layer: '基础学科', type: 'AX', title: '万物皆数·关系即结构', content: '一切事物都有量的规定性，事物之间的关系可以用数学结构描述。先识别可度量的关键变量，再建立变量之间的关系模型。', tags: ['quantification', 'foundation'] },
      { id: 'SC-003', bridgeId: 'Q03', layer: '科学技术', type: 'SC', title: '统计学与概率论', content: '用样本推断总体，用概率描述不确定性。核心原则：基率谬误、辛普森悖论、回归均值。适用于数据驱动决策。', tags: ['statistics', 'probability'] },
      { id: 'TC-003', bridgeId: 'Q03', layer: '工程技术', type: 'TC', title: '基率谬误检测器', content: '当分析说"准确率99%"时自动追问：先验概率是多少？忽略基率的结论降信度一级。', tags: ['bias-detection', 'bayesian'] },
    ],
  },
  {
    id: 'Q04', name: '系统科学', en: 'System Science', icon: '🔷',
    axiom: '整体大于部分之和',
    keywords: ['涌现', '反馈回路', '自组织', '耗散结构', '混沌', '分形', '网络效应', '正反馈', '负反馈', 'system dynamics', 'emergence', 'feedback loop', 'complex adaptive'],
    cards: [
      { id: 'AX-004', bridgeId: 'Q04', layer: '基础学科', type: 'AX', title: '整体大于部分之和', content: '系统具有涌现属性，不能通过孤立分析子系统来理解整体。分析时：①圈定系统边界 ②识别反馈回路 ③寻找涌现行为。', tags: ['emergence', 'holism'] },
      { id: 'SC-004', bridgeId: 'Q04', layer: '科学技术', type: 'SC', title: '控制论与反馈回路', content: '任何系统都由正反馈（放大/加速偏离）和负反馈（抑制/保持稳定）回路驱动。分析三问：哪些回路主导？平衡点在哪？时滞多长？', tags: ['cybernetics', 'feedback'] },
      { id: 'TC-004', bridgeId: 'Q04', layer: '工程技术', type: 'TC', title: 'OCGS回路分析法', content: '开放复杂巨系统回路分析：①画系统边界 ②列出关键变量和连接 ③标注正负反馈极性 ④找主导回路和延迟环节。', tags: ['ocgs', 'loop-analysis'] },
    ],
  },
  {
    id: 'Q05', name: '思维科学', en: 'Science of Mind', icon: '🧠',
    axiom: '从感性认识到理性认识',
    keywords: ['思维', '认知', '逻辑', '推理', '哲学', '意识', '决策', '学习', 'thinking', 'cognition', 'logic', 'reasoning'],
    cards: [
      { id: 'AX-005', bridgeId: 'Q05', layer: '基础学科', type: 'AX', title: '从感性认识到理性认识', content: '认识过程：感性认识（具体经验）→ 理性认识（抽象概念）→ 实践检验 → 再认识。三层校验：经验是否符合？逻辑是否自洽？实践是否验证？', tags: ['epistemology', 'cognition'] },
      { id: 'SC-005', bridgeId: 'Q05', layer: '科学技术', type: 'SC', title: '认知科学与决策心理学', content: '人类决策受认知偏差系统影响。核心偏差：确认偏误、锚定效应、损失厌恶、过度自信。分析时需校准这些偏差。', tags: ['cognitive-science', 'decision'] },
      { id: 'TC-005', bridgeId: 'Q05', layer: '工程技术', type: 'TC', title: '三元认知推理框架', content: '用三值逻辑（+1/0/-1）替代二值判断：确定真→1，存疑→0，确定假→-1。避免非黑即白的思维陷阱，保留不确定性空间。', tags: ['ternary', 'reasoning'] },
    ],
  },
  {
    id: 'Q06', name: '人体科学', en: 'Human Body Science', icon: '🏃',
    axiom: '人体是开放复杂巨系统',
    keywords: ['人体', '健康', '生理', '医学', '认知负荷', '注意力', 'human', 'health', 'body', 'medical'],
    cards: [
      { id: 'AX-006', bridgeId: 'Q06', layer: '基础学科', type: 'AX', title: '人体是开放复杂巨系统', content: '人体不断与外界交换物质、能量、信息。分析人的状态时需考虑多层级（分子→细胞→器官→系统→整体）和多维度（生理/心理/社会）。', tags: ['ocgs', 'human-body'] },
      { id: 'SC-006', bridgeId: 'Q06', layer: '科学技术', type: 'SC', title: '人因工程与认知负荷', content: '人的工作记忆容量有限（7±2 组块），注意力是稀缺资源。设计交互时需控制信息密度，避免认知过载。', tags: ['human-factors', 'cognitive-load'] },
      { id: 'TC-006', bridgeId: 'Q06', layer: '工程技术', type: 'TC', title: '注意力预算管理工具', content: '将注意力视为有限预算：①列出当前认知任务 ②按优先级分配注意力 ③监控认知负荷指标 ④超过阈值时触发减负。', tags: ['attention', 'budget'] },
    ],
  },
  {
    id: 'Q07', name: '文学艺术', en: 'Literature & Arts', icon: '🎭',
    axiom: '形式与内容的辩证统一',
    keywords: ['表达', '叙事', '修辞', '美学', '设计', '写作', '艺术', '创作', 'expression', 'narrative', 'design', 'art'],
    cards: [
      { id: 'AX-007', bridgeId: 'Q07', layer: '基础学科', type: 'AX', title: '形式与内容的辩证统一', content: '内容决定形式，形式反作用于内容。好的表达是内容和形式的统一。分析输出时：内容是否扎实？形式是否匹配？表达是否有效？', tags: ['form-content', 'expression'] },
      { id: 'SC-007', bridgeId: 'Q07', layer: '科学技术', type: 'SC', title: '叙事学与修辞学', content: '叙事的核心三要素：情节（发生了什么）、人物（谁经历了什么）、主题（为什么重要）。修辞三诉求：逻辑(Logos)、情感(Pathos)、信誉(Ethos)。', tags: ['narratology', 'rhetoric'] },
      { id: 'TC-007', bridgeId: 'Q07', layer: '工程技术', type: 'TC', title: '表达架构·三层打磨法', content: '①内容层——确保分析深度和准确性 ②架构层——用结构化模板组织逻辑 ③美化层——用洞见增强表达力度。三层叠加后加叙事线串联。', tags: ['expression', 'polish'] },
    ],
  },
  {
    id: 'Q08', name: '军事科学', en: 'Military Science', icon: '⚔️',
    axiom: '知己知彼·百战不殆',
    keywords: ['战略', '竞争', '对抗', '策略', '持久战', '防御', '进攻', '力量', 'strategy', 'competition', 'war'],
    cards: [
      { id: 'AX-008', bridgeId: 'Q08', layer: '基础学科', type: 'AX', title: '知己知彼·百战不殆', content: '了解自身实力和对手实力是决策的前提。在任何竞争性分析中：先做力量对比（SWOT），再定策略方向。', tags: ['strategy', 'intelligence'] },
      { id: 'SC-008', bridgeId: 'Q08', layer: '科学技术', type: 'SC', title: '持久战三阶段论', content: '防御阶段（敌强我弱）→ 相持阶段（力量平衡）→ 反攻阶段（我强敌弱）。识别当前所处阶段决定策略选择。', tags: ['protracted-war', 'phases'] },
      { id: 'TC-008', bridgeId: 'Q08', layer: '工程技术', type: 'TC', title: '五类根因分析法', content: '①直接原因 ②根本原因 ③系统原因 ④历史原因 ⑤外部原因。逐层深入，不满足于第一层解释。适用于问题诊断和战略复盘。', tags: ['root-cause', 'analysis'] },
    ],
  },
  {
    id: 'Q09', name: '行为科学', en: 'Behavioral Science', icon: '👥',
    axiom: '行为是环境与基因的交互产物',
    keywords: ['行为', '心理', '动机', '激励', '决策', '群体', '情绪', 'behavior', 'psychology', 'motivation', 'emotion'],
    cards: [
      { id: 'AX-009', bridgeId: 'Q09', layer: '基础学科', type: 'AX', title: '行为是环境与基因的交互产物', content: '个体行为 = 基因倾向 × 环境刺激 × 认知加工。改变行为需要同时考虑这三层。反例：只改激励制度不改环境，行为不会持久变化。', tags: ['behavior', 'nature-nurture'] },
      { id: 'SC-009', bridgeId: 'Q09', layer: '科学技术', type: 'SC', title: '社会心理学与群体行为', content: '个体在群体中行为改变：从众效应、群体极化、责任分散、社会助长。分析组织行为时必须考虑群体动力。', tags: ['social-psychology', 'group'] },
      { id: 'TC-009', bridgeId: 'Q09', layer: '工程技术', type: 'TC', title: '激励结构反向工程', content: '观察行为模式 → 反推激励结构 → 识别激励扭曲 → 设计修正方案。适用场景：组织诊断、产品设计、政策评估。', tags: ['incentive', 'reverse-engineering'] },
    ],
  },
  {
    id: 'Q10', name: '地理科学', en: 'Geographic Science', icon: '🌍',
    axiom: '空间是关系的载体',
    keywords: ['地理', '空间', '环境', '资源', '区域', '分布', '集聚', 'geography', 'space', 'environment', 'resource'],
    cards: [
      { id: 'AX-010', bridgeId: 'Q10', layer: '基础学科', type: 'AX', title: '空间是关系的载体', content: '一切社会关系和自然过程都在空间中展开。空间不仅是容器，更是关系的塑造者。分析时：位置决定了什么？距离影响了什么？', tags: ['space', 'geography'] },
      { id: 'SC-010', bridgeId: 'Q10', layer: '科学技术', type: 'SC', title: '经济地理学：集聚与扩散', content: '经济活动在空间上集聚（规模效应）和扩散（溢出效应）的双重动力。分析产业布局时需同时考虑向心力和离心力。', tags: ['economic-geography', 'agglomeration'] },
      { id: 'TC-010', bridgeId: 'Q10', layer: '工程技术', type: 'TC', title: '空间锁定诊断工具', content: '识别系统是否陷入空间锁定：①路径依赖检测 ②替代方案可达性分析 ③转换成本评估。适用于区域发展、技术路线选择。', tags: ['lock-in', 'diagnosis'] },
    ],
  },
  {
    id: 'Q11', name: '建筑科学', en: 'Architectural Science', icon: '🏗️',
    axiom: '形式追随功能·功能塑造形式',
    keywords: ['设计', '架构', '工程', '构建', '实现', '模块', '蓝图', '微服务', '单体', '分布式', '接口', '组件', '分层', '模块化', 'design', 'architecture', 'engineering', 'build', 'microservice', 'monolith', 'component'],
    cards: [
      { id: 'AX-011', bridgeId: 'Q11', layer: '基础学科', type: 'AX', title: '形式追随功能·功能塑造形式', content: '设计第一性原则：形式服务于功能，但形式一旦确立又反过来约束功能。分析任何人工系统时：当前形式是否满足功能？形式是否成为进化障碍？', tags: ['design-philosophy', 'form-function'] },
      { id: 'SC-011', bridgeId: 'Q11', layer: '科学技术', type: 'SC', title: '环境心理学：空间行为关系', content: '空间环境影响人类行为：空间权力（布局反映权力结构）、领地性（人对空间的主权意识）、隐私调节（根据情境调节社交距离）。', tags: ['environmental-psychology'] },
      { id: 'TC-011', bridgeId: 'Q11', layer: '工程技术', type: 'TC', title: '蓝图式系统架构法', content: '从建筑蓝图借鉴：①总图（Master Plan）——系统整体架构 ②分层图（Layer Plan）——各层接口职责 ③节点详图（Detail Plan）——关键组件设计。', tags: ['blueprint', 'system-design'] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 桥路由
// ═══════════════════════════════════════════════════════════════

/**
 * 多桥路由：返回命中的桥集合（按分数降序），而非 argmax 单桥。
 *
 * 大成智慧学原则：一个问题往往跨多个学科部门（如"追求性能还是保证成本"
 * 同时触及 Q04 系统科学、Q02 社会科学、Q08 行为科学），应**命中所有相关桥**
 * 而非强行归并到一座。故改为返回分数超过阈值的全部桥，供上层做会商式集成。
 *
 * @param text      待路由文本
 * @param threshold 命中阈值（关键词加权分），默认 2
 * @returns 命中的桥（含分数），降序排列；至少返回 1 座（兜底取最高分桥）
 */
export function routeToBridges(text: string, threshold = 2): Array<{ bridge: BridgeProfile; score: number }> {
  const lower = text.toLowerCase();

  // 通用高频词（降低权重，避免泛化误匹配）
  const genericWords = new Set(['系统', '架构', '设计', '结构', '组织', '管理', '优化', '分析', '实现', '构建', '模块', '工程', '复杂']);

  const scored = ELEVEN_BRIDGES.map(bridge => {
    let score = 0;
    for (const kw of bridge.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        const baseWeight = kw.length;
        // 通用词衰减到 30% 权重
        const weight = genericWords.has(kw) ? baseWeight * 0.3 : baseWeight;
        score += weight;
      }
    }
    return { bridge, score };
  });

  // 取超过阈值的全部桥；若全低于阈值，则用兜底规则补 1 座，否则取最高分
  let hits = scored.filter(s => s.score >= threshold);
  if (hits.length === 0) {
    // 兜底：矛盾/冲突词 → Q02 社会科学
    if (/矛盾|冲突|权衡|取舍|困境|两难/.test(lower)) {
      hits = [{ bridge: ELEVEN_BRIDGES[1]!, score: threshold }];
    }
    // 学习/反思 → Q05 思维科学
    else if (/学习|反思|认知|思维|推理/.test(lower)) {
      hits = [{ bridge: ELEVEN_BRIDGES[4]!, score: threshold }];
    }
    // 否则取分数最高的一座（保证至少 1 座，默认 Q04 系统科学）
    else {
      const top = scored.reduce((a, b) => (b.score > a.score ? b : a), { bridge: ELEVEN_BRIDGES[3]!, score: 0 });
      hits = [top];
    }
  }

  return hits.sort((a, b) => b.score - a.score);
}

/**
 * 兼容单桥接口：返回命中的主桥（多桥路由结果的第一座）。
 * @deprecated 新代码请用 routeToBridges 获取命中桥集合
 */
export function routeToBridge(text: string): BridgeProfile {
  return routeToBridges(text)[0]!.bridge;
}

/**
 * 获取指定桥的卡片，可按层和类型过滤
 */
export function getBridgeCards(
  bridgeId: string,
  filter?: { layer?: KnowledgeCard['layer']; type?: KnowledgeCard['type'] },
): KnowledgeCard[] {
  const bridge = ELEVEN_BRIDGES.find(b => b.id === bridgeId);
  if (!bridge) return [];
  let cards = bridge.cards;
  if (filter?.layer) cards = cards.filter(c => c.layer === filter.layer);
  if (filter?.type) cards = cards.filter(c => c.type === filter.type);
  return cards;
}

/**
 * 获取某桥的核心公理（AX 卡内容）
 */
export function getBridgeAxiom(bridgeId: string): string {
  const bridge = ELEVEN_BRIDGES.find(b => b.id === bridgeId);
  return bridge?.axiom ?? '';
}

/**
 * 获取所有桥的 ID 列表
 */
export function getAllBridgeIds(): string[] {
  return ELEVEN_BRIDGES.map(b => b.id);
}

/**
 * 按 ID 获取桥
 */
export function getBridge(id: string): BridgeProfile | undefined {
  return ELEVEN_BRIDGES.find(b => b.id === id);
}
