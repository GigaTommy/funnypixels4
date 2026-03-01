import React, { useState, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { AllianceAPI, CreateAllianceData } from '../../services/alliance';
import { AllianceFlagPicker } from '../AllianceFlagPicker';
import { replaceAlert } from '../../utils/toastHelper';
import { X, Users, Flag, AlertCircle } from 'lucide-react';

interface CreateAllianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (alliance: any) => void;
}

interface AllianceFormData {
  name: string;
  description: string;
  flagPatternId: string;
  is_public: boolean;
  approval_required: boolean;
}

export const CreateAllianceModal: React.FC<CreateAllianceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<AllianceFormData>({
    name: '',
    description: '',
    flagPatternId: '',
    is_public: true,
    approval_required: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'basic' | 'flag'>('basic');

  // 更新表单数据
  const updateFormData = useCallback((updates: Partial<AllianceFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // 选择旗帜
  const handleFlagSelect = useCallback((flagId: string) => {
    updateFormData({ flagPatternId: flagId });
  }, [updateFormData]);



  // 提交表单
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      setError('请输入联盟名称');
      return;
    }

    if (!formData.flagPatternId) {
      setError('请选择联盟旗帜');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const allianceData: CreateAllianceData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        flagPatternId: formData.flagPatternId,
        is_public: formData.is_public,
        approval_required: formData.approval_required
      };

      const result = await AllianceAPI.createAlliance(allianceData);

      if (result.success) {
        onSuccess(result.alliance);
        onClose();
        // 重置表单
        setFormData({
          name: '',
          description: '',
          flagPatternId: '',
          is_public: true,
          approval_required: true
        });
        setCurrentStep('basic');
      } else {
        setError(result.message || '创建联盟失败');
      }
    } catch (err) {
      logger.error('创建联盟失败:', err);
      setError('创建联盟失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess, onClose]);

  // 下一步
  const handleNext = useCallback(() => {
    if (!formData.name.trim()) {
      setError('请输入联盟名称');
      return;
    }
    setError(null);
    setCurrentStep('flag');
  }, [formData.name]);

  // 上一步
  const handleBack = useCallback(() => {
    setCurrentStep('basic');
    setError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        key="create-alliance-modal"
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000,
          padding: '16px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[95vh] flex flex-col"
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '16px', 
            width: '100%', 
            maxWidth: '896px',
            maxHeight: '95vh',
            position: 'relative',
            zIndex: 10001
          }}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">创建联盟</h2>
                <p className="text-sm text-gray-500">建立您的专属联盟，与志同道合的伙伴一起</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

        {/* 步骤指示器 */}
        <div className="flex items-center p-4 bg-gray-50 flex-shrink-0">
          <div className={`flex items-center ${currentStep === 'basic' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'basic' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              1
            </div>
            <span className="ml-2">基本信息</span>
          </div>
          <div className="flex-1 h-px bg-gray-300 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'flag' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'flag' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
            <span className="ml-2">选择旗帜</span>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">创建失败</p>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'basic' ? (
            /* 基本信息步骤 */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  联盟名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  placeholder="请输入联盟名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={20}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {formData.name.length}/20 字符
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  联盟描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="请输入联盟描述（可选）"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={200}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {formData.description.length}/200 字符
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => updateFormData({ is_public: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">公开联盟</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.approval_required}
                    onChange={(e) => updateFormData({ approval_required: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">需要审批加入</span>
                </label>
              </div>
            </div>
          ) : (
            /* 旗帜选择步骤 */
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">选择联盟旗帜</h3>
                <p className="text-sm text-gray-600 mb-4">
                  选择一面旗帜作为联盟的标志，成员绘制像素时将使用这面旗帜
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">选择旗帜</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-2">调试信息: 当前步骤 = {currentStep}</p>
                  <AllianceFlagPicker
                    value={formData.flagPatternId}
                    onChange={handleFlagSelect}
                    className="border border-gray-200 rounded-lg p-4 bg-white"
                  />
                </div>
              </div>

              {formData.flagPatternId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-blue-700">
                      旗帜已选择，成员绘制像素时将使用此旗帜
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div>
            {currentStep === 'flag' && (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
              >
                上一步
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>

            {currentStep === 'basic' ? (
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                下一步
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.flagPatternId}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    创建中...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    创建联盟
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateAllianceModal;
