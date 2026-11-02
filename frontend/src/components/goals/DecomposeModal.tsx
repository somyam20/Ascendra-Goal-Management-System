import { useState } from 'react';
import { AlertTriangle, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Category, DecomposeResult } from '@/types';
import { goalsApi } from '@/services/endpoints';
import { useToast } from '@/contexts/ToastContext';
import { Field, Modal } from '@/components/common/ui';
import { EmojiLoader } from '@/components/common/EmojiLoader';
import { addDays, today } from '@/utils/format';
import type { GoalPrefill } from './GoalFormModal';

type Ms = { title: string; description: string; due_date: string | null };

/** Human-in-the-loop AI goal decomposition: nothing is saved until the user reviews it. */
export function DecomposeModal({ open, onClose, categories, onUse }: { open: boolean; onClose: () => void; categories: Category[]; onUse: (p: GoalPrefill) => void }) {
  const toast = useToast();
  const [input, setInput] = useState({ title: '', description: '', category_id: '', start_date: today(), end_date: addDays(today(), 90), prompt: '' });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DecomposeResult | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [ms, setMs] = useState<Ms[]>([]);

  const close = () => { setRes(null); setMs([]); onClose(); };

  const run = async () => {
    if (!input.title.trim()) { toast.error('Describe your goal first'); return; }
    if (input.end_date < input.start_date) { toast.error('End date cannot be before the start date'); return; }
    setBusy(true);
    try {
      const r = await goalsApi.decompose({ ...input, category_id: input.category_id || undefined, description: input.description || undefined, prompt: input.prompt || undefined });
      setRes(r); setTitle(r.suggested_title || input.title); setDesc(r.suggested_description || input.description);
      setMs(r.milestones.map((m) => ({ title: m.title, description: m.description ?? '', due_date: m.due_date })));
    } catch (e) { toast.apiError(e, 'AI suggestion failed'); } finally { setBusy(false); }
  };

  const use = () => {
    const valid = ms.filter((m) => m.title.trim());
    onUse({
      ai_generated: true, title, description: desc, category_id: input.category_id || categories[0]?.id || '',
      start_date: input.start_date, end_date: input.end_date, importance: 'HIGH', status: 'DRAFT',
      milestones: valid.map((m) => ({ title: m.title, description: m.description, due_date: m.due_date && m.due_date >= input.start_date && m.due_date <= input.end_date ? m.due_date : '' })),
    });
    close();
  };

  return (
    <Modal open={open} onClose={close} wide title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-secondary" />AI goal breakdown</span>} footer={
      res ? (
        <><button className="btn-ghost" onClick={() => { setRes(null); }}>Reject & start over</button><button className="btn-primary" onClick={use}>Review & save</button></>
      ) : (
        <><button className="btn-ghost" onClick={close}>Cancel</button><button className="btn-primary" disabled={busy} onClick={run}><Wand2 className="h-4 w-4" />{busy ? 'Thinking…' : 'Suggest milestones'}</button></>
      )
    }>
      {busy ? <EmojiLoader message="Breaking your goal into bite-sized steps…" /> : !res ? (
        <div className="space-y-4">
          <Field label="Your goal, in your words"><input className="input" placeholder="I want to switch jobs within three months" value={input.title} onChange={(e) => setInput({ ...input, title: e.target.value })} /></Field>
          <Field label="Context (optional)"><textarea className="input min-h-[70px]" placeholder="Current role, skills, constraints…" value={input.description} onChange={(e) => setInput({ ...input, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category">
              <select className="input" value={input.category_id} onChange={(e) => setInput({ ...input, category_id: e.target.value })}>
                <option value="">Any</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Start"><input type="date" className="input" value={input.start_date} onChange={(e) => setInput({ ...input, start_date: e.target.value })} /></Field>
            <Field label="End"><input type="date" className="input" value={input.end_date} onChange={(e) => setInput({ ...input, end_date: e.target.value })} /></Field>
          </div>
          <Field label="Extra instructions (optional)"><input className="input" placeholder="Focus on GenAI roles, I can study evenings" value={input.prompt} onChange={(e) => setInput({ ...input, prompt: e.target.value })} /></Field>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm">
            <p className="font-semibold text-secondary">Suggestion {res.source === 'fallback' && <span className="chip ml-1 bg-warning/15 text-warning">offline template</span>}</p>
            <p className="text-subtle">{res.summary}</p>
          </div>
          {res.warnings.map((w) => <p key={w} className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}
          <Field label="Goal title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Description"><textarea className="input min-h-[60px]" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="label mb-0">Suggested milestones — edit freely</span>
              <button className="btn-ghost btn-sm" onClick={() => setMs([...ms, { title: '', description: '', due_date: null }])}><Plus className="h-3.5 w-3.5" />Add</button></div>
            <ul className="space-y-2">
              {ms.map((m, i) => (
                <li key={i} className="grid gap-2 rounded-2xl border border-border/70 p-3 sm:grid-cols-[1fr_150px_auto]">
                  <div>
                    <input className="input" value={m.title} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label={`Milestone ${i + 1} title`} />
                    <input className="input mt-2 text-xs" value={m.description} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} aria-label={`Milestone ${i + 1} description`} />
                  </div>
                  <input type="date" className="input" value={m.due_date ?? ''} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, due_date: e.target.value || null } : x)))} aria-label="Due date" />
                  <button className="btn-ghost btn-sm h-9 text-danger" onClick={() => setMs(ms.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
