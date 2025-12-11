
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import FileUpload from './components/FileUpload';
import { AppSettings, FileStatus, GradingContextType, GradingResult, HomeworkFile, ModelProvider } from './types';
import { DEFAULT_RUBRIC, DEFAULT_SETTINGS, AVAILABLE_MODELS } from './constants';
import { readFileAsBase64, exportToCSV, extractTextFromFile } from './services/fileService';
import { gradeHomework } from './services/geminiService';
import { Play, Settings as SettingsIcon, Save, Download, RefreshCw, AlertCircle, CheckCircle2, RotateCcw, X, Eye } from 'lucide-react';

// Context creation
const GradingContext = createContext<GradingContextType | undefined>(undefined);

export const useGrading = () => {
  const context = useContext(GradingContext);
  if (!context) throw new Error("useGrading must be used within a GradingProvider");
  return context;
};

// Provider Component
const GradingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<HomeworkFile[]>([]);
  const [rubric, setRubric] = useState<string>(DEFAULT_RUBRIC);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isGrading, setIsGrading] = useState(false);

  const addFiles = async (newFiles: File[]) => {
    const processedFiles: HomeworkFile[] = [];
    const validFiles = newFiles.filter(f => !f.name.startsWith('.'));

    for (const f of validFiles) {
        processedFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: f.name,
            type: f.type,
            size: f.size,
            status: FileStatus.PENDING,
            base64Data: await readFileAsBase64(f),
            textContent: await extractTextFromFile(f)
        });
    }

    setFiles(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileStatus = (id: string, status: FileStatus, result?: GradingResult, error?: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, status, result, errorMessage: error };
      }
      return f;
    }));
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const startBatchGrading = async () => {
    setIsGrading(true);
    const filesToGrade = files.filter(f => f.status === FileStatus.PENDING || f.status === FileStatus.ERROR);

    for (const file of filesToGrade) {
      updateFileStatus(file.id, FileStatus.PROCESSING);
      try {
        await new Promise(r => setTimeout(r, 500)); 
        const result = await gradeHomework(file, rubric, settings);
        updateFileStatus(file.id, FileStatus.COMPLETED, result);
      } catch (error) {
        updateFileStatus(file.id, FileStatus.ERROR, undefined, error instanceof Error ? error.message : "Unknown error");
      }
    }
    setIsGrading(false);
  };

  const reGradeFile = async (id: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    updateFileStatus(id, FileStatus.PROCESSING);
    try {
      const result = await gradeHomework(file, rubric, settings);
      updateFileStatus(id, FileStatus.COMPLETED, result);
    } catch (error) {
      updateFileStatus(id, FileStatus.ERROR, undefined, error instanceof Error ? error.message : "Unknown error");
    }
  };

  return (
    <GradingContext.Provider value={{
      files, addFiles, removeFile, updateFileStatus,
      settings, updateSettings,
      rubric, setRubric,
      startBatchGrading, reGradeFile, isGrading
    }}>
      {children}
    </GradingContext.Provider>
  );
};

// --- Helper Functions ---

const parseScore = (scoreStr: string | undefined): number | null => {
  if (!scoreStr) return null;
  // Try to find the first number in the string (e.g. "95/100" -> 95)
  const match = scoreStr.match(/(\d+(\.\d+)?)/);
  if (match) return parseFloat(match[0]);
  return null;
};

// --- Custom Components ---

const SimpleBarChart = ({ data }: { data: { name: string; count: number; color: string }[] }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="w-full h-full flex items-end justify-between gap-2 pt-8 pb-2 px-4 select-none">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group relative">
          <div 
            className="w-full max-w-[40px] rounded-t-md transition-all duration-500 ease-out relative group-hover:brightness-95 cursor-default"
            style={{ 
              height: `${(d.count / max) * 85}%`, 
              backgroundColor: d.color,
              minHeight: d.count > 0 ? '4px' : '0' 
            }}
          >
             {d.count > 0 && (
                 <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-600 animate-fade-in">
                     {d.count}
                 </span>
             )}
          </div>
          <span className="text-[10px] sm:text-xs text-gray-500 mt-2 font-medium">{d.name}</span>
        </div>
      ))}
    </div>
  );
};

const ResultDetailModal = ({ file, onClose }: { file: HomeworkFile, onClose: () => void }) => {
  if (!file.result) return null;
  const { result } = file;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{file.name}</h3>
            <div className="flex gap-4 mt-1 text-sm text-gray-500">
               <span>总分/等级: <b className="text-fluent-primary text-lg">{result.score}</b>{result.maxScore && result.maxScore !== '100' ? ` / ${result.maxScore}` : ''}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          
          {/* Summary Section */}
          <section>
            <h4 className="text-sm uppercase tracking-wide text-gray-500 font-bold mb-3">综合评语</h4>
            <div className="bg-blue-50/50 p-4 rounded-xl text-gray-800 leading-relaxed whitespace-pre-wrap border border-blue-100">
              {result.summary}
            </div>
          </section>

          {/* Detailed Breakdown Section */}
          {result.details && result.details.length > 0 && (
            <section>
               <h4 className="text-sm uppercase tracking-wide text-gray-500 font-bold mb-3">分项详情</h4>
               <div className="grid grid-cols-1 gap-4">
                  {result.details.map((item, idx) => (
                    <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                       <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-700">{item.name}</span>
                          {item.score && (
                             <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">
                               {item.score}
                             </span>
                          )}
                       </div>
                       <p className="text-sm text-gray-600 leading-relaxed">{item.feedback || "无具体反馈"}</p>
                    </div>
                  ))}
               </div>
            </section>
          )}

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <section>
                <h4 className="text-sm uppercase tracking-wide text-green-600 font-bold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> 优点
                </h4>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                      {s}
                    </li>
                  ))}
                </ul>
             </section>
             
             <section>
                <h4 className="text-sm uppercase tracking-wide text-red-500 font-bold mb-3 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-red-500"></span> 不足
                </h4>
                <ul className="space-y-2">
                  {result.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-gray-700 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                      {w}
                    </li>
                  ))}
                </ul>
             </section>
          </div>

          {/* Suggestions */}
          <section>
             <h4 className="text-sm uppercase tracking-wide text-fluent-primary font-bold mb-3">改进建议</h4>
             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed">
                {result.suggestions}
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};


// --- View Components ---

const Dashboard = () => {
  const { files, startBatchGrading, isGrading } = useGrading();
  const completed = files.filter(f => f.status === FileStatus.COMPLETED).length;
  const pending = files.filter(f => f.status === FileStatus.PENDING).length;

  // Prepare Data for Chart - Only numeric scores can be charted properly
  const gradedFiles = files.filter(f => f.status === FileStatus.COMPLETED && f.result);
  const numericScores = gradedFiles
    .map(f => parseScore(f.result?.score))
    .filter((s): s is number => s !== null);
  
  const distributionData = [
    { name: '<60', count: numericScores.filter(s => s < 60).length, color: '#ef4444' },
    { name: '60-69', count: numericScores.filter(s => s >= 60 && s < 70).length, color: '#f97316' },
    { name: '70-79', count: numericScores.filter(s => s >= 70 && s < 80).length, color: '#eab308' },
    { name: '80-89', count: numericScores.filter(s => s >= 80 && s < 90).length, color: '#3b82f6' },
    { name: '90+', count: numericScores.filter(s => s >= 90).length, color: '#22c55e' },
  ];
  
  // Count non-numeric grades
  const qualitativeCount = gradedFiles.length - numericScores.length;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-fluent border border-gray-100">
          <h3 className="text-gray-500 font-medium text-sm mb-1">文件总数</h3>
          <p className="text-4xl font-bold text-fluent-text">{files.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-fluent border border-gray-100">
          <h3 className="text-gray-500 font-medium text-sm mb-1">已完成</h3>
          <p className="text-4xl font-bold text-green-600">{completed}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-fluent border border-gray-100">
          <h3 className="text-gray-500 font-medium text-sm mb-1">待处理</h3>
          <p className="text-4xl font-bold text-orange-500">{pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gradient-to-r from-fluent-primary to-blue-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden flex flex-col justify-center min-h-[240px]">
            <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
              <RefreshCw size={200} />
            </div>
            <h2 className="text-2xl font-bold mb-2 relative z-10">准备好开始了吗？</h2>
            <p className="opacity-90 mb-6 max-w-lg relative z-10">
              AutoGrade Pro 支持自定义评分标准，无论是按章节打分、定性评价还是百分制，AI 都能精准执行。
            </p>
            <div>
                <button 
                onClick={startBatchGrading}
                disabled={isGrading || pending === 0}
                className={`relative z-10 px-6 py-3 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-all ${
                    isGrading || pending === 0 
                    ? 'bg-white/20 cursor-not-allowed text-gray-200' 
                    : 'bg-white text-fluent-primary hover:bg-gray-50'
                }`}
                >
                {isGrading ? (
                    <RefreshCw className="animate-spin" size={20} />
                ) : (
                    <Play size={20} fill="currentColor" />
                )}
                {isGrading ? '正在批改中...' : '开始批量批改'}
                </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-fluent border border-gray-100 flex flex-col min-h-[240px]">
            <h3 className="text-gray-700 font-bold mb-4 flex justify-between">
                <span>分数分布</span>
                {qualitativeCount > 0 && <span className="text-xs font-normal text-gray-400 self-center">({qualitativeCount} 个非数字评分)</span>}
            </h3>
            {numericScores.length > 0 ? (
                <div className="flex-1 w-full h-full min-h-[160px]">
                    <SimpleBarChart data={distributionData} />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                     <p className="text-sm">暂无数字评分数据</p>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

const RubricEditor = () => {
  const { rubric, setRubric } = useGrading();
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-fluent-text">评分标准设置</h2>
        <button className="flex items-center gap-2 text-sm text-fluent-primary font-medium hover:underline">
          <Save size={16} /> 保存模板
        </button>
      </div>
      <div className="flex-1 flex flex-col gap-2">
         <p className="text-sm text-gray-500">
             提示：您可以定义具体的章节、分值权重或定性评价标准（如优/良/差）。AI 将严格遵循您的格式要求。
         </p>
         <div className="flex-1 bg-white rounded-xl shadow-fluent border border-gray-200 p-1">
            <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            className="w-full h-full p-6 outline-none resize-none text-gray-700 font-mono text-sm leading-relaxed rounded-xl"
            placeholder="示例：
1. 第一章：基础知识 (20分)
2. 第二章：核心概念 (30分)
...
或者：
- 逻辑性 (优/良/中/差)
- 准确度 (A/B/C)
..."
            />
         </div>
      </div>
    </div>
  );
};

const ResultsView = () => {
  const { files, reGradeFile } = useGrading();
  const [selectedFile, setSelectedFile] = useState<HomeworkFile | null>(null);
  
  const gradedFiles = files.filter(f => f.status === FileStatus.COMPLETED);

  // Determine unique keys for dynamic columns based on actual results
  const uniqueDetailKeys = useMemo(() => {
    const keys = new Set<string>();
    files.forEach(f => {
      if (f.result?.details) {
        f.result.details.forEach(d => keys.add(d.name));
      }
    });
    return Array.from(keys);
  }, [files]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-fluent-text">批改结果</h2>
        <button 
          onClick={() => exportToCSV(gradedFiles)}
          disabled={gradedFiles.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} /> 导出 Excel (CSV)
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-fluent border border-gray-200 overflow-hidden flex flex-col">
        {/* Horizontal scroll container for wide tables */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 font-semibold text-gray-600 border-b min-w-[150px] sticky left-0 bg-gray-50 z-20 shadow-[1px_0_0_0_rgba(229,231,235,1)]">文件名</th>
                <th className="p-4 font-semibold text-gray-600 border-b w-[100px]">得分/等级</th>
                
                {/* Dynamic Headers for Details */}
                {uniqueDetailKeys.map(key => (
                  <React.Fragment key={key}>
                    <th className="p-4 font-semibold text-gray-600 border-b min-w-[100px] border-l border-gray-100 bg-blue-50/30">{key} (分)</th>
                    <th className="p-4 font-semibold text-gray-600 border-b min-w-[200px] max-w-[300px] bg-blue-50/10">{key} (评)</th>
                  </React.Fragment>
                ))}

                <th className="p-4 font-semibold text-gray-600 border-b w-[250px]">综合评语</th>
                <th className="p-4 font-semibold text-gray-600 border-b w-[100px]">状态</th>
                <th className="p-4 font-semibold text-gray-600 border-b w-[100px] sticky right-0 bg-gray-50 z-20 shadow-[-1px_0_0_0_rgba(229,231,235,1)]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50/50 align-top group">
                  <td className="p-4 font-medium text-gray-800 break-words sticky left-0 bg-white group-hover:bg-gray-50 transition-colors z-10 shadow-[1px_0_0_0_rgba(229,231,235,0.5)]">{file.name}</td>
                  <td className="p-4 font-bold text-fluent-primary">
                    {file.result ? file.result.score : '-'}
                  </td>

                  {/* Dynamic Columns for Details */}
                  {uniqueDetailKeys.map(key => {
                    const detail = file.result?.details?.find(d => d.name === key);
                    return (
                      <React.Fragment key={key}>
                        <td className="p-4 border-l border-gray-50 text-sm font-semibold text-gray-700 bg-blue-50/10 group-hover:bg-blue-50/20">
                           {detail ? detail.score : '-'}
                        </td>
                        <td className="p-4 text-xs text-gray-500 max-w-[300px] truncate bg-blue-50/5 group-hover:bg-blue-50/10" title={detail?.feedback}>
                           {detail ? detail.feedback : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  <td className="p-4 text-sm text-gray-600 max-w-[250px] truncate" title={file.result?.summary}>
                    {file.result?.summary || file.errorMessage || '-'}
                  </td>
                  <td className="p-4">
                    {file.status === FileStatus.COMPLETED && <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold px-2 py-1 bg-green-50 rounded-full whitespace-nowrap"><CheckCircle2 size={12}/> 完成</span>}
                    {file.status === FileStatus.PENDING && <span className="text-gray-400 text-xs">待处理</span>}
                    {file.status === FileStatus.PROCESSING && <span className="text-fluent-primary text-xs animate-pulse">处理中...</span>}
                    {file.status === FileStatus.ERROR && <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold px-2 py-1 bg-red-50 rounded-full whitespace-nowrap"><AlertCircle size={12}/> 错误</span>}
                  </td>
                  <td className="p-4 sticky right-0 bg-white group-hover:bg-gray-50 transition-colors z-10 shadow-[-1px_0_0_0_rgba(229,231,235,0.5)]">
                     <div className="flex items-center gap-1">
                        {file.status === FileStatus.COMPLETED && (
                            <button
                                onClick={() => setSelectedFile(file)}
                                title="查看详情"
                                className="text-gray-400 hover:text-fluent-primary hover:bg-blue-50 p-2 rounded-full transition-all"
                            >
                                <Eye size={18} />
                            </button>
                        )}
                        <button 
                            onClick={() => reGradeFile(file.id)}
                            title="重新批改"
                            disabled={file.status === FileStatus.PROCESSING}
                            className="text-gray-400 hover:text-fluent-primary hover:bg-blue-50 p-2 rounded-full transition-all disabled:opacity-30"
                        >
                            <RotateCcw size={18} className={file.status === FileStatus.PROCESSING ? "animate-spin" : ""} />
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={5 + uniqueDetailKeys.length * 2} className="p-8 text-center text-gray-400">暂无数据。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedFile && (
          <ResultDetailModal file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  );
};

const SettingsView = () => {
  const { settings, updateSettings } = useGrading();

  const filteredModels = AVAILABLE_MODELS.filter(m => m.provider === settings.modelProvider);

  const handleModelChange = (modelValue: string) => {
    const selectedModel = AVAILABLE_MODELS.find(m => m.value === modelValue);
    const updates: Partial<AppSettings> = { modelName: modelValue };
    
    if (selectedModel?.defaultBaseUrl) {
      updates.customBaseUrl = selectedModel.defaultBaseUrl;
    }
    updateSettings(updates);
  };

  const handleProviderChange = (provider: ModelProvider) => {
      const modelsForProvider = AVAILABLE_MODELS.filter(m => m.provider === provider);
      if (modelsForProvider.length > 0) {
          const firstModel = modelsForProvider[0];
          updateSettings({ 
              modelProvider: provider, 
              modelName: firstModel.value,
              customBaseUrl: firstModel.defaultBaseUrl || settings.customBaseUrl
          });
      } else {
          updateSettings({ modelProvider: provider });
      }
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-fluent-text mb-6">系统设置</h2>
      
      <div className="bg-white rounded-xl shadow-fluent p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">模型服务商</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 flex-1">
              <input 
                type="radio" 
                name="provider" 
                checked={settings.modelProvider === ModelProvider.GEMINI}
                onChange={() => handleProviderChange(ModelProvider.GEMINI)}
                className="text-fluent-primary"
              />
              Google Gemini
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 flex-1">
               <input 
                type="radio" 
                name="provider" 
                checked={settings.modelProvider === ModelProvider.CUSTOM}
                onChange={() => handleProviderChange(ModelProvider.CUSTOM)}
              />
              OpenAI Compatible
            </label>
          </div>
        </div>

        {settings.modelProvider === ModelProvider.CUSTOM && (
           <div className="animate-fade-in space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluent-primary focus:border-transparent outline-none bg-white"
                />
             </div>
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={settings.customBaseUrl}
                  onChange={(e) => updateSettings({ customBaseUrl: e.target.value })}
                  placeholder="https://api.siliconflow.cn/v1"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fluent-primary focus:border-transparent outline-none bg-white"
                />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">选择模型</label>
          <select 
            value={settings.modelName}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg bg-white outline-none"
          >
            {filteredModels.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        
        <div className="pt-4 border-t border-gray-100">
            <button className="bg-fluent-primary text-white px-6 py-2 rounded-lg hover:bg-fluent-primaryHover transition-colors">
                保存设置
            </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <GradingProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<FileUpload />} />
            <Route path="rubric" element={<RubricEditor />} />
            <Route path="results" element={<ResultsView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </GradingProvider>
  );
};

export default App;
