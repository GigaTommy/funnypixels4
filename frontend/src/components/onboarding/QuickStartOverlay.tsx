import React, { useMemo, useState } from 'react';
import { t } from '../../i18n';

interface QuickStartOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onStartAuto: () => void;
  onLocate: () => void;
  onRoam: () => void;
}

export default function QuickStartOverlay({
  isOpen,
  onClose,
  onComplete,
  onStartAuto,
  onLocate,
  onRoam
}: QuickStartOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => ([
    {
      title: t('quickstart_step1_title'),
      description: t('quickstart_step1_desc'),
      actions: [
        { label: t('quickstart_step1_action'), onClick: onStartAuto }
      ]
    },
    {
      title: t('quickstart_step2_title'),
      description: t('quickstart_step2_desc'),
      actions: [
        { label: t('quickstart_step2_locate'), onClick: onLocate },
        { label: t('quickstart_step2_roam'), onClick: onRoam }
      ]
    },
    {
      title: t('quickstart_step3_title'),
      description: t('quickstart_step3_desc'),
      actions: [
        { label: t('quickstart_step3_done'), onClick: onComplete }
      ]
    }
  ]), [onLocate, onRoam, onStartAuto, onComplete]);

  if (!isOpen) return null;

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 420,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.35)',
          padding: '20px 20px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            {t('quickstart_progress', { current: stepIndex + 1, total: steps.length })}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {t('quickstart_skip')}
          </button>
        </div>

        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{step.title}</div>
        <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>{step.description}</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {step.actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              style={{
                border: 'none',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#111827',
                color: 'white'
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <button
            onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
            disabled={stepIndex === 0}
            style={{
              border: 'none',
              background: 'transparent',
              color: stepIndex === 0 ? '#cbd5f5' : '#475569',
              fontSize: '13px',
              cursor: stepIndex === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {t('quickstart_prev')}
          </button>
          {!isLastStep ? (
            <button
              onClick={() => setStepIndex(stepIndex + 1)}
              style={{
                border: 'none',
                background: '#e2e8f0',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              {t('quickstart_next')}
            </button>
          ) : (
            <button
              onClick={onComplete}
              style={{
                border: 'none',
                background: '#22c55e',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              {t('quickstart_finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
