import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useToast } from './ToastContext';
import { getWeeklyJournalFeedback } from '../services/ai';

export default function WeeklyFeedbackModal({ isOpen, onClose, data, setData, country, weekKey }) {
  const { showToast } = useToast();

  const initialFeedbackState = {
    wentRight: '',
    wentWrong: '',
    improvement: '',
    successfulTrades: '',
    aiFeedback: ''
  };

  const [feedback, setFeedback] = useState(initialFeedbackState);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existingFeedback = data?.weeks?.[country]?.[weekKey]?.feedback;
      if (existingFeedback) {
        setFeedback({
          wentRight: existingFeedback.wentRight || '',
          wentWrong: existingFeedback.wentWrong || '',
          improvement: existingFeedback.improvement || '',
          successfulTrades: existingFeedback.successfulTrades || '',
          aiFeedback: existingFeedback.aiFeedback || ''
        });
      } else {
        setFeedback(initialFeedbackState);
      }
    }
  }, [isOpen, data, country, weekKey]);

  const handleSave = () => {
    setData((prev) => {
      const newData = structuredClone(prev);
      if (!newData.weeks) newData.weeks = {};
      if (!newData.weeks[country]) newData.weeks[country] = {};
      if (!newData.weeks[country][weekKey]) newData.weeks[country][weekKey] = { stocks: {} };

      newData.weeks[country][weekKey].feedback = feedback;
      return newData;
    });
    showToast('Weekly feedback saved successfully', 'success');
    onClose();
  };

  const handleGenerateAI = async () => {
    if (!data?.aiSettings?.apiKey) {
      showToast('API Key missing. Please configure AI settings first.', 'error');
      return;
    }

    setIsGenerating(true);
    
    try {
      const allJournals = data?.journals?.[country] || [];
      // Take the most recent 20 journal entries as context
      const recentJournals = [...allJournals].reverse().slice(0, 20);

      const aiText = await getWeeklyJournalFeedback(
        data.aiSettings.apiKey,
        data.aiSettings.model,
        recentJournals,
        feedback
      );

      setFeedback(prev => ({
        ...prev,
        aiFeedback: aiText
      }));
      showToast('Generated AI feedback', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to generate AI feedback', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Weekly Journal Feedback"
      subtitle={`Reflect on your performance for the week of ${weekKey}`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5 pt-2 pb-4">
        <div className="grid grid-cols-2 gap-5">
          <div className="form-field">
            <label className="block mb-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">What Went Right?</label>
            <textarea
              className="grid-notes-input py-2.5 px-3 w-full rounded-lg text-xs leading-relaxed bg-white dark:bg-slate-950 min-h-[100px] border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-400 focus:ring-emerald-400/20"
              value={feedback.wentRight}
              onChange={(e) => setFeedback({ ...feedback, wentRight: e.target.value })}
              placeholder="Good execution, followed rules, cut losses fast..."
            />
          </div>

          <div className="form-field">
            <label className="block mb-1.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-500 uppercase tracking-wider">What Went Wrong?</label>
            <textarea
              className="grid-notes-input py-2.5 px-3 w-full rounded-lg text-xs leading-relaxed bg-white dark:bg-slate-950 min-h-[100px] border-rose-200 dark:border-rose-900/50 focus:border-rose-400 focus:ring-rose-400/20"
              value={feedback.wentWrong}
              onChange={(e) => setFeedback({ ...feedback, wentWrong: e.target.value })}
              placeholder="Overtraded, ignored stops, FOMO entries..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="form-field">
            <label className="block mb-1.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Areas for Improvement</label>
            <textarea
              className="grid-notes-input py-2.5 px-3 w-full rounded-lg text-xs leading-relaxed bg-white dark:bg-slate-950 min-h-[80px] border-amber-200 dark:border-amber-900/50 focus:border-amber-400 focus:ring-amber-400/20"
              value={feedback.improvement}
              onChange={(e) => setFeedback({ ...feedback, improvement: e.target.value })}
              placeholder="Patience on entries, better sizing..."
            />
          </div>

          <div className="form-field">
            <label className="block mb-1.5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Number of Successful Trades</label>
            <input
              type="number"
              className="grid-text-input py-2.5 px-3 w-full rounded-lg font-mono font-semibold bg-white dark:bg-slate-950 h-[80px] text-center text-xl"
              value={feedback.successfulTrades}
              onChange={(e) => setFeedback({ ...feedback, successfulTrades: e.target.value })}
              placeholder="e.g. 5"
            />
          </div>
        </div>

        <div className="form-field relative">
          <label className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              AI Feedback / Coach Notes
            </span>
            <div 
              role="button"
              onClick={handleGenerateAI}
              className={`btn-ai-gradient text-[9.5px] font-extrabold px-2.5 py-1 rounded shadow-md transition-all ${isGenerating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            >
              {isGenerating ? 'Generating...' : '✨ Generate AI Notes'}
            </div>
          </label>
          <textarea
            className="grid-notes-input py-3 px-4 w-full rounded-xl text-xs leading-relaxed bg-indigo-50/30 dark:bg-indigo-950/20 min-h-[100px] border-indigo-200 dark:border-indigo-800/50 focus:border-indigo-400 focus:ring-indigo-400/20 text-indigo-900 dark:text-indigo-100"
            value={feedback.aiFeedback}
            onChange={(e) => setFeedback({ ...feedback, aiFeedback: e.target.value })}
            placeholder="AI reflection will appear here, or paste your own coaching notes..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-4 border-t border-slate-200 dark:border-slate-800/80 pt-4">
          <div 
            role="button"
            className="px-5 py-2.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/20 transition-all cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </div>
          <div 
            role="button"
            className="px-6 py-2.5 text-xs font-extrabold rounded-lg bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)] text-white hover:brightness-110 shadow-lg hover:shadow-[var(--primary)]/20 transition-all cursor-pointer"
            onClick={handleSave}
          >
            Save Weekly Journal
          </div>
        </div>
      </div>
    </Modal>
  );
}
