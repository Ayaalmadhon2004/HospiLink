import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { LoginPage } from '../../pages/LoginPage';
import i18n, { detectLanguage, LANGUAGE_STORAGE_KEY } from '../../i18n';

vi.mock('../../services/authService', () => ({ login: vi.fn() }));

describe('language switching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('switches to Arabic: updates dir/lang, persists the choice and translates the UI', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Switch language: العربية' }));

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ar');
    expect(screen.getByText('مرحبًا بعودتك')).toBeInTheDocument();
    expect(screen.queryByText('Welcome Back')).not.toBeInTheDocument();
  });

  it('keeps the button itself in the page language so logical offsets (end-4) are not flipped', () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('lang');
    expect(screen.getByText('العربية')).toHaveAttribute('lang', 'ar');
  });

  it('switches back to English and restores ltr', async () => {
    await i18n.changeLanguage('ar');
    render(<LanguageSwitcher />);
    await userEvent.setup().click(screen.getByRole('button'));

    expect(i18n.language).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('still switches when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await i18n.changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});

describe('detectLanguage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('prefers a saved supported language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ar');
    expect(detectLanguage()).toBe('ar');
  });

  it('ignores unsupported saved values and falls back to the browser language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ar-JO');
    expect(detectLanguage()).toBe('ar');
  });

  it('falls back to English when storage throws and the browser language is unsupported', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
    expect(detectLanguage()).toBe('en');
  });
});
