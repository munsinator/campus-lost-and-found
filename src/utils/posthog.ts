import { PostHog } from 'posthog-node';

export const posthog = new PostHog( process.env.POSTHOG_API_KEY as string, { host: process.env.POSTHOG_HOST as string });