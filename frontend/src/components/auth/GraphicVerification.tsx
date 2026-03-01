import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';

interface VerificationOption {
  id: string;
  content: string;
  label: string;
}

interface VerificationChallenge {
  id: string;
  type: 'shape' | 'color' | 'object' | 'pattern';
  question: string;
  options: VerificationOption[];
  timeLimit: number;
  difficulty: 'easy' | 'medium' | 'hard';
  expiresAt: string;
}

interface GraphicVerificationProps {
  challenge: VerificationChallenge;
  phone: string;
  onSuccess: (tokens: any, user: any) => void;
  onFailure: (error: string, remainingAttempts?: number) => void;
  onExpired?: () => void;
}

export const GraphicVerification: React.FC<GraphicVerificationProps> = ({
  challenge,
  phone,
  onSuccess,
  onFailure,
  onExpired
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(challenge.timeLimit);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(0);
  const [showError, setShowError] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // 倒计时逻辑
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge.id]);

  const handleExpired = useCallback(() => {
    setError('验证已超时，请重新开始');
    setShowError(true);
    setIsLoading(false);
    if (onExpired) {
      onExpired();
    }
  }, [onExpired]);

  const handleOptionClick = useCallback((optionId: string) => {
    setSelectedAnswer(optionId);
    setShowError(false);
    setError('');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedAnswer) {
      setError('请选择一个选项');
      setShowError(true);
      return;
    }

    setIsLoading(true);
    setShowError(false);
    setError('');

    try {
      const response = await fetch('/api/sms/verify-graphic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challengeId: challenge.id,
          answer: selectedAnswer,
          phone: phone
        })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.data.tokens, data.data.user);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (data.remainingAttempts !== undefined) {
          onFailure(data.error, data.remainingAttempts);
        } else {
          onFailure(data.error);
        }
      }
    } catch (error) {
      logger.error('图形验证失败:', error);
      onFailure('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAnswer, challenge.id, phone, attempts, onSuccess, onFailure]);

  const renderOptionContent = (content: string) => {
    // 根据挑战类型渲染不同的内容
    switch (challenge.type) {
      case 'shape':
        return <ShapeRenderer shape={content} />;
      case 'color':
        return <ColorRenderer color={content} />;
      case 'object':
        return <span className="text-4xl">{content}</span>;
      case 'pattern':
        return <PatternRenderer pattern={content} />;
      default:
        return <span className="text-2xl">{content}</span>;
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取时间状态样式
  const getTimeStatusClass = () => {
    if (timeLeft === 0) return 'text-red-500';
    if (timeLeft <= 10) return 'text-orange-500';
    if (timeLeft <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">安全验证</h3>
            <div className={`text-lg font-mono ${getTimeStatusClass()}`}>
              ⏰ {formatTime(timeLeft)}
            </div>
          </div>
          <p className="text-sm mt-2 opacity-90">
            为了您的账户安全，请完成以下验证
          </p>
        </div>

        {/* 验证内容 */}
        <div className="p-6">
          {/* 问题 */}
          <div className="mb-6">
            <div className="text-lg font-semibold text-gray-800 mb-2">
              {challenge.question}
            </div>
            {challenge.difficulty === 'easy' && (
              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                简单
              </span>
            )}
            {challenge.difficulty === 'medium' && (
              <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                中等
              </span>
            )}
            {challenge.difficulty === 'hard' && (
              <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                困难
              </span>
            )}
          </div>

          {/* 选项网格 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {challenge.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                disabled={isLoading}
                className={`
                  relative p-6 border-2 rounded-xl transition-all duration-200
                  ${selectedAnswer === option.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* 选项内容 */}
                <div className="flex flex-col items-center justify-center space-y-3">
                  {renderOptionContent(option.content)}
                  <span className="text-sm text-gray-600 text-center">
                    {option.label}
                  </span>
                </div>

                {/* 选中指示器 */}
                {selectedAnswer === option.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 错误提示 */}
          {showError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setSelectedAnswer('');
                setShowError(false);
                setError('');
                if (onExpired) onExpired();
              }}
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedAnswer || isLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  验证中...
                </div>
              ) : (
                '确认选择'
              )}
            </button>
          </div>

          {/* 尝试次数提示 */}
          {attempts > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              已尝试 {attempts} 次
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="bg-gray-50 px-6 py-3 rounded-b-2xl">
          <div className="text-xs text-gray-500 text-center">
            🔒 此验证用于保护您的账户安全
          </div>
        </div>
      </div>
    </div>
  );
};

// 形状渲染器组件
const ShapeRenderer: React.FC<{ shape: string }> = ({ shape }) => {
  const shapes: { [key: string]: JSX.Element } = {
    'circle': (
      <div className="w-16 h-16 bg-blue-500 rounded-full"></div>
    ),
    'triangle': (
      <div className="w-0 h-0 border-l-[32px] border-l-transparent border-r-[32px] border-r-transparent border-b-[64px] border-b-green-500"></div>
    ),
    'square': (
      <div className="w-16 h-16 bg-red-500"></div>
    ),
    'star': (
      <div className="text-5xl text-yellow-500">⭐</div>
    ),
    'diamond': (
      <div className="w-16 h-16 bg-purple-500 transform rotate-45"></div>
    ),
    'symmetric_circle': (
      <div className="w-16 h-16 bg-blue-500 rounded-full border-4 border-blue-300"></div>
    ),
    'symmetric_star': (
      <div className="text-5xl text-yellow-500">⭐</div>
    ),
    'asymmetric_triangle': (
      <div className="w-0 h-0 border-l-[32px] border-l-transparent border-r-[20px] border-r-transparent border-b-[64px] border-b-green-500"></div>
    ),
    'irregular_shape': (
      <div className="w-16 h-16 bg-gray-500 rounded-lg transform rotate-12"></div>
    ),
    'three_dots': (
      <div className="flex space-x-2">
        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
      </div>
    ),
    'three_lines': (
      <div className="flex flex-col space-y-1">
        <div className="w-12 h-1 bg-green-500"></div>
        <div className="w-12 h-1 bg-green-500"></div>
        <div className="w-12 h-1 bg-green-500"></div>
      </div>
    ),
    'two_dots': (
      <div className="flex space-x-2">
        <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
        <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
      </div>
    ),
    'four_lines': (
      <div className="flex flex-col space-y-1">
        <div className="w-12 h-1 bg-red-500"></div>
        <div className="w-12 h-1 bg-red-500"></div>
        <div className="w-12 h-1 bg-red-500"></div>
        <div className="w-12 h-1 bg-red-500"></div>
      </div>
    ),
    'one_dot': (
      <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
    )
  };

  return shapes[shape] || <div className="w-16 h-16 bg-gray-300"></div>;
};

// 颜色渲染器组件
const ColorRenderer: React.FC<{ color: string }> = ({ color }) => {
  const colors: { [key: string]: JSX.Element } = {
    '🔴': <div className="text-5xl">🔴</div>,
    '🔵': <div className="text-5xl">🔵</div>,
    '🟢': <div className="text-5xl">🟢</div>,
    '🟡': <div className="text-5xl">🟡</div>,
    '🍎': <div className="text-5xl">🍎</div>,
    '🚗': <div className="text-5xl">🚗</div>,
    '🚙': <div className="text-5xl">🚙</div>,
    '🚕': <div className="text-5xl">🚕</div>,
    '💙': <div className="text-5xl">💙</div>,
    '🍌': <div className="text-5xl">🍌</div>,
    '🍊': <div className="text-5xl">🍊</div>,
    '🥬': <div className="text-5xl">🥬</div>,
    '🌲': <div className="text-5xl">🌲</div>
  };

  return colors[color] || <div className="w-16 h-16 bg-gray-300"></div>;
};

// 图案渲染器组件
const PatternRenderer: React.FC<{ pattern: string }> = ({ pattern }) => {
  const patterns: { [key: string]: JSX.Element } = {
    'symmetric_circle': <ShapeRenderer shape="symmetric_circle" />,
    'symmetric_star': <ShapeRenderer shape="symmetric_star" />,
    'asymmetric_triangle': <ShapeRenderer shape="asymmetric_triangle" />,
    'irregular_shape': <ShapeRenderer shape="irregular_shape" />,
    'three_dots': <ShapeRenderer shape="three_dots" />,
    'three_lines': <ShapeRenderer shape="three_lines" />,
    'two_dots': <ShapeRenderer shape="two_dots" />,
    'four_lines': <ShapeRenderer shape="four_lines" />,
    'one_dot': <ShapeRenderer shape="one_dot" />
  };

  return patterns[pattern] || <div className="w-16 h-16 bg-gray-300"></div>;
};

export default GraphicVerification;