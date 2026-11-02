import { z } from 'zod';

export const milestoneSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Milestone title is required'),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const goalSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().max(4000).optional().nullable(),
    category_id: z.string().min(1, 'Choose a category'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    importance: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']),
    notes: z.string().max(4000).optional().nullable(),
    milestones: z.array(milestoneSchema),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ['end_date'], message: 'End date cannot be before the start date' })
  .superRefine((v, ctx) => {
    v.milestones.forEach((m, i) => {
      if (m.due_date && (m.due_date < v.start_date || m.due_date > v.end_date)) {
        ctx.addIssue({ code: 'custom', path: ['milestones', i, 'due_date'], message: 'Due date must be within the goal dates' });
      }
    });
  });

export type GoalForm = z.infer<typeof goalSchema>;
