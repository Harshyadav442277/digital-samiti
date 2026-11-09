import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().trim().min(3).max(50),
  description: z.string().trim().max(160).default('Saving together, growing together.'),
  monthly: z.number().positive().max(1000000),
  target: z.number().positive().max(100000000),
  rate: z.number().min(0).max(36),
  months: z.number().int().min(1).max(36),
  threshold: z.number().int().min(51).max(100),
  visibility: z.enum(['public', 'private']),
  color: z.enum(['peach', 'green', 'blue', 'purple']),
  icon: z.enum(['graduation', 'heart', 'sparkles', 'users']),
  rules: z.string().trim().max(1500),
});
