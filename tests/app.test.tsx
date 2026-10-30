import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { unratedYesterday } from '@/features/log/RateBanner';
import { groupByDate } from '@/features/log/Calendar';
import { logged } from './helpers';

describe('app shell', () => {
  it('renders the Ask screen and switches tabs', async () => {
    render(<MemoryRouter initialEntries={['/ask']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'What are we wearing?' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const [tab, heading] of [['Wardrobe', 'Wardrobe'], ['Check', 'Check my outfit'], ['Log', 'Log'], ['Settings', 'Settings']]) {
      await userEvent.click(within(nav).getByRole('link', { name: tab }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
  });
  it('shows built-in occasions as quick picks', async () => {
    render(<MemoryRouter initialEntries={['/ask']}><App /></MemoryRouter>);
    for (const name of ['Office', 'Casual', 'Date', 'Party', 'Festive', 'Gym', 'Travel', 'Home']) expect(await screen.findByRole('button', { name })).toBeInTheDocument();
  });
});

describe('log helpers', () => {
  it('groups entries by local date', () => {
    const m = groupByDate([logged({}, '2026-10-30'), logged({}, '2026-10-30'), logged({}, '2026-10-29')]);
    expect(m.get('2026-10-30')).toHaveLength(2);
    expect(m.get('2026-10-29')).toHaveLength(1);
  });
  it('asks to rate yesterday only when it is unrated', () => {
    expect(unratedYesterday([logged({}, '2026-10-29')], '2026-10-30')).toBeDefined();
    expect(unratedYesterday([logged({}, '2026-10-29', { rating: 4 })], '2026-10-30')).toBeUndefined();
    expect(unratedYesterday([logged({}, '2026-10-28')], '2026-10-30')).toBeUndefined();
  });
});
