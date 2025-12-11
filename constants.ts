import { ModelProvider, AppSettings } from './types';

export const DEFAULT_RUBRIC = `
1. 准确性 (40%): 答案是否根据标准知识正确？
2. 逻辑思维 (30%): 学生是否展示了对底层概念的理解？
3. 清晰度与卷面 (20%): 字迹是否清晰，结构是否条理分明？
4. 完整性 (10%): 学生是否回答了问题的所有部分？
`;

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: process.env.API_KEY || '',
  modelProvider: ModelProvider.GEMINI,
  // Default fallback
  customBaseUrl: 'https://api.siliconflow.cn/v1', 
  modelName: 'gemini-2.5-flash',
};

// Available models with optional defaultBaseUrl
export const AVAILABLE_MODELS = [
  { 
    value: 'gemini-2.5-flash', 
    label: 'Gemini 2.5 Flash (Google-速度快&视觉强)', 
    provider: ModelProvider.GEMINI 
  },
  { 
    value: 'gemini-2.5-pro-preview', 
    label: 'Gemini 2.5 Pro (Google-推理强)', 
    provider: ModelProvider.GEMINI 
  },
  { 
    value: 'qwen-plus', 
    label: 'Qwen Plus (通义千问-文本增强版)', 
    provider: ModelProvider.CUSTOM,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  { 
    value: 'qwen-vl-max', 
    label: 'Qwen VL Max (通义千问-视觉超强版)', 
    provider: ModelProvider.CUSTOM,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  { 
    value: 'deepseek-ai/DeepSeek-V3', 
    label: 'DeepSeek V3 (深度求索-文本)', 
    provider: ModelProvider.CUSTOM,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1'
  },
  { 
    value: 'Qwen/Qwen2.5-VL-72B-Instruct', 
    label: 'Qwen2.5 VL (SiliconFlow-视觉版)', 
    provider: ModelProvider.CUSTOM,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1'
  },
];